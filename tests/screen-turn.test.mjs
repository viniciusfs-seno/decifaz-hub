import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {issueTurn,turnHandler} from '../supabase/functions/_shared/screen-turn.mjs'

test('TURN: emissão temporária mantém chave somente no servidor e filtra resposta',async()=>{
 const apiToken=randomBytes(32).toString('hex'),credential=randomBytes(24).toString('base64url')
 let called=false
 const result=await issueTurn({keyId:'fictional-key',apiToken,ttl:300},async(url,options)=>{
  called=true;assert.equal(new URL(url).hostname,'rtc.live.cloudflare.com');assert.equal(options.headers.Authorization,'Bearer '+apiToken);assert.deepEqual(JSON.parse(options.body),{ttl:300})
  return Response.json({secret:'never-return-provider-extras',iceServers:[{urls:['stun:stun.cloudflare.com:3478']},{urls:['turn:turn.cloudflare.com:3478?transport=udp','turn:turn.cloudflare.com:80?transport=tcp','turns:turn.cloudflare.com:443?transport=tcp'],username:'fictitious-temporary',credential,providerSecret:apiToken}]})
 })
 assert.ok(called);assert.equal(result.ttl,300);assert.equal(result.iceServers[1].credential,credential);assert.equal(JSON.stringify(result).includes(apiToken),false);assert.equal(JSON.stringify(result).includes('never-return-provider-extras'),false)
 await assert.rejects(issueTurn({keyId:'fictional',apiToken,ttl:1801}),/indisponível/)
 await assert.rejects(issueTurn({keyId:'fictional',apiToken,ttl:300},async()=>Response.json({iceServers:[{urls:'turn:foreign.example.invalid:443',username:'fake',credential}]})),/indisponível/)
})

test('TURN: desativado não chama provedor; recusas e limites não emitem credencial',async()=>{
 const request=body=>new Request('https://edge.example.invalid',{method:'POST',body:JSON.stringify(body)})
 let emitted=0;const issue=async ttl=>{emitted++;return {iceServers:[],ttl}}
 const disabled=turnHandler({enabled:false,authorize:()=>{throw Error('must-not-call')},issue})
 assert.deepEqual(await(await disabled(request({s:randomUUID()}))).json(),{enabled:false});assert.equal(emitted,0)
 const denied=turnHandler({enabled:true,authorize:async()=>({error:{message:'private-details'}}),issue})
 const refusal=await denied(request({s:randomUUID()}));assert.equal(refusal.status,403);assert.equal(JSON.stringify(await refusal.json()).includes('private-details'),false);assert.equal(emitted,0)
 const authorized=turnHandler({enabled:true,authorize:async()=>({data:{ttl:120}}),issue})
 const ok=await authorized(request({s:randomUUID()}));assert.equal(ok.status,200);assert.equal(ok.headers.get('cache-control'),'no-store');assert.equal(emitted,1)
 assert.equal((await authorized(request({s:randomUUID(),credential:'invalid'}))).status,400);assert.equal(emitted,1)
 const failure=turnHandler({enabled:true,authorize:async()=>({data:{ttl:120}}),issue:async()=>{throw Error('sensitive-upstream-detail')}})
 const response=await failure(request({s:randomUUID()}));assert.equal(response.status,503);assert.equal(JSON.stringify(await response.json()).includes('sensitive-upstream-detail'),false)
})

test('Xirsys: credenciais temporárias, canal fixo no servidor e resposta estritamente filtrada',async()=>{
 const secret=randomBytes(32).toString('hex'),credential=randomBytes(24).toString('base64url'),args={provider:'xirsys',ident:'fictional-ident',secret,channel:'hub-hml',ttl:120}
 const result=await issueTurn(args,async(url,options)=>{
  const target=new URL(url);assert.equal(target.hostname,'global.xirsys.net');assert.equal(target.pathname,'/_turn/hub-hml');assert.equal(target.searchParams.get('expire'),'120');assert.equal(target.searchParams.get('webrtc'),'1');assert.equal(options.method,'PUT');assert.equal(options.headers.Authorization,'Basic '+btoa(args.ident+':'+secret))
  return Response.json({s:'ok',private:secret,v:{iceServers:[{urls:['stun:xx-turn1.xirsys.com','turn:xx-turn1.xirsys.com:3478?transport=udp','turns:xx-turn1.xirsys.com:443?transport=tcp'],username:'temporary-fictional',credential,extra:secret}]}})
 })
 assert.equal(result.ttl,120);assert.equal(result.iceServers[0].credential,credential);assert.equal(JSON.stringify(result).includes(secret),false)
 await assert.rejects(issueTurn({...args,channel:'../foreign'}),/indisponível/)
 await assert.rejects(issueTurn(args,async()=>Response.json({s:'error',v:'private upstream body'})),/indisponível/)
 await assert.rejects(issueTurn(args,async()=>Response.json({s:'ok',v:{iceServers:[{urls:'turn:attacker.example.invalid:443',username:'fake',credential}]}})),/indisponível/)
 await assert.rejects(issueTurn(args,async()=>new Response(null,{status:429})),/indisponível/)
})
