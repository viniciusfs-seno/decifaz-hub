// Shared by the Edge worker and the isolated Mailpit rehearsal. Never logs an
// envelope, recipient, provider response body or authorization header.
const localHost=h=>['localhost','127.0.0.1','host.docker.internal','kong','inbucket','supabase_inbucket_decifaz-hub-e2e'].includes(h)
const fake=e=>/^[^\s<>]+@example\.invalid$/i.test(e)
export function workerConfig(env){
 const mode=env.HUB_NOTICE_MODE||'off'
 if(mode==='off')return {mode}
 const portal=new URL(env.HUB_NOTICE_PORTAL_URL||'https://decifaz-hub.vercel.app/')
 if(portal.username||portal.password||portal.protocol!=='https:'&&!localHost(portal.hostname))throw Error('configuration')
 // Links contain no record ids, personal data or authentication credentials.
 portal.pathname='/';portal.search='central=1';portal.hash=''
 const from=env.HUB_NOTICE_FROM||'avisos@example.invalid'
 if(!/^[^\s<>]+@[^\s<>]+\.[^\s<>]+$/.test(from))throw Error('configuration')
 if(mode==='mailpit'){
  const target=new URL(env.HUB_NOTICE_MAILPIT_URL||'http://127.0.0.1:54324')
  if(target.protocol!=='http:'||!localHost(target.hostname)||!localHost(new URL(env.SUPABASE_URL).hostname)||!fake(from))throw Error('sandbox_guard')
  return {mode,from,portal:portal.href,target:target.origin}
 }
 if(mode!=='resend'||env.HUB_NOTICE_REAL_SEND!=='approved'||!env.HUB_NOTICE_RESEND_KEY)throw Error('configuration')
 return {mode,from,portal:portal.href,key:env.HUB_NOTICE_RESEND_KEY,target:'https://api.resend.com'}
}
const rpc=async(client,name,args)=>{const r=await client.rpc(name,args);if(r.error)throw Error('database');return r.data}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
export async function processNotices(client,config,{fetcher=fetch,beforeSend=async()=>{},pace=500,limit=5}={}){
 const summary={claimed:0,accepted:0,delivered:0,suppressed:0,retry:0,failed:0,uncertain:0}
 if(config.mode==='off')return summary
 for(let count=0;count<Math.min(5,Math.max(0,limit));count++){
  const claim=await rpc(client,'hub_notice_claim',{});if(!claim)break
  summary.claimed++;const args={i:claim.id,l:claim.lease}
  const ack=async(outcome,code=null,provider_message=null)=>{await rpc(client,'hub_notice_ack',{...args,outcome,code,provider_message});summary[outcome]++}
  let prepared=await rpc(client,'hub_notice_prepare',args)
  if(!prepared){summary.suppressed++;continue}
  if(config.mode==='mailpit'&&!fake(prepared.to)||config.mode==='resend'&&prepared.sandbox_only){await ack('suppressed','sandbox_guard');continue}
  if(prepared.provider&&prepared.provider!==config.mode){await ack('failed','configuration');continue}
  const envelope=prepared.envelope??{from:config.from,to:prepared.to,subject:'Decifaz Hub · pendências para acompanhar',text:`Há vencimentos que precisam de acompanhamento no seu espaço. Consulte a Central para revisar a situação atual e registrar a ação realizada.\n\n${config.portal}\n\nLer um aviso não registra pagamento. Você pode ajustar seus avisos e desativar e-mail nas preferências da Central.`}
  if(!await rpc(client,'hub_notice_envelope',{...args,p:envelope,provider_name:config.mode})){summary.suppressed++;continue}
  await beforeSend(claim)
  // Check again after preparing the immutable envelope, immediately before IO.
  prepared=await rpc(client,'hub_notice_prepare',args)
  if(!prepared){summary.suppressed++;continue}
  if(prepared.provider!==config.mode||prepared.envelope?.to!==prepared.to){await ack('suppressed','configuration');continue}
  let response
  try{
   response=await fetcher(config.target+(config.mode==='mailpit'?'/api/v1/send':'/emails'),{
    method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json',...(config.mode==='resend'?{Authorization:'Bearer '+config.key,'Idempotency-Key':'hub-notice/'+claim.id}:{})},
    body:JSON.stringify(config.mode==='resend'?prepared.envelope:{From:{Email:envelope.from,Name:'Decifaz Hub · teste'},To:[{Email:prepared.to}],Subject:envelope.subject,Text:envelope.text,Headers:{'X-Decifaz-Notice':claim.id}}),
   })
  }catch{await ack('uncertain','network_unknown');continue}
  if(response.status===429){await ack('retry','rate_limit');continue}
  // Resend preserves this idempotency key and payload for 24h. Mailpit has no
  // such guarantee: an ambiguous server error must wait for manual inspection.
  if(response.status>=500){await ack(config.mode==='resend'?'retry':'uncertain','provider_failure');continue}
  if(!response.ok){await ack('failed','provider_failure');continue}
  let result;try{result=await response.json()}catch{await ack('uncertain','invalid_response');continue}
  const id=config.mode==='mailpit'?result.ID:result.id
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(id)){await ack('uncertain','invalid_response');continue}
  await ack('accepted',null,id)
  if(config.mode==='mailpit'){
   try{
    const captured=await fetcher(config.target+'/api/v1/message/'+encodeURIComponent(id),{signal:AbortSignal.timeout(8000)})
    if(captured.ok){await rpc(client,'hub_notice_delivery',{provider_message:id,event_key:'mailpit:'+id,outcome:'delivered'});summary.delivered++}
   }catch{/* Accepted is retained; never call this external delivery. */}
  }
  if(pace)await sleep(pace)
 }
 return summary
}

// Constant work for equal-length secrets; no browser CORS endpoint.
export function sameSecret(given,expected){if(!expected||expected.length<32||!given||given.length!==expected.length)return false;let difference=0;for(let i=0;i<given.length;i++)difference|=given.charCodeAt(i)^expected.charCodeAt(i);return difference===0}
