import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
// Never persist or print the local service key. Never accept a remote URL.
const shell=process.platform==='win32'
const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell})
if(status.status!==0)throw Error('Inicie o Supabase local antes dos testes.')
const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(line=>{
 const match=line.match(/^([A-Z_]+)="(.*)"$/)
 return match?[[match[1],match[2]]]:[]
}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente a pilha local é permitida.')
const env={...process.env,HUB_REAL_E2E:'1',VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,
 VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
if(!env.VITE_SUPABASE_PUBLISHABLE_KEY||!env.HUB_TEST_ADMIN_KEY)throw Error('Chaves locais indisponíveis.')
for(const name of ['financeiro_jornada.sql','papeis_associacoes.sql','equipe.sql','historico_papeis.sql','convites.sql','integrantes_ativos.sql','revisao_operacional.sql','fechamentos.sql','identificacao_integrantes.sql']){
 const sql=spawnSync('docker',['exec','-i','supabase_db_decifaz-hub-e2e','psql','-U','postgres','-v','ON_ERROR_STOP=1'],{
  input:readFileSync(new URL('../supabase/tests/'+name,import.meta.url)),encoding:'utf8',shell,
 })
 if(sql.status!==0){process.stderr.write(sql.stderr);process.exit(sql.status??1)}
 console.log('SQL '+name+': passou; fixtures revertidas.')
}
const targets=process.argv.slice(2)
const result=spawnSync('npx',['playwright','test',...(targets.length?targets:['shared-real.spec.mjs','roles-real.spec.mjs','concurrency-real.spec.mjs','team-real.spec.mjs','team-concurrency-real.spec.mjs','role-history-real.spec.mjs','invites-real.spec.mjs','invite-auth-real.spec.mjs','member-state-real.spec.mjs','operational-real.spec.mjs','catalog-real.spec.mjs','meeting-studio-real.spec.mjs','management-real.spec.mjs','commercial-management-real.spec.mjs','experience-real.spec.mjs','lead-details-real.spec.mjs','crm-pagination-real.spec.mjs','metric-history-real.spec.mjs','hierarchy-real.spec.mjs','record-work-real.spec.mjs','global-search-real.spec.mjs','prospecting-real.spec.mjs','productivity-real.spec.mjs','activity-work-real.spec.mjs','activity-clock-real.spec.mjs','workspace-refresh-real.spec.mjs','import-real.spec.mjs','project-meetings-real.spec.mjs','internal-finance-real.spec.mjs','contracts-real.spec.mjs','workbench-real.spec.mjs','daily-use-real.spec.mjs'])],{env,stdio:'inherit',shell})
process.exit(result.status??1)
