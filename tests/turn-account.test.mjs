import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {validateTurnAccount} from '../scripts/turn-account-validation.mjs'
test('Xirsys: valida canal exato por leitura sem retornar credenciais ou conteúdo privado',async()=>{
 const secret=randomUUID(),settings={HUB_TURN_XIRSYS_IDENT:'fictional',HUB_TURN_XIRSYS_SECRET:secret,HUB_TURN_XIRSYS_CHANNEL:'decifazhub'}
 let calls=0
 const result=await validateTurnAccount(settings,async(url,options)=>{calls++;assert.equal(url,'https://global.xirsys.net/_ns?depth=100');assert.equal(options.method,undefined);assert(options.headers.Authorization.startsWith('Basic '));return Response.json({s:'ok',v:{decifazhub:{},other:{}},secret})})
 assert.equal(result.channelVerified,true);assert.equal(calls,1);assert(!JSON.stringify(result).includes(secret));assert(!JSON.stringify(result).includes('fictional'))
 assert.equal((await validateTurnAccount({...settings,HUB_TURN_XIRSYS_CHANNEL:'decifaz-homologacao'},async()=>{throw Error('Must not call')})).configured,false)
 assert.equal((await validateTurnAccount(settings,async()=>Response.json({s:'ok',v:['decifaz-homologacao']}))).channelVerified,false)
 assert.equal((await validateTurnAccount(settings,async()=>new Response(secret,{status:401}))).code,'authorization_refused')
 assert.equal((await validateTurnAccount(settings,async()=>{throw Error(secret)})).code,'network_or_response_failure')
})
