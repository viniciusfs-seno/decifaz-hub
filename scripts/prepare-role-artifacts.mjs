// Offline only: no credentials, build, deployment or remote database commands.
import {spawnSync} from 'node:child_process'
import {mkdirSync,writeFileSync,readFileSync,readdirSync,existsSync} from 'node:fs'
import {resolve,relative,join} from 'node:path'
import {createHash} from 'node:crypto'
const git=(...args)=>{
 const p=spawnSync('git',args,{maxBuffer:32*1024*1024})
 if(p.status!==0)throw Error(p.stderr.toString())
 return p.stdout
}
const candidate=git('rev-parse',process.argv[2]||'HEAD').toString().trim()
const baseline='304922f4e13f22181e12032f31ea75e6eccec4be'
const expansion='supabase/migrations/20261114200000_expansao_compativel.sql'
const contracts=['supabase/migrations/20261114210000_papeis.sql','supabase/migrations/20261114220000_visible_scope_execute.sql']
const root=resolve('.validation/role-release',candidate)
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)])
if(existsSync(root)){
 const manifest=JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'))
 if(manifest.candidate!==candidate||manifest.baseline!==baseline)throw Error('Manifesto divergente.')
 if(walk(root).length!==manifest.files.length+1)throw Error('Inventário do artefato alterado.')
 for(const f of manifest.files){
  const path=resolve(root,f.path)
  if(!path.startsWith(root+'/')&&!path.startsWith(root+'\\'))throw Error('Caminho fora do artefato.')
  if(createHash('sha256').update(readFileSync(path)).digest('hex')!==f.sha256)throw Error('Artefato alterado: '+f.path)
 }
 console.log('Manifesto existente conferido: '+root)
 process.exit(0)
}
mkdirSync(root,{recursive:true})
const extract=(phase,ref,paths)=>{
 const directory=join(root,phase);mkdirSync(directory,{recursive:true})
 const p=spawnSync('tar',['-xf','-','-C',directory],{input:git('archive',ref,...paths)})
 if(p.status!==0)throw Error(p.stderr.toString())
}
extract('A-expansao',baseline,['supabase/config.toml','supabase/migrations','supabase/functions/hub-workspaces'])
extract('A-expansao',candidate,[expansion])
extract('B-edge',candidate,['supabase/config.toml','supabase/functions/hub-workspaces'])
const frontend=['src','public','index.html','package.json','package-lock.json','tsconfig.json','vite.config.ts','vercel.json']
extract('C-frontend',candidate,frontend)
extract('D-restricao',baseline,['supabase/config.toml','supabase/migrations'])
extract('D-restricao',candidate,[expansion,...contracts])
// Baseline predates vercel.json (the candidate disables preview deployment).
extract('recuperacao-antes-D',baseline,[...frontend.filter(p=>p!=='vercel.json'),'supabase/config.toml','supabase/functions/hub-workspaces'])
extract('recuperacao-depois-D',candidate,[...frontend,'supabase/config.toml','supabase/functions/hub-workspaces'])
const files=walk(root).sort().map(path=>({path:relative(root,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}))
if(files.some(f=>/(^|\/)\.env|\.temp|node_modules|\/dist\//.test(f.path)))throw Error('Arquivo proibido no artefato.')
if(files.some(f=>f.path.startsWith('A-expansao/')&&contracts.some(c=>f.path.endsWith(c))))throw Error('Restrição misturada à expansão.')
for(const [phase,count] of [['A-expansao',12],['D-restricao',14]]){
 if(files.filter(f=>f.path.startsWith(phase+'/supabase/migrations/')).length!==count)throw Error('Histórico inesperado em '+phase)
}
const manifest={candidate,baseline,warning:'Somente fontes; sem credenciais, papéis reais ou builds publicáveis. Config local: não substituir configuração remota inteira. B exige verify_jwt=false para hub-workspaces; validação JWT está no código. Não executar db push de D antes de A/B/C aprovados.',files}
writeFileSync(join(root,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(`Artefatos separados: ${root}; ${files.length} arquivos com SHA-256. Nenhuma publicação executada.`)
