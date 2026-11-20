import {spawnSync} from 'node:child_process'
import {mkdirSync,readFileSync,writeFileSync,readdirSync,copyFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {operationalFixture} from '../e2e/helpers/operational-fixture.mjs'
import {sql} from '../e2e/helpers/local-db.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Exige --reset-local-fixtures; não executar com prévia em revisão.')
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&process.platform==='win32',...extra});if(r.status!==0)throw Error('Ensaio local falhou: '+bin+' '+r.stderr.slice(-900));return r.stdout}
const cli=args=>run('npx',['--yes','supabase@3.0.0',...args])
const values=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Recusa ambiente remoto')
const env={VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const candidate=run('git',['rev-parse','HEAD']).trim(),baseline='7d1a4750cda3058f4d3d7aaf2f623472f8691ef0',files=readdirSync('supabase/migrations').sort(),versions=files.filter(f=>/^202611180[123]0000/.test(f)).map(f=>f.slice(0,14)),root=resolve('.validation/productivity-upgrade-'+randomUUID())
mkdirSync(root,{recursive:true});const browser=await chromium.launch();let f
async function frontend(ref,label){
 const source=join(root,label);mkdirSync(source,{recursive:true});const archive=spawnSync('git',['archive',ref,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:30*1024*1024});if(archive.status!==0)throw Error('Snapshot indisponível')
 run('tar',['-xf','-','-C',source],{input:archive.stdout,encoding:undefined});const server=await createServer({root:source,configFile:false,server:{host:'127.0.0.1',port:4186,strictPort:true}});await server.listen()
 const context=await browser.newContext(),page=await context.newPage()
 try{await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('http://127.0.0.1:4186');await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await expect(page.getByRole('button',{name:'Café Horizonte · fictício',exact:true})).toBeVisible();if(ref===candidate){await page.getByRole('navigation').getByRole('button',{name:'Central de prospecção',exact:true}).click();await expect(page.getByRole('heading',{name:'Central de prospecção',exact:true})).toBeVisible()}console.log('Frontend '+label+': aprovado.')}finally{await context.close();await server.close()}
}
const evidence={candidate,baseline,phases:[],recovery:'Frontend #33 preservando expansões, documentos, vínculos e restrições'}
try{
 cli(['db','reset','--local','--version','20261118002000','--no-seed','--yes']);f=await operationalFixture(env)
 const digest=()=>sql(`select md5(jsonb_build_object('members',(select jsonb_agg(to_jsonb(x) order by user_id) from public.hub_members x where workspace_id='${f.workspace}'),'leads',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_leads x where workspace_id='${f.workspace}'),'projects',(select jsonb_agg(to_jsonb(x) order by proposal_id) from public.hub_projects x where workspace_id='${f.workspace}'),'proposals',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_proposals x where workspace_id='${f.workspace}'),'meetings',(select jsonb_agg(to_jsonb(x)-'revision'-'project_id'-'contract_id' order by id) from public.hub_meetings x where workspace_id='${f.workspace}'),'activities',(select jsonb_agg(to_jsonb(x)-'revision'-'assigned_user_id'-'result'-'completed_at' order by id) from public.hub_activities x where workspace_id='${f.workspace}'))::text);`)
 const before=digest();await frontend(baseline,'base-33')
 for(const version of versions){
  const phase=join(root,version),dir=join(phase,'supabase');mkdirSync(join(dir,'migrations'),{recursive:true});copyFileSync('supabase/config.toml',join(dir,'config.toml'));for(const file of files.filter(f=>f.slice(0,14)<=version))copyFileSync(join('supabase/migrations',file),join(dir,'migrations',file))
  const output=cli(['db','push','--local','--skip-vault','--dry-run','--yes','--workdir',phase,'--output-format','stream-json'])
  const report=output.split(/\r?\n/).flatMap(l=>{try{const o=JSON.parse(l);return[o.type==='result'?o.data:o]}catch{return[]}}).find(o=>o.migrations)
  if(report?.migrations?.length!==1||!report.migrations[0].startsWith(version))throw Error('Dry-run não exclusivo '+version)
  cli(['db','push','--local','--skip-vault','--yes','--workdir',phase]);if(digest()!==before)throw Error('Registros anteriores alterados')
  if((await f.restricted.client.from('hub_proposals').select('record')).error?.code!=='42501')throw Error('JSON financeiro liberado')
  if(sql("select public::text from storage.buckets where id='hub-private-documents'")!=='false')throw Error('Bucket não privado')
  await frontend(baseline,'recuperacao-'+version);evidence.phases.push({version,exclusiveDryRun:true,preserved:true,previousFrontend:true,financialDenied:true})
 }
 await frontend(candidate,'candidato');evidence.result='passed';writeFileSync('.validation/productivity-upgrade-result.json',JSON.stringify(evidence,null,2));console.log('Ensaio de prospecção/importação/atividades aprovado; recuperação #33 e dados preservados.')
}finally{await browser.close();cli(['db','reset','--local','--no-seed','--yes'])}
