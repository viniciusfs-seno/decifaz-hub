import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readTurnUsage} from '../scripts/turn-usage.mjs'

test('TURN usage: four bounded read-only aggregates, UTC month and no private response',async()=>{
 const secret=randomUUID(),settings={HUB_TURN_XIRSYS_IDENT:'fictional',HUB_TURN_XIRSYS_SECRET:secret,HUB_TURN_XIRSYS_CHANNEL:'decifazhub'}
 const calls=[]
 const result=await readTurnUsage(settings,async(url,options)=>{calls.push(url);assert.equal(options.method,undefined);assert(options.signal);assert(options.headers.Authorization.startsWith('Basic '));return Response.json({s:'ok',v:{sum:123,private:secret},secret})},new Date('2026-12-01T00:30:00Z'))
 assert.equal(calls.length,4);assert(calls.every(url=>url.startsWith('https://global.xirsys.net/_stats')&&url.includes('gs=2026%3A12%3A01')&&url.includes('ge=2026%3A12%3A01')))
 assert.equal(result.accountBytes,246);assert.equal(result.channelBytes,246);assert.equal(result.reporting,'hourly_delayed')
 assert(!JSON.stringify(result).includes(secret));assert(!JSON.stringify(result).includes('fictional'))
 const singleton=await readTurnUsage(settings,async()=>Response.json({s:'ok',v:[{sum:5}]}));assert.equal(singleton.channelBytes,10)
 const missing=await readTurnUsage({...settings,HUB_TURN_XIRSYS_SECRET:''},()=>{throw Error('Must not fetch')});assert.equal(missing.code,'configuration_missing')
 for(const response of [()=>new Response(secret,{status:401}),()=>Response.json({s:'ok',v:{sum:-1,private:secret}}),()=>Response.json({s:'ok',v:{}}),()=>Response.json({s:'ok',v:[]}),()=>{throw Error(secret)}]){
  const bad=await readTurnUsage(settings,async()=>response());assert.equal(bad.accountBytes,null);assert.equal(bad.channelBytes,null);assert(!JSON.stringify(bad).includes(secret))
 }
})
