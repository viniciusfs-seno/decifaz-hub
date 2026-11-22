// Read-only, server-side usage snapshot. Never allocate TURN or expose responses.
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolve,dirname} from 'node:path'

export async function readTurnUsage(settings,fetcher=fetch,at=new Date()){
 const {HUB_TURN_XIRSYS_IDENT:ident,HUB_TURN_XIRSYS_SECRET:secret,HUB_TURN_XIRSYS_CHANNEL:channel}=settings
 if(!ident||!secret||channel!=='decifazhub'||[ident,secret].some(s=>/[\r\n]/.test(s)))return {code:'configuration_missing'}
 const date=d=>d.toISOString().slice(0,10).replaceAll('-',':')
 const gs=date(new Date(Date.UTC(at.getUTCFullYear(),at.getUTCMonth(),1))),ge=date(at)
 const measurements=await Promise.all(['account','channel'].flatMap(scope=>['turn:recv','turn:sent'].map(async metric=>{
  const base={scope,metric}
  try{
   const params=new URLSearchParams({l:metric,gs,ge})
   const response=await fetcher('https://global.xirsys.net/_stats'+(scope==='channel'?'/'+encodeURIComponent(channel):'')+'?'+params,{headers:{Authorization:'Basic '+Buffer.from(ident+':'+secret).toString('base64')},signal:AbortSignal.timeout(10000)})
   if(!response.ok)return {...base,code:response.status===401||response.status===403?'authorization_refused':'provider_unavailable'}
   const data=await response.json(),aggregate=Array.isArray(data.v)&&data.v.length===1?data.v[0]:data.v,sum=aggregate?.sum
   if(data.s!=='ok'||!Number.isSafeInteger(sum)||sum<0)return {...base,code:'usage_unavailable',diagnostic:{httpStatus:response.status,envelopeOk:data.s==='ok',valueKind:Array.isArray(data.v)?'array':data.v===null?'null':typeof data.v,emptyArray:Array.isArray(data.v)&&data.v.length===0,sumKind:typeof sum}}
   return {...base,code:'reported',bytes:sum}
  }catch{return {...base,code:'network_or_response_failure'}}
 })))
 const total=scope=>{const rows=measurements.filter(x=>x.scope===scope);return rows.every(x=>x.code==='reported')?rows.reduce((n,x)=>n+x.bytes,0):null}
 return {code:'snapshot',capturedAt:at.toISOString(),fromUtc:gs,toUtc:ge,reporting:'hourly_delayed',accountBytes:total('account'),channelBytes:total('channel'),measurements}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),relative='.validation/turn-xirsys.env'
  if(spawnSync('git',['-C',root,'check-ignore','-q','--',relative]).status!==0)throw Error('Ignore guard')
  const settings=Object.fromEntries(fs.readFileSync(resolve(root,relative),'utf8').split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].replace(/^(["'])(.*)\1$/,'$2')]]:[]}))
  const result=await readTurnUsage(settings)
  console.log(JSON.stringify(result))
  if(result.accountBytes==null||result.channelBytes==null)process.exitCode=1
 }catch{console.log(JSON.stringify({code:'local_configuration_unavailable'}));process.exitCode=1}
}
