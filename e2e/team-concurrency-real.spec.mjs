import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
import {sql,session,literal,authenticate} from './helpers/local-db.mjs'

test('Equipe: duas sessões serializam revisão; duas telas exigem revisão explícita do conflito',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente pilha fictícia local.')
 test.setTimeout(90000)
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Local only')
 const settings={auth:{persistSession:false}},key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),users=[],contexts=[]
 let first,second
 async function account(role){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(service.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id)
  await checked(service.from('hub_members').insert({workspace_id:w,user_id:user.id,role}))
  const client=createClient(endpoint,key,settings)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,email,client,session}
 }
 async function open(person){
  const context=await browser.newContext();contexts.push(context)
  const page=await context.newPage();page.setDefaultTimeout(15000)
  await page.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),person.session)
  await page.goto('http://127.0.0.1:4181')
  await page.getByRole('button',{name:'Equipe',exact:true}).click()
  await expect(page.getByRole('form')).toHaveCount(3)
  return page
 }
 try{
  await checked(service.from('hub_workspaces').insert({id:w,name:'Conflito fictício'}))
  const a=await account('admin'),b=await account('admin'),member=await account('commercial')
  // Actual overlap: B waits for A's uncommitted save, then reads its new revision.
  const update=(role,revision)=>`select public.hub_update_member_roles('${w}','${member.id}',array[${literal(role)}],${revision});`
  const persisted=async()=> (await checked(a.client.rpc('hub_list_members',{w}))).find(m=>m.user_id===member.id)
  for(const [revision,statement,role] of [
   [0,update('operations',0),'operations'],
   [1,`select public.hub_set_roles('${w}','${member.id}',array['commercial']);`,'commercial'],
  ]){
   first=session()
   first.child.stdin.write(`begin;${authenticate(a.id)}${statement}\n\\echo FIRST_SAVED\n`)
   await expect.poll(()=>first.output(),{timeout:15000}).toContain('FIRST_SAVED')
   const application='team-'+uuid()
   second=session()
   second.child.stdin.end(`set application_name=${literal(application)};begin;${authenticate(b.id)}${update('finance',revision)}commit;`)
   await expect.poll(()=>sql(`select count(*) from pg_stat_activity where application_name=${literal(application)} and wait_event_type='Lock';`),{timeout:15000}).toBe('1')
   first.child.stdin.end('commit;\n');await first.done
   expect(await second.done).toContain('"status": "conflict"')
   expect(await persisted()).toMatchObject({roles:[role],revision:String(revision+1)})
  }
  // Independent browser sessions read revision 2 before either saves.
  const pa=await open(a),pb=await open(b)
  const fa=pa.getByRole('form',{name:'Papéis de '+member.email}),fb=pb.getByRole('form',{name:'Papéis de '+member.email})
  await fa.getByRole('checkbox',{name:'Operação',exact:true}).check()
  await fa.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect.poll(persisted).toMatchObject({roles:['commercial','operations'],revision:'3'})
  await fb.getByRole('checkbox',{name:'Financeiro',exact:true}).check()
  await fb.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect(fb.getByRole('alert')).toContainText('Outro administrador alterou')
  await expect(fb.getByText('Papéis atuais: Comercial, Operação.',{exact:true})).toBeVisible()
  await expect(fb.getByRole('button',{name:'Salvar papéis',exact:true})).toBeDisabled()
  expect(await persisted()).toMatchObject({roles:['commercial','operations'],revision:'3'})
  await pb.screenshot({path:test.info().outputPath('equipe-conflito.png'),fullPage:true})
  await fb.getByRole('button',{name:'Revisar a partir dos papéis atuais',exact:true}).click()
  await expect(fb.getByRole('checkbox',{name:'Financeiro',exact:true})).not.toBeChecked()
  await expect(fb.getByRole('checkbox',{name:'Comercial',exact:true})).toBeChecked()
  await fb.getByRole('checkbox',{name:'Financeiro',exact:true}).check()
  await fb.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect.poll(persisted).toMatchObject({roles:['commercial','finance','operations'],revision:'4'})
 }finally{
  for(const current of [first,second])if(current&&!current.child.stdin.writableEnded)current.child.stdin.end('rollback;\n')
  await Promise.allSettled([first?.done,second?.done])
  for(const context of contexts)await context.close().catch(()=>{})
  for(const id of users)await service.auth.admin.deleteUser(id)
 }
})
