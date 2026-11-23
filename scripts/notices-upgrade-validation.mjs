import {spawnSync} from 'node:child_process'
import {mkdirSync,readFileSync,readdirSync,copyFileSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {operationalFixture} from '../e2e/helpers/operational-fixture.mjs'
import {registryFixture} from './registry-preview-fixture.mjs'
import {sql} from '../e2e/helpers/local-db.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Somente descartável; exige --reset-local-fixtures e prévia parada.')
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&process.platform==='win32',...extra});if(r.status!==0)throw Error('Ensaio local recusado: '+bin);return r.stdout}
const cli=args=>run('npx',['--yes','supabase@3.0.0',...args])
const values=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente ambiente local.')
const env={VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const candidate=run('git',['rev-parse','HEAD']).trim(),baseline=run('git',['rev-parse','100dc1a']).trim(),root=resolve('.validation/notices-upgrade-'+randomUUID()),versions=['20261122010000','20261122020000']
mkdirSync(root,{recursive:true});const browser=await chromium.launch();let f
async function frontend(ref,label){
 const source=join(root,label);mkdirSync(source,{recursive:true});const archive=spawnSync('git',['archive',ref,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:30*1024*1024});if(archive.status!==0)throw Error('Snapshot indisponível')
 run('tar',['-xf','-','-C',source],{input:archive.stdout,encoding:undefined});const server=await createServer({root:source,configFile:false,server:{host:'127.0.0.1',port:4186,strictPort:true}});await server.listen()
 const context=await browser.newContext(),page=await context.newPage()
 try{await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('http://127.0.0.1:4186');await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible();await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await expect(page.getByRole('button',{name:'Café Horizonte · fictício',exact:true})).toBeVisible();if(ref===candidate){await page.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click();await expect(page.getByRole('tab',{name:'Preferências',exact:true})).toBeVisible()}console.log('Frontend '+label+': aprovado.')}finally{await context.close();await server.close()}
}
try{
 cli(['db','reset','--local','--version','20261121010000','--no-seed','--yes']);f=await operationalFixture(env);await registryFixture(f)
 const digest=()=>sql(`select md5(jsonb_build_object('members',(select jsonb_agg(to_jsonb(x) order by user_id) from public.hub_members x where workspace_id='${f.workspace}'),'contracts',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_contracts x where workspace_id='${f.workspace}'),'documents',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_private_documents x where workspace_id='${f.workspace}'),'bills',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_internal_bills x where workspace_id='${f.workspace}'),'events',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_registry_events x where workspace_id='${f.workspace}'))::text)`)
 const before=digest();await frontend(baseline,'anterior')
 for(const version of versions){
  const phase=join(root,version),dir=join(phase,'supabase');mkdirSync(join(dir,'migrations'),{recursive:true});copyFileSync('supabase/config.toml',join(dir,'config.toml'));for(const name of readdirSync('supabase/migrations').filter(n=>n.slice(0,14)<=version))copyFileSync(join('supabase/migrations',name),join(dir,'migrations',name))
  const output=cli(['db','push','--local','--skip-vault','--dry-run','--yes','--workdir',phase,'--output-format','stream-json'])
  const report=output.split(/\r?\n/).flatMap(l=>{try{const o=JSON.parse(l);return[o.type==='result'?o.data:o]}catch{return[]}}).find(o=>o.migrations)
  if(report?.migrations?.length!==1||!report.migrations[0].startsWith(version))throw Error('Dry-run não exclusivo')
  cli(['db','push','--local','--skip-vault','--yes','--workdir',phase]);if(digest()!==before)throw Error('Registros existentes alterados')
  await frontend(baseline,'anterior-'+version)
 }
 if(sql('select generation_enabled or mail_enabled or not sandbox_only from hub_private.notice_settings')!=='f')throw Error('Envio ou geração ativados pela migração')
 if((await f.restricted.client.from('hub_proposals').select('record')).error?.code!=='42501'||sql("select public::text from storage.buckets where id='hub-private-documents'")!=='false')throw Error('Proteções alteradas')
 await frontend(candidate,'candidato');await frontend(baseline,'recuperacao')
 if(digest()!==before)throw Error('Consultas alteraram registros')
 writeFileSync('.validation/notices-upgrade-result.json',JSON.stringify({candidate,baseline,versions,exclusiveDryRuns:true,preserved:true,previousFrontend:true,recovery:true,disabled:true,result:'passed'},null,2));console.log('Expansões e recuperação aprovadas; dados, permissões e flags preservados.')
}finally{await browser.close();cli(['db','reset','--local','--no-seed','--yes'])}
