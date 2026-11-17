import {spawnSync} from 'node:child_process'
import {createServer} from 'vite'
import {operationalFixture} from '../e2e/helpers/operational-fixture.mjs'

// Review server binds to loopback and cannot connect to a remote database.
// Fake passwords, sessions and the local service key remain in process memory.
const result=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell:process.platform==='win32'})
if(result.status!==0)throw Error('Inicie a pilha local.')
const values=Object.fromEntries(result.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente ambiente isolado local.')
const env={VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
const fixture=await operationalFixture(env)
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const personas={admin:fixture.owner,comercial:fixture.restricted,segunda:fixture.second}
const server=await createServer({server:{host:'127.0.0.1',port:4190,strictPort:true},plugins:[{
 name:'local-fictitious-review-only',
 configureServer(server){server.middlewares.use(async(req,res,next)=>{
  const path=req.url?.split('?')[0],name=path?.replace('/__preview/','')
  if(!path?.startsWith('/__preview/'))return next()
  const person=personas[name]
  if(!person){res.statusCode=404;return res.end('Perfil fictício não encontrado')}
  const {data,error}=await person.client.auth.signInWithPassword({email:person.email,password:person.password})
  if(error){res.statusCode=503;return res.end('Sessão fictícia indisponível')}
  res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store')
  res.end('<script>localStorage.setItem("sb-127-auth-token",'+JSON.stringify(JSON.stringify(data.session))+');location.replace("/")</script>')
 })},
 transformIndexHtml(html){return html.replace('<body>','<body><div style="padding:7px 16px;background:#ffeddf;color:#1f2433;font:13px system-ui">PRÉVIA LOCAL · dados fictícios · <a href="/__preview/admin">Administração</a> · <a href="/__preview/comercial">Comercial</a> · <a href="/__preview/segunda">Segunda sessão admin</a></div>')},
}]})
await server.listen()
console.log('Prévia integrada: http://127.0.0.1:4190/__preview/admin — somente dados fictícios locais.')
async function stop(){await server.close();await fixture.cleanup();process.exit()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
