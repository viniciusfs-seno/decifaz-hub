import {spawnSync} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {operationalFixture,checked} from '../e2e/helpers/operational-fixture.mjs'
import {sql} from '../e2e/helpers/local-db.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Use --reset-local-fixtures somente na pilha descartável.')
const shell=process.platform==='win32',candidate=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim()
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&shell,...extra});if(r.status!==0)throw Error('Falha em '+bin+' '+args.filter(a=>!a.includes('token')).join(' ')+': '+r.stderr.slice(-1200));return r.stdout}
const cli=args=>run('npx',['--yes','supabase@3.0.0',...args])
const values=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente pilha local')
const env={VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const versions=['20261116020000','20261116030000','20261116050000'],files=readdirSync('supabase/migrations').sort()
const root=resolve('.validation/integrated-upgrade-'+randomUUID());mkdirSync(root,{recursive:true})
const browser=await chromium.launch(),evidence={candidate,baseline:'4e59c14d08b5080936d38668c6643e0fc1c0cedf',baselineMigration:'20261116010000',phases:[]}
let f
async function verify(ref,label){
 const source=join(root,'source-'+ref);mkdirSync(source,{recursive:true})
 const archive=spawnSync('git',['archive',ref,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:20*1024*1024})
 if(archive.status!==0)throw Error('Snapshot indisponível '+ref)
 run('tar',['-xf','-','-C',source],{input:archive.stdout,encoding:undefined})
 const server=await createServer({root:source,configFile:false,base:'./',server:{host:'127.0.0.1',port:4186,strictPort:true}});await server.listen()
 const context=await browser.newContext({timezoneId:'America/Fortaleza'}),page=await context.newPage()
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('http://127.0.0.1:4186')
  await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await expect(page.getByRole('button',{name:'Café Horizonte · fictício',exact:true})).toBeVisible()
  await page.getByRole('navigation').getByRole('button',{name:'Propostas comerciais',exact:true}).click();await expect(page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true})).toBeVisible()
  if(label.includes('catalogo')){await page.getByRole('navigation').getByRole('button',{name:'Catálogo de soluções',exact:true}).click();await expect(page.getByRole('heading',{name:'Cardápio digital',exact:true})).toBeVisible()}
  if(label==='integrado'){await page.getByRole('navigation').getByRole('button',{name:'Indicadores',exact:true}).click();await expect(page.getByRole('heading',{name:'Indicadores gerenciais',exact:true})).toBeVisible();await page.getByRole('navigation').getByRole('button',{name:'Revisão semanal',exact:true}).click();await expect(page.getByRole('heading',{name:'Fechamento semanal',exact:true})).toBeVisible()}
  const restricted=await checked(f.restricted.client.from('hub_proposals_visible').select('record').eq('workspace_id',f.workspace).single())
  for(const key of ['setup','monthly','terms'])if(key in restricted.record)throw Error('Valor protegido exposto')
  if((await f.restricted.client.from('hub_proposals').select('record').eq('workspace_id',f.workspace)).error?.code!=='42501')throw Error('JSON bruto liberado')
  console.log('Compatibilidade '+label+': aprovada; sessão real fictícia, CRM/proposta e restrição financeira.')
 }finally{await context.close();await server.close()}
}
try{
 cli(['db','reset','--local','--version','20261116010000','--no-seed','--yes'])
 f=await operationalFixture(env)
 const digest=()=>sql(`select md5(jsonb_build_object(
 'members',(select jsonb_agg(to_jsonb(x) order by x.user_id) from public.hub_members x where workspace_id in ('${f.workspace}','${f.other}')),
 'leads',(select jsonb_agg(to_jsonb(x) order by x.id) from public.hub_leads x where workspace_id='${f.workspace}'),
 'proposals',(select jsonb_agg(to_jsonb(x) order by x.id) from public.hub_proposals x where workspace_id='${f.workspace}'),
 'activities',(select jsonb_agg(to_jsonb(x)-'review_id'-'review_kind' order by x.id) from public.hub_activities x where workspace_id='${f.workspace}'),
 'audit',(select jsonb_agg(to_jsonb(x) order by x.id) from public.hub_role_audit x where workspace_id='${f.workspace}')
 )::text);`)
 const before=digest();await verify(evidence.baseline,'base-producao-ficticia')
 for(const [i,version] of versions.entries()){
  const phase=join(root,'phase-'+version),dir=join(phase,'supabase');mkdirSync(join(dir,'migrations'),{recursive:true});copyFileSync('supabase/config.toml',join(dir,'config.toml'))
  for(const file of files.filter(file=>file.slice(0,14)<=version))copyFileSync(join('supabase/migrations',file),join(dir,'migrations',file))
  const dry=cli(['db','push','--local','--skip-vault','--dry-run','--yes','--workdir',phase,'--output-format','stream-json'])
  const report=dry.split(/\r?\n/).flatMap(l=>{try{const o=JSON.parse(l);return[o.type==='result'?o.data:o]}catch{return[]}}).find(o=>o.migrations)
  if(report?.migrations.length!==1||!report.migrations[0].startsWith(version))throw Error('Dry-run não contém somente '+version)
  cli(['db','push','--local','--skip-vault','--yes','--workdir',phase])
  const operational='44afc1d7aa54228b3402f78159d22e1150cc8f55',catalog='137d1432a1549bde5686038830851738b57c4e44',meeting='bd4265474c62162d41f515cca7544588bb255f7c'
  const previous=[evidence.baseline,operational,meeting][i]
  await verify(previous,'anterior-apos-'+version)
  if(i===0)await verify(operational,'operacional')
  if(i===1){await verify(catalog,'catalogo');await verify(meeting,'reuniao-catalogo')}
  if(i===2)await verify(candidate,'integrado')
  if(digest()!==before)throw Error('Migração alterou registros anteriores')
  evidence.phases.push({version,onlyPendingMigration:true,previousFrontend:previous,preserved:true,sha256:createHash('sha256').update(readFileSync(join('supabase/migrations',files.find(f=>f.startsWith(version))))).digest('hex')})
 }
 evidence.restoration='frontend anterior preservando banco expandido/restrições';evidence.result='passed'
 writeFileSync('.validation/integrated-upgrade-result.json',JSON.stringify(evidence,null,2));console.log('Ensaio #18 → #19 → #20 → #21 → #22 aprovado; registros e permissões preservados.')
}finally{
 await browser.close();cli(['db','reset','--local','--no-seed','--yes']);console.log('Pilha fictícia local restaurada com o esquema candidato completo.')
}
