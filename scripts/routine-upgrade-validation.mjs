import {spawnSync} from 'node:child_process'
import fs from 'node:fs'
import {resolve,join} from 'node:path'
import {sql} from '../e2e/helpers/local-db.mjs'
import {operationalFixture,checked} from '../e2e/helpers/operational-fixture.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Requer Supabase descartável, exclusivo e --reset-local-fixtures; nunca executar no ambiente da prévia.')
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx'&&process.platform==='win32',...extra});if(r.status)throw Error('Ensaio local falhou: '+bin);return r.stdout}
const cli=a=>run('npx',['--yes','supabase@3.0.0',...a])
const v=Object.fromEntries(cli(['status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}));if(v.API_URL!=='http://127.0.0.1:54321')throw Error('Somente banco local')
const baseline='16dba63864ecb514247ce87f7082b66ac7dbe787',root=resolve('.validation/routine-upgrade-'+crypto.randomUUID()),phase=join(root,'phase')
fs.mkdirSync(phase,{recursive:true});const archive=spawnSync('git',['archive',baseline,'supabase/config.toml','supabase/migrations'],{maxBuffer:10e6});if(archive.status)throw Error('Base publicada ausente');run('tar',['-xf','-','-C',phase],{input:archive.stdout,encoding:undefined})
let f
try{
 cli(['db','reset','--local','--no-seed','--yes','--workdir',phase]);f=await operationalFixture({VITE_SUPABASE_URL:v.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:v.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:v.SECRET_KEY||v.SERVICE_ROLE_KEY})
 const digest=()=>sql(`select md5(jsonb_build_object('members',(select jsonb_agg(to_jsonb(x) order by user_id) from hub_members x where workspace_id='${f.workspace}'),'leads',(select jsonb_agg(to_jsonb(x) order by id) from hub_leads x where workspace_id='${f.workspace}'),'proposals',(select jsonb_agg(to_jsonb(x) order by id) from hub_proposals x where workspace_id='${f.workspace}'),'receipts',(select jsonb_agg(to_jsonb(x) order by id) from hub_receipts x where workspace_id='${f.workspace}'))::text)`)
 const versions=fs.readdirSync('supabase/migrations').filter(f=>/^202611250[456]0000_/.test(f)).sort(),results=[]
 for(const filename of versions){const before=digest();fs.copyFileSync('supabase/migrations/'+filename,phase+'/supabase/migrations/'+filename);const dry=cli(['db','push','--local','--skip-vault','--dry-run','--yes','--workdir',phase,'--output-format','stream-json']),pending=[...new Set(dry.match(/2026\d{10}(?=_)/g)??[])];if(pending.length!==1||pending[0]!==filename.slice(0,14))throw Error('Migração não exclusiva');cli(['db','push','--local','--skip-vault','--yes','--workdir',phase]);if(digest()!==before)throw Error('Migração alterou dados existentes');sql("notify pgrst,'reload schema'")
  // Previous frontends keep using these contracts, including during recovery.
  const lead=await checked(f.owner.client.from('hub_leads').select('*').eq('id',f.prospect).single());const saved=await checked(f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:lead.revision,body:{name:lead.name,notes:'Frontend anterior fictício'}}));if(saved.status!=='saved'||saved.current.segment!==lead.segment)throw Error('Legado incompatível');if((await f.restricted.client.from('hub_proposals').select('record').eq('workspace_id',f.workspace)).error?.code!=='42501')throw Error('Revogação financeira perdida');results.push({migration:filename,preserved:true,legacyContract:true})
 }
 const current=await checked(f.owner.client.from('hub_leads').select('*').eq('id',f.prospect).single());const args={w:f.workspace,l:f.prospect,expected_revision:current.revision,operation_id:crypto.randomUUID(),body:{name:current.name,profile:{next_action_id:'followup',next:'Acompanhamento fictício',owner_id:f.owner.id,due:f.today}}};const saved=await checked(f.owner.client.rpc('hub_save_commercial_lead',args));if((await checked(f.owner.client.rpc('hub_save_commercial_lead',args))).activity_id!==saved.activity_id)throw Error('Reenvio duplicado')
 fs.writeFileSync('.validation/routine-upgrade-result.json',JSON.stringify({baseline,candidate:run('git',['rev-parse','HEAD']).trim(),results,previousFrontendRecovery:true,passed:true}));console.log('Migrações da rotina comercial exclusivas; dados e permissões preservados; contratos anteriores e reenvio compatíveis.')
}finally{if(f)await f.cleanup();cli(['db','reset','--local','--no-seed','--yes'])}
