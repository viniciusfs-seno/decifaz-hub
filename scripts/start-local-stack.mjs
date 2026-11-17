import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
export async function startLocalStack(){
 if(!/^project_id\s*=\s*"decifaz-hub-e2e"/m.test(readFileSync('supabase/config.toml','utf8')))throw Error('Pilha de teste inesperada')
 for(let attempt=1;attempt<=3;attempt++){
  const result=spawnSync('npx',['--yes','supabase@3.0.0','start'],{encoding:'utf8',shell:process.platform==='win32'})
  if(result.status===0){console.log('Supabase local de testes iniciado; credenciais mantidas fora dos logs.');return}
  const transient=/address already in use|port is already allocated|failed to bind host port/i.test(result.stderr)
  if(!transient||attempt===3)throw Error('Falha ao iniciar Supabase local'+(transient?': porta do Docker ainda ocupada.':'. Verifique o runtime Docker do runner.'))
  console.log('Aguardando liberação transitória de porta do Docker (tentativa '+attempt+').')
  await new Promise(r=>setTimeout(r,3000))
 }
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))await startLocalStack()
