import {openDisclosure} from './helpers/portal-ui.mjs'
import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
import {sql,session,literal,authenticate} from './helpers/local-db.mjs'

test('Convites: destinatário verificado, dois aceites sobrepostos, revogação concorrente e vínculo existente',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local fictício.')
 test.setTimeout(90000)
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Local only')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,settings={auth:{persistSession:false}}
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),other=uuid(),ids=[]
 let first,second
 async function account(){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(service.auth.admin.createUser({email,password,email_confirm:true}));ids.push(user.id)
  const client=createClient(endpoint,key,settings)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,email,client,session}
 }
 async function overlap(firstActor,statement,secondActor,secondStatement){
  first=session();first.child.stdin.write(`begin;${authenticate(firstActor)}${statement}\n\\echo STAGED\n`)
  await expect.poll(()=>first.output(),{timeout:15000}).toContain('STAGED')
  const application='invite-'+uuid();second=session()
  second.child.stdin.end(`set application_name=${literal(application)};begin;${authenticate(secondActor)}${secondStatement}commit;`)
  await expect.poll(()=>sql(`select count(*) from pg_stat_activity where application_name=${literal(application)} and wait_event_type='Lock';`),{timeout:15000}).toBe('1')
  first.child.stdin.end('commit;\n');await first.done
  return await second.done
 }
 try{
  const owner=await account(),target=await account(),wrong=await account(),foreign=await account(),existing=await account()
  await checked(service.from('hub_workspaces').insert([{id:w,name:'Aceite fictício'},{id:other,name:'Gestão isolada'}]))
  await checked(service.from('hub_members').insert([{workspace_id:w,user_id:owner.id,role:'admin'},{workspace_id:other,user_id:foreign.id,role:'admin'}]))
  const create=async email=>checked(owner.client.rpc('hub_create_invite',{w,e:email,r:['operations','finance']}))
  const invitation=await create(target.email)
  expect(invitation.status).toBe('created')
  expect(await checked(target.client.rpc('hub_can',{w,module:'commercial'}))).toBe(false)
  expect(await checked(service.from('hub_members').select('user_id').eq('workspace_id',w).eq('user_id',target.id))).toHaveLength(0)
  const edge=await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+target.session.access_token,'Content-Type':'application/json'},body:'{}'})
  expect(edge.status).toBe(403)
  expect(await checked(wrong.client.rpc('hub_accept_invite',{i:invitation.id}))).toMatchObject({status:'unavailable'})
  expect((await wrong.client.rpc('hub_list_invites',{w})).error?.code).toBe('42501')
  expect((await foreign.client.rpc('hub_create_invite',{w,e:wrong.email,r:['admin']})).error?.code).toBe('42501')
  expect((await foreign.client.rpc('hub_revoke_invite',{i:invitation.id})).error?.code).toBe('42501')
  // Even a previously issued JWT cannot bypass the current verification state.
  sql(`update auth.users set email_confirmed_at=null where id=${literal(target.id)};`)
  expect(await checked(target.client.rpc('hub_accept_invite',{i:invitation.id}))).toMatchObject({status:'unavailable'})
  sql(`update auth.users set email_confirmed_at=clock_timestamp() where id=${literal(target.id)};`)
  const result=await overlap(target.id,`select public.hub_accept_invite('${invitation.id}');`,target.id,`select public.hub_accept_invite('${invitation.id}');`)
  expect(result).toContain('"repeated": true')
  const rows=await checked(service.from('hub_members').select('role,extra_roles,role_revision').eq('workspace_id',w).eq('user_id',target.id))
  expect(rows).toEqual([{role:'finance',extra_roles:['operations'],role_revision:0}])
  const events=await checked(owner.client.from('hub_role_audit').select('*').eq('invite_id',invitation.id))
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({actor_id:target.id,accepted_by:target.id,grantor_id:owner.id,member_id:target.id,operation:'created',before_roles:[],after_roles:['finance','operations']})
  expect(await checked(target.client.rpc('hub_accept_invite',{i:invitation.id}))).toMatchObject({status:'accepted',repeated:true})
  const revoked=await create(wrong.email)
  const rejected=await overlap(owner.id,`select public.hub_revoke_invite('${revoked.id}');`,wrong.id,`select public.hub_accept_invite('${revoked.id}');`)
  expect(rejected).toContain('"status": "unavailable"')
  expect(await checked(service.from('hub_members').select('user_id').eq('workspace_id',w).eq('user_id',wrong.id))).toHaveLength(0)
  expect(await checked(owner.client.from('hub_role_audit').select('id').eq('invite_id',revoked.id))).toHaveLength(0)
  const keep=await create(existing.email)
  expect(await checked(owner.client.rpc('hub_set_roles',{w,u:existing.id,r:['commercial']}))).toBe(true)
  expect(await checked(existing.client.rpc('hub_accept_invite',{i:keep.id}))).toMatchObject({status:'accepted',outcome:'existing_member'})
  expect((await checked(service.from('hub_members').select('role,extra_roles,role_revision').eq('workspace_id',w).eq('user_id',existing.id).single()))).toEqual({role:'commercial',extra_roles:[],role_revision:0})
  expect(await checked(owner.client.from('hub_role_audit').select('id').eq('invite_id',keep.id))).toHaveLength(0)
  expect(sql('select count(*) from hub_private.invite_acceptance;')).toBe('0')
 }finally{
  for(const current of [first,second])if(current&&!current.child.stdin.writableEnded)current.child.stdin.end('rollback;\n')
  await Promise.allSettled([first?.done,second?.done])
  for(const id of ids)await service.auth.admin.deleteUser(id)
 }
})

test('Convites: gestão, Mailpit, primeiro acesso verificado, aceite explícito e falha de envio',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase e Mailpit locais.')
 test.setTimeout(90000)
 const endpoint='http://127.0.0.1:54321',origin='http://127.0.0.1:4181',mailbox='http://127.0.0.1:54324'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Local only')
 const settings={auth:{persistSession:false}},service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const ownerEmail=uuid()+'@example.invalid',recipient=uuid()+'@example.com',password=uuid(),w=uuid(),contexts=[],ids=[]
 try{
  const {user}=await checked(service.auth.admin.createUser({email:ownerEmail,password,email_confirm:true}));ids.push(user.id)
  const owner=createClient(endpoint,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,settings)
  const {session}=await checked(owner.auth.signInWithPassword({email:ownerEmail,password}))
  await checked(service.from('hub_workspaces').insert({id:w,name:'Espaço do convite fictício'}))
  await checked(service.from('hub_members').insert({workspace_id:w,user_id:user.id,role:'admin'}))
  const adminContext=await browser.newContext();contexts.push(adminContext)
  const page=await adminContext.newPage();page.setDefaultTimeout(15000)
  await page.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),session)
  await page.goto(origin);await page.getByRole('button',{name:'Equipe',exact:true}).click();await openDisclosure(page,'Convites de integrantes')
  const form=page.getByRole('form',{name:'Novo convite'})
  await form.getByLabel('E-mail do convite',{exact:true}).fill(recipient)
  await form.getByRole('checkbox',{name:'Operação',exact:true}).check()
  await form.getByRole('checkbox',{name:'Financeiro',exact:true}).check()
  await form.getByRole('button',{name:'Criar convite',exact:true}).click()
  const card=page.getByRole('article',{name:'Convite para '+recipient})
  await expect(card).toContainText('Pendente')
  await expect(page.getByRole('status').filter({hasText:'Link de acesso solicitado'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Equipe',exact:true})).toBeVisible()
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.locator('.sidebar').evaluate(node=>node.getBoundingClientRect().right)).toBeLessThan(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:test.info().outputPath('convites-mobile.png'),fullPage:true})
  await page.setViewportSize({width:1280,height:720})
  let messageId
  await expect.poll(async()=>{
   const {messages}=await (await fetch(mailbox+'/api/v1/messages')).json()
   messageId=messages?.find(m=>m.To?.some(to=>to.Address===recipient))?.ID
   return Boolean(messageId)
  },{timeout:15000}).toBe(true)
  const {HTML}=await (await fetch(mailbox+'/api/v1/message/'+encodeURIComponent(messageId))).json()
  const href=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return [...doc.querySelectorAll('a[href]')].find(a=>a.href.includes('/auth/v1/verify?'))?.href},HTML)
  if(!href)throw Error('Local verification link missing')
  const verification=new URL(href)
  expect(verification.origin).toBe(endpoint)
  expect(new URL(verification.searchParams.get('redirect_to')).origin).toBe(origin)
  const recipientId=sql(`select id from auth.users where email=${literal(recipient)};`);ids.push(recipientId)
  const invitation=(await checked(owner.rpc('hub_list_invites',{w}))).find(i=>i.recipient_email===recipient)
  expect(await checked(service.from('hub_members').select('user_id').eq('workspace_id',w).eq('user_id',recipientId))).toHaveLength(0)
  const recipientContext=await browser.newContext();contexts.push(recipientContext)
  const receiver=await recipientContext.newPage();receiver.setDefaultTimeout(15000)
  await receiver.goto(verification.href)
  await expect(receiver.getByRole('heading',{name:'Meus convites',exact:true})).toBeVisible()
  await expect(receiver.getByRole('button',{name:'Captação e CRM',exact:true})).toHaveCount(0)
  await receiver.screenshot({path:test.info().outputPath('convite-destinatario.png'),fullPage:true})
  expect(await checked(service.from('hub_members').select('user_id').eq('workspace_id',w).eq('user_id',recipientId))).toHaveLength(0)
  await receiver.getByRole('button',{name:'Aceitar convite',exact:true}).click()
  await expect(receiver.getByRole('button',{name:'Financeiro',exact:true})).toBeVisible()
  await expect(receiver.getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
  await expect(receiver.getByRole('article',{name:'Convite de Espaço do convite fictício'})).toContainText('Aceito')
  await receiver.reload()
  await expect(receiver.getByText('Espaço do convite fictício',{exact:true})).toBeVisible()
  const event=await checked(owner.from('hub_role_audit').select('actor_id,accepted_by,grantor_id').eq('invite_id',invitation.id).single())
  expect(event).toEqual({actor_id:recipientId,accepted_by:recipientId,grantor_id:user.id})
  await page.getByRole('button',{name:'Atualizar convites',exact:true}).click()
  await expect(card).toContainText('Aceito')
  const pending=uuid()+'@example.invalid'
  await form.getByLabel('E-mail do convite',{exact:true}).fill(pending)
  await form.getByRole('checkbox',{name:'Comercial',exact:true}).check()
  await form.getByRole('checkbox',{name:'Enviar link de acesso por e-mail',exact:true}).uncheck()
  await form.getByRole('button',{name:'Criar convite',exact:true}).click()
  const pendingCard=page.getByRole('article',{name:'Convite para '+pending})
  await pendingCard.getByRole('button',{name:'Revogar convite',exact:true}).click()
  await expect(page.getByRole('dialog',{name:'Revogar convite pendente?'})).toBeVisible()
  await page.getByRole('button',{name:'Confirmar revogação',exact:true}).click()
  await expect(pendingCard).toContainText('Revogado')
  await page.route('**/auth/v1/otp**',route=>route.fulfill({status:503,contentType:'application/json',body:'{"msg":"Fictitious mail outage"}'}))
  const failed=uuid()+'@example.invalid'
  await form.getByLabel('E-mail do convite',{exact:true}).fill(failed)
  await form.getByRole('checkbox',{name:'Operação',exact:true}).check()
  await form.getByRole('checkbox',{name:'Enviar link de acesso por e-mail',exact:true}).check()
  await form.getByRole('button',{name:'Criar convite',exact:true}).click()
  await expect(page.getByRole('alert').filter({hasText:'envio do link está indisponível'})).toBeVisible()
  await expect(page.getByRole('article',{name:'Convite para '+failed})).toContainText('Pendente')
 }finally{
  for(const context of contexts)await context.close().catch(()=>{})
  for(const id of ids)if(id)await service.auth.admin.deleteUser(id)
 }
})
