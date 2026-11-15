import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
import {sql,session,literal,authenticate} from './helpers/local-db.mjs'

test('duas sessões: Comercial espera o bloqueio e preserva os preços recém-confirmados por Administração',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local.')
 if(process.env.VITE_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('Somente Supabase local')
 const admin=createClient(process.env.VITE_SUPABASE_URL,process.env.HUB_TEST_ADMIN_KEY,{auth:{persistSession:false}})
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),l=uuid(),p=uuid(),users=[]
 let administration,commercial
 try{
  await checked(admin.from('hub_workspaces').insert({id:w,name:'Concorrência fictícia'}))
  for(const role of ['admin','commercial']){
   const {user}=await checked(admin.auth.admin.createUser({email:uuid()+'@example.invalid',password:uuid(),email_confirm:true}))
   users.push(user.id)
   await checked(admin.from('hub_members').insert({workspace_id:w,user_id:user.id,role}))
  }
  await checked(admin.from('hub_leads').insert({workspace_id:w,id:l,name:'Concorrência fictícia'}))
  const body={title:'Preço concorrente',scope:'Escopo inicial',services:[],validity:'2026-12-31',setup:100,monthly:10,terms:'Condição anterior'}
  await checked(admin.from('hub_proposals').insert({workspace_id:w,lead_id:l,id:p,series_id:p,version:1,record:body}))
  const call=body=>`select public.hub_save_proposal('${w}','${l}','${p}','${p}',1,null,${literal(JSON.stringify(body))}::jsonb,null,null,null);`
  administration=session()
  administration.child.stdin.write(`begin;${authenticate(users[0])}
   select id from public.hub_leads where workspace_id='${w}' and id='${l}' for update;
   ${call({...body,setup:275,monthly:45,terms:'Condição mais recente'})}
   \\echo ADMIN_STAGED
  `)
  await expect.poll(()=>administration.output(),{timeout:15000}).toContain('ADMIN_STAGED')
  const application='sales-'+uuid()
  commercial=session()
  const {setup,monthly,terms,...scope}=body
  commercial.child.stdin.end(`set application_name=${literal(application)};begin;${authenticate(users[1])}${call({...scope,scope:'Escopo salvo pelo Comercial'})}commit;`)
  // Prove the commercial RPC is already executing and blocked behind Admin.
  await expect.poll(()=>sql(`select count(*) from pg_stat_activity where application_name=${literal(application)} and wait_event_type='Lock';`),{timeout:15000}).toBe('1')
  administration.child.stdin.end('commit;\n')
  await administration.done
  expect(await commercial.done).toContain('t')
  const {record}=await checked(admin.from('hub_proposals').select('record').eq('workspace_id',w).eq('id',p).single())
  expect(record).toMatchObject({scope:'Escopo salvo pelo Comercial',setup:275,monthly:45,terms:'Condição mais recente'})
 }finally{
  for(const current of [administration,commercial])if(current&&!current.child.stdin.writableEnded)current.child.stdin.end('rollback;\n')
  await Promise.allSettled([administration?.done,commercial?.done])
  for(const id of users)await admin.auth.admin.deleteUser(id)
 }
})
