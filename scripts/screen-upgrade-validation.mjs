import {spawnSync} from 'node:child_process'
import {mkdirSync,readFileSync,readdirSync,copyFileSync,writeFileSync} from 'node:fs'
import {resolve,join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {operationalFixture,checked} from '../e2e/helpers/operational-fixture.mjs'
import {registryFixture} from './registry-preview-fixture.mjs'
import {sql} from '../e2e/helpers/local-db.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Exige ambiente local descartável e --reset-local-fixtures; pare a prévia antes.')
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&process.platform==='win32',...extra});if(r.status!==0)throw Error('Ensaio local recusado: '+bin);return r.stdout}
const cli=args=>run('npx',['--yes','supabase@3.0.0',...args])
const values=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente ambiente local')
const env={VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const candidate=run('git',['rev-parse','HEAD']).trim(),version='20261121020000',file='supabase/migrations/'+version+'_tela_por_link.sql'
const introduction=run('git',['log','-1','--format=%H','--diff-filter=A','HEAD','--',file]).trim()
if(!introduction)throw Error('Histórico completo da migração necessário')
// Production now includes internal notices (#43), but not the older-dated screen migration.
const baseline=run('git',['rev-parse','510555b5dfa6d7ee016900852c6c844a35ece77b']).trim(),root=resolve('.validation/screen-upgrade-'+randomUUID())
run('git',['merge-base','--is-ancestor',baseline,candidate])
mkdirSync(root,{recursive:true});const browser=await chromium.launch();let f
async function frontend(ref,label){
 const source=join(root,label);mkdirSync(source,{recursive:true});const archive=spawnSync('git',['archive',ref,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:30*1024*1024});if(archive.status!==0)throw Error('Snapshot indisponível')
 run('tar',['-xf','-','-C',source],{input:archive.stdout,encoding:undefined});const server=await createServer({root:source,configFile:false,server:{host:'127.0.0.1',port:4186,strictPort:true}});await server.listen()
 const context=await browser.newContext(),page=await context.newPage()
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('http://127.0.0.1:4186')
  await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible();await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await expect(page.getByRole('button',{name:'Café Horizonte · fictício',exact:true})).toBeVisible()
  if(ref===candidate){await page.getByRole('navigation').getByRole('button',{name:'Base de conhecimento',exact:true}).click();await page.getByRole('button',{name:'Início diário dos sócios',exact:true}).click();await expect(page.getByRole('heading',{name:'Início diário dos sócios',exact:true})).toBeVisible()}
  console.log('Frontend '+label+': aprovado.')
 }finally{await context.close();await server.close()}
}
try{
 const basePhase=join(root,'published-schema');mkdirSync(basePhase,{recursive:true})
 const schema=spawnSync('git',['archive',baseline,'supabase/config.toml','supabase/migrations'],{maxBuffer:10*1024*1024});if(schema.status!==0)throw Error('Published schema unavailable')
 run('tar',['-xf','-','-C',basePhase],{input:schema.stdout,encoding:undefined})
 cli(['db','reset','--local','--no-seed','--yes','--workdir',basePhase])
 // Simulate the published operational flags without scheduling any local job.
 sql('update hub_private.notice_settings set generation_enabled=true,mail_enabled=false,sandbox_only=true')
 f=await operationalFixture(env);await registryFixture(f)
 await checked(f.admin.auth.admin.updateUserById(f.owner.id,{user_metadata:{name:'Marina Fictícia'}}))
 const digest=()=>sql(`select md5(jsonb_build_object('members',(select jsonb_agg(to_jsonb(x) order by user_id) from public.hub_members x where workspace_id='${f.workspace}'),'contracts',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_contracts x where workspace_id='${f.workspace}'),'documents',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_private_documents x where workspace_id='${f.workspace}'),'activities',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_activities x where workspace_id='${f.workspace}'),'events',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_registry_events x where workspace_id='${f.workspace}'),'bills',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_internal_bills x where workspace_id='${f.workspace}'))::text);`)
 const before=digest();await frontend(baseline,'anterior')
 const phase=join(root,'phase'),dir=join(phase,'supabase'),published=join(basePhase,'supabase','migrations');mkdirSync(join(dir,'migrations'),{recursive:true});copyFileSync('supabase/config.toml',join(dir,'config.toml'));for(const p of readdirSync(published))copyFileSync(join(published,p),join(dir,'migrations',p));copyFileSync(file,join(dir,'migrations',version+'_tela_por_link.sql'))
 const output=cli(['db','push','--local','--skip-vault','--include-all','--dry-run','--yes','--workdir',phase,'--output-format','stream-json'])
 const report=output.split(/\r?\n/).flatMap(l=>{try{const o=JSON.parse(l);return[o.type==='result'?o.data:o]}catch{return[]}}).find(o=>o.migrations)
 if(report?.migrations?.length!==1||!report.migrations[0].startsWith(version))throw Error('Dry-run não exclusivo')
 cli(['db','push','--local','--skip-vault','--include-all','--yes','--workdir',phase]);if(digest()!==before)throw Error('Registros anteriores alterados')
 if(sql('select generation_enabled and not mail_enabled and sandbox_only from hub_private.notice_settings')!=='t')throw Error('Notice flags changed')
 sql(readFileSync('supabase/tests/nomes_no_espaco.sql','utf8'))
 if(sql("select (has_function_privilege('anon','public.hub_screen_start(uuid,uuid,uuid,text)','execute') or has_table_privilege('authenticated','hub_private.screen_sessions','select'))::text")!=='false')throw Error('Permissão de tela inválida')
 const people=await checked(f.restricted.client.rpc('hub_registry_people',{w:f.workspace}));if(people.find(p=>p.id===f.owner.id)?.name!=='Marina Fictícia')throw Error('Nome não resolvido')
 if((await f.restricted.client.from('hub_proposals').select('record')).error?.code!=='42501'||sql("select public::text from storage.buckets where id='hub-private-documents'")!=='false')throw Error('Proteções alteradas')
 await frontend(baseline,'anterior-expandido');await frontend(candidate,'candidato');await frontend(baseline,'recuperacao')
 if(digest()!==before)throw Error('Frontend alterou registros ao consultar')
 writeFileSync('.validation/screen-upgrade-result.json',JSON.stringify({candidate,baseline,version,exclusiveDryRun:true,includeOlderMigration:true,noticeFlagsPreserved:true,preserved:true,previousFrontend:true,recovery:true,financialDenied:true,result:'passed'},null,2));console.log('Tela: expansão e recuperação do #43 aprovadas; registros, avisos e restrições preservados.')
}finally{await browser.close();cli(['db','reset','--local','--no-seed','--yes'])}
