import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {sql} from './helpers/local-db.mjs'

test('publicação em fases e rollback mantêm versões compatíveis e fecham JSON antes dos papéis restritos',async({browser})=>{
 test.skip(process.env.HUB_TRANSITION_E2E!=='1','Requer executor de transição local.')
 test.setTimeout(120000)
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Somente Supabase local')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,{auth:{persistSession:false}})
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),l=uuid(),p=uuid(),contexts=[],ids=[]
 async function account(){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}));ids.push(user.id)
  const client=createClient(endpoint,key,{auth:{persistSession:false}})
  return {id:user.id,client,session:(await checked(client.auth.signInWithPassword({email,password}))).session}
 }
 async function open(account,port,legacy=false){
  const context=await browser.newContext();contexts.push(context)
  const page=await context.newPage()
  if(legacy)await page.route('**/functions/v1/hub-workspaces',route=>route.continue({url:endpoint+'/functions/v1/hub-workspaces-legacy-test'}))
  await page.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),account.session)
  await page.goto('http://127.0.0.1:'+port)
  return page
 }
 function migration(file){
  if(!process.env.HUB_ROLE_ARTIFACTS)throw Error('Artefatos separados ausentes.')
  const phase=file.startsWith('20261114200000')?'A-expansao':'D-restricao'
  sql(readFileSync(process.env.HUB_ROLE_ARTIFACTS+'/'+phase+'/supabase/migrations/'+file,'utf8')+"\nnotify pgrst,'reload schema';")
 }
 const owner=await account(),sales=await account(),missing=await account()
 try{
  await checked(admin.from('hub_workspaces').insert({id:w,name:'Transição fictícia'}))
  // Genuine pre-migration association with no role column yet.
  await checked(admin.from('hub_members').insert({workspace_id:w,user_id:owner.id}))
  await checked(admin.from('hub_leads').insert({workspace_id:w,id:l,name:'Cliente anterior'}))
  const record={title:'Proposta anterior',scope:'Escopo compatível',services:[],validity:'2026-12-31',setup:125,monthly:25,terms:'Condição preservada',events:[]}
  await checked(admin.from('hub_proposals').insert({workspace_id:w,id:p,series_id:p,lead_id:l,version:1,status:'Aceita',record}))
  await checked(admin.from('hub_projects').insert({workspace_id:w,proposal_id:p,lead_id:l,approved:{...record,version:1},deliverables:'Entrega'}))
  expect((await fetch(endpoint+'/functions/v1/hub-workspaces-legacy-test',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+owner.session.access_token,'Content-Type':'application/json'},body:'{}'})).status,'Edge anterior real local').toBe(200)
  const old=await open(owner,4182,true)
  await old.getByRole('button',{name:'Propostas comerciais',exact:true}).click()
  await expect(old.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  migration('20261114200000_expansao_compativel.sql')
  await expect.poll(async()=>{const {data}=await owner.client.from('hub_members').select('role').eq('workspace_id',w);return data?.[0]?.role}).toBe('admin')
  expect(sql("select column_default is null from information_schema.columns where table_schema='public' and table_name='hub_members' and column_name='role';")).toBe('t')
  expect((await admin.from('hub_members').insert({workspace_id:w,user_id:missing.id})).error?.code).toBe('23502')
  expect((await admin.from('hub_members').insert({workspace_id:w,user_id:sales.id,role:'commercial'})).error?.code).toBe('23514')
  await checked(admin.from('hub_members').insert({workspace_id:w,user_id:sales.id,role:'admin'}))
  await old.reload()
  await old.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await expect(old.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  // Old Edge + old frontend still work after expansion. New Edge is exercised
  // without routing by the current and bridge frontends below.
  const current=await open(owner,4181)
  await current.getByRole('button',{name:'Propostas comerciais',exact:true}).click()
  await expect(current.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  const bridge=await open(owner,4183)
  await bridge.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await expect(bridge.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  // Before contract: rolling frontend and Edge back to the legacy pair is safe.
  await old.reload()
  await expect(old.getByRole('button',{name:'Financeiro',exact:true})).toBeVisible()
  migration('20261114210000_papeis.sql')
  migration('20261114220000_visible_scope_execute.sql')
  await expect.poll(async()=> (await owner.client.from('hub_proposals').select('record').eq('workspace_id',w)).error?.code).toBe('42501')
  expect((await owner.client.from('hub_projects').select('approved').eq('workspace_id',w)).error?.code).toBe('42501')
  // The previous views-compatible frontend is the secure rollback floor.
  await bridge.reload()
  await bridge.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await expect(bridge.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  expect(await checked(owner.client.rpc('hub_set_role',{w,u:sales.id,r:'commercial'}))).toBe(true)
  expect(await checked(owner.client.rpc('hub_set_role',{w,u:owner.id,r:'commercial'}))).toBe(false)
  const restricted=await open(sales,4181)
  await restricted.getByRole('button',{name:'Propostas comerciais',exact:true}).click()
  await expect(restricted.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  await expect(restricted.getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
  expect((await checked(sales.client.from('hub_proposals_visible').select('record').eq('workspace_id',w)))[0].record.setup).toBeUndefined()
  const rollback=await open(sales,4183)
  await rollback.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await expect(rollback.getByRole('button',{name:'Proposta anterior',exact:true})).toBeVisible()
  await expect(rollback.getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
  // Legacy frontend is intentionally unsupported after contract: fail closed.
  await old.reload()
  await expect(old.getByRole('alert')).toContainText('Não foi possível carregar a jornada comercial')
 }finally{
  await Promise.all(contexts.map(c=>c.close()))
  for(const id of ids)await admin.auth.admin.deleteUser(id)
 }
})
