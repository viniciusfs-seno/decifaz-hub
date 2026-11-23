const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0))
export async function verifyNoticeEvent(raw,headers,secret,now=Date.now()){
 const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp'),signatures=headers.get('svix-signature')
 if(!secret?.startsWith('whsec_')||!id||id.length>160||!/^\d+$/.test(stamp??'')||Math.abs(now/1000-Number(stamp))>300||!signatures)throw Error('signature')
 const key=await crypto.subtle.importKey('raw',decode(secret.slice(6)),{name:'HMAC',hash:'SHA-256'},false,['verify'])
 const payload=new TextEncoder().encode(id+'.'+stamp+'.'+raw)
 let valid=false
 for(const entry of signatures.split(' ')){const [version,value]=entry.split(',');if(version==='v1'&&value){try{if(await crypto.subtle.verify('HMAC',key,decode(value),payload))valid=true}catch{/* Reject malformed candidates. */}}}
 if(!valid)throw Error('signature')
 const event=JSON.parse(raw)
 if(!['email.delivered','email.bounced'].includes(event.type))return null
 if(typeof event.data?.email_id!=='string'||!/^[a-zA-Z0-9_-]{1,160}$/.test(event.data.email_id))throw Error('event')
 return {event_key:id,provider_message:event.data.email_id,outcome:event.type==='email.delivered'?'delivered':'bounced'}
}
