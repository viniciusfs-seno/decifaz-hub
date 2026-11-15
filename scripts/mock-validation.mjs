import {spawnSync} from 'node:child_process'
const options={shell:process.platform==='win32',stdio:'inherit',env:{...process.env,VITE_HUB_MODE:'shared',
 VITE_SUPABASE_URL:'https://mock-hub.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'}}
const build=spawnSync('npm',['run','build'],options)
if(build.status!==0)process.exit(build.status??1)
const result=spawnSync('npx',['playwright','test','shared-finance.spec.mjs','central-knowledge.spec.mjs'],options)
process.exit(result.status??1)
