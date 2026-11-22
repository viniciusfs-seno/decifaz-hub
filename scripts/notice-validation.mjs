import {spawnSync} from 'node:child_process'
const shell=process.platform==='win32'
const result=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell})
if(result.status!==0)throw Error('Inicie a pilha local de homologação.')
const vars=Object.fromEntries(result.stdout.split(/\r?\n/).flatMap(line=>{const m=line.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(vars.API_URL!=='http://127.0.0.1:54321')throw Error('Somente ambiente local descartável.')
const env={...process.env,VITE_SUPABASE_URL:vars.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:vars.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:vars.SECRET_KEY||vars.SERVICE_ROLE_KEY}
const run=spawnSync('node',['--test','supabase/tests/notices-server.mjs'],{env,stdio:'inherit',shell})
process.exit(run.status??1)
