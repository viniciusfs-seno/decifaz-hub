import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolve,dirname} from 'node:path'

export async function validateTurnAccount(settings,fetcher=fetch){
 const {HUB_TURN_XIRSYS_IDENT:ident,HUB_TURN_XIRSYS_SECRET:secret,HUB_TURN_XIRSYS_CHANNEL:channel}=settings
 if(!ident||!secret||channel!=='decifazhub'||[ident,secret].some(s=>/[\r\n]/.test(s)))return {configured:false,channelVerified:false,code:'configuration_missing'}
 try{
  // Read-only API. No TURN allocation, account update, channel creation or billing.
  const response=await fetcher('https://global.xirsys.net/_ns?depth=100',{headers:{Authorization:'Basic '+Buffer.from(ident+':'+secret).toString('base64')},signal:AbortSignal.timeout(10000)})
  if(!response.ok)return {configured:true,channelVerified:false,code:response.status===401||response.status===403?'authorization_refused':'provider_unavailable'}
  const data=await response.json();let found=false
  const visit=value=>{if(value===channel)found=true;else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){if(key===channel)found=true;visit(item)}}
  if(data.s==='ok')visit(data.v)
  return {configured:true,channelVerified:data.s==='ok'&&found,code:data.s==='ok'&&found?'channel_verified':'channel_not_verified'}
 }catch{return {configured:true,channelVerified:false,code:'network_or_response_failure'}}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),relative='.validation/turn-xirsys.env'
 if(spawnSync('git',['-C',root,'check-ignore','-q','--',relative]).status!==0)throw Error('Arquivo de configuração não ignorado')
 const settings=Object.fromEntries(fs.readFileSync(resolve(root,relative),'utf8').split(/\r?\n/).flatMap(line=>{const m=line.match(/^([A-Z_]+)=(.*)$/);return m?[[m[1],m[2].replace(/^(["'])(.*)\1$/,'$2')]]:[]}))
 const result=await validateTurnAccount(settings)
 console.log(JSON.stringify({...result,integrationEnabled:settings.HUB_TURN_ENABLED==='true',planVerified:settings.HUB_TURN_FREE_PLAN_CONFIRMED==='true'}))
 if(!result.channelVerified)process.exitCode=1
}
