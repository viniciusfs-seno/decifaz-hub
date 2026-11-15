import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'

test('Histórico: JWTs reais locais, duas RPCs, ator, revisões, RLS e escrita direta negada',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente pilha fictícia local.')
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Local only')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,settings={auth:{persistSession:false}}
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),other=uuid(),ids=[]
 async function account(){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(service.auth.admin.createUser({email,password,email_confirm:true}));ids.push(user.id)
  const client=createClient(endpoint,key,settings)
  await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,client}
 }
 try{
  const a=await account(),b=await account(),member=await account(),outside=await account()
  await checked(service.from('hub_workspaces').insert([{id:w,name:'Eventos fictícios'},{id:other,name:'Eventos isolados'}]))
  await checked(service.from('hub_members').insert([{workspace_id:w,user_id:a.id,role:'admin'},{workspace_id:w,user_id:b.id,role:'admin'},{workspace_id:w,user_id:member.id,role:'commercial'},{workspace_id:other,user_id:outside.id,role:'admin'}]))
  const history=async()=>checked(a.client.from('hub_role_audit').select('*').eq('workspace_id',w))
  expect(await history()).toHaveLength(3)
  expect(await checked(a.client.rpc('hub_set_roles',{w,u:member.id,r:['operations','finance']}))).toBe(true)
  expect(await checked(b.client.rpc('hub_update_member_roles',{w,u:member.id,r:['commercial','finance'],expected_revision:'1'}))).toMatchObject({status:'saved',revision:'2'})
  const changes=(await history()).filter(row=>row.operation==='changed').sort((x,y)=>x.after_revision-y.after_revision)
  expect(changes).toHaveLength(2)
  expect(changes[0]).toMatchObject({workspace_id:w,actor_id:a.id,actor_source:'member',member_id:member.id,before_roles:['commercial'],after_roles:['finance','operations'],before_revision:0,after_revision:1})
  expect(changes[1]).toMatchObject({workspace_id:w,actor_id:b.id,member_id:member.id,before_roles:['finance','operations'],after_roles:['commercial','finance'],before_revision:1,after_revision:2})
  expect(Number.isFinite(Date.parse(changes[1].occurred_at))).toBe(true)
  expect(await checked(b.client.rpc('hub_update_member_roles',{w,u:member.id,r:['operations'],expected_revision:'1'}))).toMatchObject({status:'conflict'})
  expect(await checked(a.client.rpc('hub_set_roles',{w,u:member.id,r:['commercial','finance']}))).toBe(true)
  expect(await history()).toHaveLength(5)
  // Legacy upsert of an existing Auth user creates an explicit creation event.
  expect(await checked(a.client.rpc('hub_set_roles',{w,u:outside.id,r:['commercial']}))).toBe(true)
  expect((await history()).find(row=>row.member_id===outside.id)).toMatchObject({actor_id:a.id,operation:'created',before_roles:[],after_roles:['commercial'],before_revision:null,after_revision:0})
  expect(await checked(member.client.from('hub_role_audit').select('*'))).toEqual([])
  expect(await checked(a.client.from('hub_role_audit').select('*').eq('workspace_id',other))).toEqual([])
  const externalRows=await checked(outside.client.from('hub_role_audit').select('*'))
  expect(externalRows).toHaveLength(1)
  expect(externalRows[0].workspace_id).toBe(other)
  const forged={workspace_id:w,actor_id:b.id,actor_source:'member',member_id:member.id,operation:'created',before_roles:[],after_roles:['admin'],after_revision:0}
  expect((await a.client.from('hub_role_audit').insert(forged)).error?.code).toBe('42501')
  expect((await a.client.from('hub_role_audit').update({after_roles:['admin']}).eq('workspace_id',w)).error?.code).toBe('42501')
  expect((await a.client.from('hub_role_audit').delete().eq('workspace_id',w)).error?.code).toBe('42501')
  const anon=createClient(endpoint,key,settings)
  expect((await anon.from('hub_role_audit').select('*')).error?.code).toBe('42501')
  expect(await history()).toHaveLength(6)
 }finally{for(const id of ids)await service.auth.admin.deleteUser(id)}
})
