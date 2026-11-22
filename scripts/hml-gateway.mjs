import {createServer,request as httpRequest} from 'node:http'
import {randomBytes,timingSafeEqual} from 'node:crypto'
import {readFile,writeFile,stat} from 'node:fs/promises'
import {resolve,extname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {spawnSync} from 'node:child_process'
import {commercialFixture} from './commercial-preview-fixture.mjs'
import {registryFixture} from './registry-preview-fixture.mjs'

const cookieName='__Host-decifaz_hml'
const page=body=>'<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Homologação · Decifaz Hub</title><style>body{font:16px system-ui;background:#f5f6fa;color:#1f2433;border-top:5px solid #ff6a13;margin:0}main{max-width:460px;margin:8vh auto;padding:26px}input,button,a{font:inherit}input,button{padding:12px;border-radius:8px;border:1px solid #8f9ab3}label{display:grid;gap:10px}button{background:#ff6a13;margin-top:16px;cursor:pointer}a{color:#3a4a6f;display:block;padding:15px;background:white;margin:12px 0;border-radius:8px}p{line-height:1.6}</style><main><h1>Decifaz Hub</h1>'+body+'</main></html>'
const login=page('<h2>Homologação protegida</h2><p>Operacional, Comercial e Gerencial · somente dados fictícios.</p><form method="post" action="/__review/login"><label>Senha de revisão<input required name="password" type="password" autocomplete="current-password"></label><button>Entrar na homologação</button></form>')
const home=page('<h2>Escolha um perfil fictício</h2><p>Não use seu e-mail ou dados reais. Os perfis abaixo pertencem apenas a esta homologação.</p><a href="/__review/persona/admin">Administração</a><a href="/__review/persona/comercial">Comercial · acesso restrito</a><a href="/__review/persona/segunda">Segunda sessão administrativa</a><p><a href="/">Continuar no Hub</a></p><form method="post" action="/__review/logout"><button>Encerrar acesso à prévia</button></form>')
export function createGateway({origin,password,root,fixture,publicKey,sha='test',expires=Date.now()+86400000,upstream='http://127.0.0.1:54321'}){
 if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)||password.length<20||upstream!=='http://127.0.0.1:54321')throw Error('Configuração de homologação inválida')
 const sessions=new Map(),attempts=new Map(),personas={admin:fixture.owner,comercial:fixture.restricted,segunda:fixture.second}
 // Synthetic cross-network probe only, protected by the review cookie. Bearer
 // material stays in process memory and is neither logged nor written to disk.
 let screenProbe,screenProgress={phase:'waiting'}
 const storageKey='sb-'+new URL(origin).hostname.split('.')[0]+'-auth-token'
 const allowed=/^\/(auth\/v1\/(?:token|otp|verify|user|logout|signup|settings|recover)(?:\?|$)|rest\/v1\/|functions\/v1\/hub-workspaces(?:\?|$)|storage\/v1\/object\/(?:authenticated\/)?hub-private-documents\/[0-9a-f-]{36}\/(?:contract|bill)\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf(?:\?|$))/
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','strict-origin')
  res.setHeader('Permissions-Policy','display-capture=(self),camera=(),microphone=()')
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' "+origin.replace('https:','wss:')+"; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
  const send=(status,body,type='text/html; charset=utf-8')=>{res.statusCode=status;res.setHeader('Content-Type',type);res.end(body)}
  try{
   const url=new URL(req.url,origin),path=url.pathname
   if(path==='/__health')return send(200,JSON.stringify({status:'protected',candidate:sha,isolated:true,expires:new Date(expires).toISOString()}),'application/json')
   if(Date.now()>expires)return send(410,page('<p>Esta homologação expirou.</p>'))
   if(req.headers.origin&&req.headers.origin!==origin)return send(403,'Origem recusada','text/plain')
   let body=Buffer.alloc(0)
   const limit=path.startsWith('/__supabase/storage/v1/object/')?11*1024*1024:2*1024*1024
   for await(const chunk of req){body=Buffer.concat([body,chunk]);if(body.length>limit)return send(413,'Limite excedido','text/plain')}
   if(path==='/__review/login'&&req.method==='POST'){
    const ip=req.headers['cf-connecting-ip']??req.socket.remoteAddress,now=Date.now(),recent=(attempts.get(ip)??[]).filter(t=>t>now-60000);recent.push(now);attempts.set(ip,recent)
    if(recent.length>15)return send(429,'Aguarde para tentar novamente.','text/plain')
    const value=new URLSearchParams(body.toString()).get('password')??'',a=Buffer.from(value),b=Buffer.from(password)
    if(a.length!==b.length||!timingSafeEqual(a,b))return send(401,login)
    const token=randomBytes(32).toString('base64url');sessions.set(token,Math.min(expires,now+8*3600000))
    res.setHeader('Set-Cookie',cookieName+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=28800');res.writeHead(303,{Location:'/__review'});return res.end()
   }
   const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)
   if(!token||(sessions.get(token)??0)<Date.now())return path.startsWith('/__supabase')?send(401,'{"error":"review_access_required"}','application/json'):send(401,login)
   if(path==='/__review/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie',cookieName+'=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0');res.writeHead(303,{Location:'/'});return res.end()}
   if(path==='/__review')return send(200,home)
   if(path==='/__review/screen-progress'){
    if(req.method==='GET')return send(200,JSON.stringify(screenProgress),'application/json')
    if(req.method==='POST'){
     const value=JSON.parse(body.toString())
     if(!['waiting','frames','disconnect','recovered','expire-invite','invite-expired','stop','ended','second','second-frames','expire-session','session-expired','done','failed'].includes(value.phase))return send(400,'{}','application/json')
     screenProgress={phase:value.phase};return send(200,'{}','application/json')
    }
    return send(405,'{}','application/json')
   }
   if(path==='/__review/screen-probe'){
    if(req.method==='DELETE'){screenProbe=undefined;return send(200,'{}','application/json')}
    if(req.method==='POST'){
     const value=JSON.parse(body.toString())
     if(!/^[0-9a-f-]{36}$/.test(value.id)||!/^[A-Za-z0-9_-]{43}$/.test(value.credential))return send(400,'{}','application/json')
     screenProbe={id:value.id,credential:value.credential,until:Date.now()+600000};return send(200,'{}','application/json')
    }
    if(req.method==='GET')return send(screenProbe&&screenProbe.until>Date.now()?200:404,screenProbe&&screenProbe.until>Date.now()?JSON.stringify(screenProbe):'{}','application/json')
    return send(405,'{}','application/json')
   }
   if(path==='/__review/fixtures')return send(200,JSON.stringify({workspace:fixture.workspace,other:fixture.other,lead:fixture.lead,prospect:fixture.prospect,meetingLead:fixture.meetingLead,meeting:fixture.meeting,admin:fixture.owner.id,second:fixture.second.id,restricted:fixture.restricted.id,publicKey,api:origin+'/__supabase'}),'application/json')
   if(path.startsWith('/__review/persona/')){
    const person=personas[path.split('/').at(-1)];if(!person)return send(404,'Perfil inexistente','text/plain')
    const {data,error}=await person.client.auth.signInWithPassword({email:person.email,password:person.password});if(error)return send(503,'Perfil fictício indisponível','text/plain')
    return send(200,'<script>localStorage.setItem('+JSON.stringify(storageKey)+','+JSON.stringify(JSON.stringify(data.session))+');location.replace("/")</script>')
   }
   if(path.startsWith('/__review/auth-start/')){
    const person=personas[path.split('/').at(-1)];if(!person)return send(404,'Perfil inexistente','text/plain')
    const {error}=await person.client.auth.signInWithOtp({email:person.email,options:{shouldCreateUser:false,emailRedirectTo:origin+'/'}});if(error)return send(503,'Auth fictício indisponível','text/plain')
    let link
    for(let n=0;n<30&&!link;n++){
     const mailbox=await (await fetch('http://127.0.0.1:54324/api/v1/messages')).json()
     const message=mailbox.messages?.find(m=>m.To?.some(t=>t.Address===person.email))
     if(message){const mail=await(await fetch('http://127.0.0.1:54324/api/v1/message/'+message.ID)).json();link=mail.HTML?.match(/href="([^"]*\/auth\/v1\/verify[^\"]+)"/)?.[1]?.replaceAll('&amp;','&')}
     if(!link)await new Promise(r=>setTimeout(r,300))
    }
    if(!link)return send(503,'E-mail fictício não chegou ao Mailpit','text/plain')
    const verified=new URL(link);if(verified.origin!==upstream||verified.pathname!=='/auth/v1/verify')return send(503,'Destino Auth inesperado','text/plain')
    // SMTP stays entirely in Mailpit. Only the host of its fictitious link is
    // translated to this protected proxy; token/query are never logged.
    res.writeHead(302,{Location:origin+'/__supabase'+verified.pathname+verified.search});return res.end()
   }
   if(path.startsWith('/__supabase/')){
    const target=path.slice('/__supabase'.length)+url.search;if(!allowed.test(target))return send(404,'Rota não exposta','text/plain')
    if(req.method==='POST'&&/^\/auth\/v1\/(otp|signup|recover)/.test(target)){
     const payload=JSON.parse(body.toString());if(payload.email&&!/^[^@]+@example\.invalid$/.test(payload.email))return send(400,'{"error":"use_fictitious_accounts"}','application/json')
    }
    const headers={...req.headers};for(const h of ['host','cookie','content-length','connection','accept-encoding'])delete headers[h]
    const response=await fetch(upstream+target,{method:req.method,headers,body:['GET','HEAD'].includes(req.method)?undefined:body,redirect:'manual'})
    for(const [key,value] of response.headers)if(!['set-cookie','cache-control','content-length','content-encoding','transfer-encoding','connection','access-control-allow-origin'].includes(key))res.setHeader(key,value)
    const location=response.headers.get('location')
    if(location){const dest=new URL(location,upstream);if(dest.origin===upstream)res.setHeader('Location',origin+'/__supabase'+dest.pathname+dest.search+dest.hash);else if(dest.origin!==origin)return send(502,'Retorno Auth fora da homologação','text/plain')}
    res.statusCode=response.status;return res.end(Buffer.from(await response.arrayBuffer()))
   }
   if(req.method!=='GET')return send(405,'Método recusado','text/plain')
   const file=resolve(root,'.'+decodeURIComponent(path==='/'||path==='/assistir'?'/index.html':path));if(!file.startsWith(resolve(root)+'/')&&!file.startsWith(resolve(root)+'\\'))return send(404,'Não encontrado','text/plain')
   const info=await stat(file).catch(()=>null);if(!info?.isFile())return send(404,'Não encontrado','text/plain')
   let content=await readFile(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'}
   if(extname(file)==='.html')content=Buffer.from(content.toString().replace('<body>','<body><div style="padding:8px 16px;background:#ffeddf;color:#1f2433;font:13px system-ui">HOMOLOGAÇÃO · DADOS FICTÍCIOS · <a href="/__review">Trocar perfil</a> · candidato '+sha.slice(0,7)+'</div>'))
   return send(200,content,types[extname(file)]??'application/octet-stream')
  }catch{return send(502,'Homologação temporariamente indisponível','text/plain')}
 })
 server.on('upgrade',(req,socket,head)=>{
  const token=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1),until=Math.min(expires,sessions.get(token)??0)
  let url;try{url=new URL(req.url,origin)}catch{socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');return}
  if(until<Date.now()||req.headers.origin!==origin||!/^\/__supabase\/realtime\/v1\/websocket\/?$/.test(url.pathname)){
   socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');return
  }
  const headers={...req.headers,host:'127.0.0.1:54321'};delete headers.cookie
  const proxy=httpRequest(upstream+url.pathname.slice('/__supabase'.length)+url.search,{headers,method:'GET'})
  proxy.on('upgrade',(response,upstreamSocket,upstreamHead)=>{
   socket.write('HTTP/1.1 101 Switching Protocols\r\n'+Object.entries(response.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n')
   if(upstreamHead.length)socket.write(upstreamHead);if(head.length)upstreamSocket.write(head)
   const timer=setTimeout(()=>{socket.destroy();upstreamSocket.destroy()},until-Date.now());timer.unref()
   socket.pipe(upstreamSocket);upstreamSocket.pipe(socket)
   socket.on('close',()=>{clearTimeout(timer);upstreamSocket.destroy()});upstreamSocket.on('error',()=>socket.destroy());socket.on('error',()=>upstreamSocket.destroy())
  })
  proxy.on('response',()=>socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n'))
  proxy.on('error',()=>socket.destroy());socket.on('error',()=>proxy.destroy());proxy.end()
 })
 return server
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 let input='';for await(const data of process.stdin)input+=data
 const {origin,password}=JSON.parse(input),shell=process.platform==='win32'
 const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell})
 const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
 if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente pilha local')
 const env={...process.env,VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:origin+'/__supabase',VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY}
 const root=resolve('.validation/hml-dist'),build=spawnSync('npx',['vite','build','--outDir',root],{env,encoding:'utf8',shell})
 if(build.status!==0)throw Error('Build de homologação recusado')
 const fixture=await commercialFixture({VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY})
 await registryFixture(fixture)
 const foreign=await fixture.admin.from('hub_leads').insert({workspace_id:fixture.other,name:'Registro isolado fictício',segment:'Teste',city:'Fortaleza',stage:'Identificado',profile:{}})
 if(foreign.error){await fixture.cleanup();throw Error('Falha na fixture de isolamento')}
 const sha=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim(),expires=Date.now()+86400000
 const server=createGateway({origin,password,root,fixture,publicKey:values.PUBLISHABLE_KEY,sha,expires})
 await new Promise(r=>server.listen(4195,'127.0.0.1',r))
 await writeFile('.validation/hml-public.json',JSON.stringify({origin,sha,expires:new Date(expires).toISOString(),scope:'local-fictitious-only'}))
 console.log(JSON.stringify({ready:true,origin,sha,expires:new Date(expires).toISOString()}))
 setTimeout(()=>server.close(async()=>{await fixture.cleanup();process.exit()}),86400000).unref()
}
