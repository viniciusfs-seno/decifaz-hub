// Provider key never leaves this server module. No request/response logging.
export async function issueTurn({keyId,apiToken,ttl,provider='cloudflare',ident,secret,channel},fetcher=fetch){
 if(!Number.isInteger(ttl)||ttl<1||ttl>1800||!['cloudflare','xirsys'].includes(provider))throw Error('TURN indisponível')
 const xirsys=provider==='xirsys'
 if(xirsys?(!ident||!secret||!channel||!/^[-a-zA-Z0-9_]{1,100}$/.test(channel)):(!keyId||!apiToken))throw Error('TURN indisponível')
 const endpoint=xirsys?'https://global.xirsys.net/_turn/'+encodeURIComponent(channel)+'?webrtc=1&expire='+ttl:'https://rtc.live.cloudflare.com/v1/turn/keys/'+encodeURIComponent(keyId)+'/credentials/generate-ice-servers'
 const response=await fetcher(endpoint,{
  method:xirsys?'PUT':'POST',headers:{Authorization:xirsys?'Basic '+btoa(ident+':'+secret):'Bearer '+apiToken,'Content-Type':'application/json'},body:JSON.stringify(xirsys?{}:{ttl}),signal:AbortSignal.timeout(8000),
 })
 if(!response.ok)throw Error('TURN indisponível')
 const data=await response.json();if(xirsys&&data.s!=='ok')throw Error('TURN indisponível')
 const source=xirsys?data.v?.iceServers:data.iceServers,rows=Array.isArray(source)?source:[source]
 if(!rows.length||rows.length>8)throw Error('TURN indisponível')
 const iceServers=rows.map(row=>{
  if(!row||typeof row!=='object')throw Error('TURN indisponível')
  const urls=Array.isArray(row.urls)?row.urls:[row.urls]
  const allowed=u=>xirsys?/^(stun:|turns?:)[a-z0-9-]+\.xirsys\.com(?::(3478|5349|443|80))?(\?transport=(udp|tcp))?$/.test(u):/^turns?:turn\.cloudflare\.com:(3478|5349|443|80)(\?transport=(udp|tcp))?$/.test(u)||u==='stun:stun.cloudflare.com:3478'
  if(!urls.length||urls.length>12||urls.some(u=>typeof u!=='string'||!allowed(u)))throw Error('TURN indisponível')
  const relay=urls.some(u=>u.startsWith('turn'))
  if(relay&&(typeof row.username!=='string'||!row.username||typeof row.credential!=='string'||!row.credential))throw Error('TURN indisponível')
  return {urls,...(relay?{username:row.username,credential:row.credential}:{})}
 })
 if(!iceServers.some(r=>r.urls.some(u=>u.startsWith('turn'))))throw Error('TURN indisponível')
 return {enabled:true,iceServers,ttl}
}

export function turnHandler({enabled,authorize,issue}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'}
 return async request=>{
  const json=(body,status=200)=>Response.json(body,{headers,status})
  if(request.method==='OPTIONS')return new Response(null,{headers})
  if(request.method!=='POST')return json({error:'Método inválido.'},405)
  if(!enabled)return json({enabled:false})
  try{
   if(Number(request.headers.get('content-length')??0)>2048)return json({error:'Pedido inválido.'},400)
   const text=await request.text();if(text.length>2048)return json({error:'Pedido inválido.'},400)
   const args=JSON.parse(text)
   if(!/^[0-9a-f-]{36}$/i.test(args.s??'')||args.viewer!=null&&!/^[0-9a-f-]{36}$/i.test(args.viewer)||args.credential!=null&&!/^[A-Za-z0-9_-]{43}$/.test(args.credential))return json({error:'Pedido inválido.'},400)
   const result=await authorize(request,{s:args.s,credential:args.credential??null,viewer:args.viewer??null})
   if(result.error||!Number.isInteger(result.data?.ttl)||result.data.ttl<1||result.data.ttl>1800)return json({error:'Emissão não autorizada ou limitada.'},403)
   return json(await issue(result.data.ttl))
  }catch{return json({error:'Retransmissão indisponível. Use a chamada externa.'},503)}
 }
}
