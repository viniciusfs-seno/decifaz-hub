import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync,symlinkSync,existsSync,rmSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Confirme a recriação da pilha fictícia com --reset-local-fixtures.')
const shell=process.platform==='win32'
const run=(command,args,options={})=>{
 const result=spawnSync(command,args,{encoding:'utf8',shell:(command==='npx'||command==='npm')&&shell,...options})
 if(result.status!==0)throw Error(result.stderr||'Falha em '+command)
 return result.stdout
}
const values=Object.fromEntries(run('npx',['--yes','supabase@3.0.0','status','-o','env']).split(/\r?\n/).flatMap(line=>{
 const m=line.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]
}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente a pilha local é permitida.')
const env={...process.env,HUB_TRANSITION_E2E:'1',HUB_REAL_E2E:'1',VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,
 VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
if(!env.VITE_SUPABASE_PUBLISHABLE_KEY||!env.HUB_TEST_ADMIN_KEY)throw Error('Chaves locais ausentes.')
run(process.execPath,['scripts/prepare-role-artifacts.mjs'])
env.HUB_ROLE_ARTIFACTS=resolve('.validation/role-release',run('git',['rev-parse','HEAD']).trim())
for(const [name,sha] of [['previous','8357a4ac49b1d29fa0589768018f827234ccc896'],['bridge','e1292085040722023f1331a24139620c2df25ca4']]){
 const directory=resolve('.validation',name)
 mkdirSync(directory,{recursive:true})
 const archive=spawnSync('git',['archive',sha,'src','index.html','package.json'],{maxBuffer:10*1024*1024})
 if(archive.status!==0)throw Error('Snapshot Git indisponível: '+sha)
 run('tar',['-xf','-','-C',directory],{input:archive.stdout})
 writeFileSync(resolve(directory,'vite.config.mjs'),"export default {cacheDir:'.cache'}\n")
 if(!existsSync(resolve(directory,'node_modules')))symlinkSync(resolve('node_modules'),resolve(directory,'node_modules'),'junction')
 run(process.execPath,[resolve('node_modules/vite/bin/vite.js'),'build',directory],{env})
 console.log(`Build ${name}: passou no SHA ${sha}.`)
}
const functionsRoot=resolve('supabase/functions')
const fixture=resolve(functionsRoot,'hub-workspaces-legacy-test')
if(dirname(fixture)!==functionsRoot)throw Error('Caminho de fixture fora do diretório permitido.')
if(existsSync(fixture))throw Error('A fixture temporária já existe; revise-a antes de executar novamente.')
mkdirSync(fixture,{recursive:true})
writeFileSync(resolve(fixture,'index.ts'),run('git',['show','8357a4ac49b1d29fa0589768018f827234ccc896:supabase/functions/hub-workspaces/index.ts']))
const configPath=resolve('supabase/config.toml')
const originalConfig=readFileSync(configPath,'utf8')
const testConfig=originalConfig+'\n[functions.hub-workspaces-legacy-test]\nverify_jwt = false\n'
let result=1
try{
 writeFileSync(configPath,testConfig)
 // Reload the local Edge routing configuration for the generated legacy fixture.
 run('npx',['--yes','supabase@3.0.0','stop'])
 run('npx',['--yes','supabase@3.0.0','start'])
 console.log('Recriando somente a pilha fictícia local na versão anterior aos papéis.')
 run('npx',['--yes','supabase@3.0.0','db','reset','--local','--version','20261114181046'])
 result=spawnSync('npx',['playwright','test','--config','playwright.transition.config.mjs'],{env,shell,stdio:'inherit'}).status??1
}finally{
 if(readFileSync(configPath,'utf8')!==testConfig)throw Error('Configuração alterada durante o teste; preserve a alteração e revise a limpeza local.')
 writeFileSync(configPath,originalConfig)
 // Exact generated fixture path inside this checkout, never a user directory.
 rmSync(fixture,{recursive:true,force:true})
 console.log('Restaurando a pilha fictícia local com todas as migrações atuais.')
 run('npx',['--yes','supabase@3.0.0','db','reset','--local'])
}
process.exit(result)
