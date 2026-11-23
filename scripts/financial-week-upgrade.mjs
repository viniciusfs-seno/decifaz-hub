import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import {resolve,join} from 'node:path'
import {sql} from '../e2e/helpers/local-db.mjs'
import {operationalFixture,checked} from '../e2e/helpers/operational-fixture.mjs'
import {registryFixture} from './registry-preview-fixture.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Discardable local only')
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&process.platform==='win32',...extra});if(r.status)throw Error('Local upgrade failed: '+bin);return r.stdout}
const cli=a=>run('npx',['--yes','supabase@3.0.0',...a])
const v=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}));if(v.API_URL!=='http://127.0.0.1:54321')throw Error('Local only')
const baseline='12f94ca69b6427932cf239170956997003f8181e',version='20261123010000',root=resolve('.validation/financial-upgrade-'+crypto.randomUUID()),phase=join(root,'phase')
fs.mkdirSync(phase,{recursive:true});const archive=spawnSync('git',['archive',baseline,'supabase/config.toml','supabase/migrations'],{maxBuffer:10e6});if(archive.status)throw Error('Published history missing');run('tar',['-xf','-','-C',phase],{input:archive.stdout,encoding:undefined})
let f
try{
 cli(['db','reset','--local','--no-seed','--yes','--workdir',phase]);sql('update hub_private.notice_settings set generation_enabled=true,mail_enabled=false,sandbox_only=true')
 f=await operationalFixture({VITE_SUPABASE_URL:v.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:v.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:v.SECRET_KEY||v.SERVICE_ROLE_KEY});await registryFixture(f)
 const digest=()=>sql(`select md5(jsonb_build_object('members',(select jsonb_agg(to_jsonb(x) order by user_id) from public.hub_members x where workspace_id='${f.workspace}'),'bills',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_internal_bills x where workspace_id='${f.workspace}'),'events',(select jsonb_agg(to_jsonb(x) order by id) from public.hub_registry_events x where workspace_id='${f.workspace}'))::text)`)
 const before=digest();fs.copyFileSync('supabase/migrations/'+version+'_revisao_financeira_semanal.sql',phase+'/supabase/migrations/'+version+'_revisao_financeira_semanal.sql')
 const output=cli(['db','push','--local','--skip-vault','--dry-run','--yes','--workdir',phase,'--output-format','stream-json']),found=[...new Set(output.match(/2026\d{10}(?=_)/g)??[])];if(found.length!==1||found[0]!==version)throw Error('Dry-run not exclusive')
 cli(['db','push','--local','--skip-vault','--yes','--workdir',phase]);if(digest()!==before||sql('select generation_enabled and not mail_enabled and sandbox_only from hub_private.notice_settings')!=='t')throw Error('Preservation failed')
 const start=sql("select date_trunc('week',clock_timestamp() at time zone 'America/Fortaleza')::date")
 const report=await checked(f.owner.client.rpc('hub_financial_week',{w:f.workspace,start_on:start}));if(Number(report.totals.received)!==800)throw Error('Report mismatch')
 if((await f.restricted.client.rpc('hub_financial_week',{w:f.workspace,start_on:start})).error?.code!=='42501')throw Error('Permission guard')
 // Previous frontend uses unchanged tables/RPCs; its operational close remains usable.
 await checked(f.owner.client.rpc('hub_close_week',{w:f.workspace,start_on:start,expected_revision:0,summary_text:'Fechamento operacional fictício compatível',decision_text:'',planned:[]}))
 if(!(await checked(f.owner.client.from('hub_weekly_closure_history').select('revision').eq('workspace_id',f.workspace))).length)throw Error('Previous contract incompatible')
 fs.writeFileSync('.validation/financial-upgrade-result.json',JSON.stringify({baseline,candidate:run('git',['rev-parse','HEAD']).trim(),exclusive:version,preserved:true,noticeFlags:true,oldOperationalContract:true,recovery:'retain additive schema; rollback frontend to PR40',passed:true}));console.log('Financial migration exclusive; business data/flags/old operational contracts preserved.')
}finally{await f?.cleanup();cli(['db','reset','--local','--no-seed','--yes'])}
