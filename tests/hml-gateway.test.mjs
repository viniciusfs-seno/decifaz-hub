import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {request} from 'node:http'
import {createGateway} from '../scripts/hml-gateway.mjs'
test('gateway protege frontend, APIs e Auth; cookie seguro e rotas administrativas não expostas',async()=>{
 const root=await mkdtemp(join(tmpdir(),'hub-hml-')),password=randomBytes(24).toString('hex')
 await writeFile(join(root,'index.html'),'<body>Fixture protegida</body>')
 const server=createGateway({origin:'https://fixture.trycloudflare.com',password,root,fixture:{},publicKey:'sb_publishable_fixture'})
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port
 try{
  for(const path of ['/','/assets/app.js','/__supabase/rest/v1/hub_leads','/__supabase/auth/v1/token','/__review/fixtures','/__review/screen-progress','/__review/screen-probe'])assert.equal((await fetch(url+path)).status,401,path)
  assert.equal((await fetch(url+'/__health')).status,200)
  assert.equal((await fetch(url+'/__review/login',{method:'POST',headers:{Origin:'https://foreign.example.invalid'},body:'password='+password})).status,403)
  assert.equal((await fetch(url+'/__review/login',{method:'POST',body:'password=wrong'})).status,401)
  const login=await fetch(url+'/__review/login',{method:'POST',body:new URLSearchParams({password}),redirect:'manual'})
  assert.equal(login.status,303);const cookie=login.headers.get('set-cookie');for(const attr of ['Secure','HttpOnly','SameSite=Lax','Path=/'])assert.ok(cookie.includes(attr))
  const headers={Cookie:cookie.split(';')[0]}
  assert.equal((await fetch(url+'/__review/screen-progress',{method:'POST',headers,body:JSON.stringify({phase:'frames',credential:'must-not-be-retained'})})).status,200)
  assert.deepEqual(await(await fetch(url+'/__review/screen-progress',{headers})).json(),{phase:'frames'})
  assert.equal((await fetch(url+'/__review/screen-progress',{method:'POST',headers,body:JSON.stringify({phase:'not-a-valid-phase'})})).status,400)
  const upgrade=extra=>new Promise((resolve,reject)=>{const r=request(url+'/__supabase/realtime/v1/websocket',{headers:{Connection:'Upgrade',Upgrade:'websocket',Origin:'https://fixture.trycloudflare.com',...extra}},res=>{res.resume();resolve(res.statusCode)});r.on('error',reject);r.setTimeout(2000,()=>r.destroy(Error('Handshake sem resposta')));r.end()})
  assert.equal(await upgrade({}),401)
  assert.equal(await upgrade({...headers,Origin:'https://foreign.example.invalid'}),401)
  assert.match(await(await fetch(url+'/',{headers})).text(),/Fixture protegida/)
  for(const path of ['/__supabase/auth/v1/admin/users','/__supabase/storage/v1/','/__supabase/pg/','/.env'])assert.equal((await fetch(url+path,{headers})).status,404,path)
  assert.equal((await fetch(url+'/__supabase/auth/v1/otp',{method:'POST',headers,body:JSON.stringify({email:'not-a-fixture@real-domain.invalid'})})).status,400)
  await fetch(url+'/__review/logout',{method:'POST',headers,redirect:'manual'})
  assert.equal((await fetch(url+'/',{headers})).status,401)
 }finally{await new Promise(r=>server.close(r));assert.ok(root.startsWith(join(tmpdir(),'hub-hml-'))&&root!==tmpdir());await rm(root,{recursive:true,force:true})}
})
