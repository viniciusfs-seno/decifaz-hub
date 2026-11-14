import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'

test('membros compartilham chamados e contas externas ficam isoladas',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer a pilha local do Supabase.')
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw new Error('Use exclusivamente o Supabase local.')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,options)
 async function checked(operation){
  const {data,error}=await operation
  if(error)throw error
  if(data===false)throw new Error('Operação recusada')
  return data
 }
 const workspace=randomUUID(), lead=randomUUID(), proposal=randomUUID()
 await checked(admin.from('hub_workspaces').insert({id:workspace,name:'Decifaz E2E'}))
 await checked(admin.from('hub_leads').insert({workspace_id:workspace,id:lead,name:'Cliente fictício'}))
 async function account(member){
  const email=randomUUID()+'@example.com',password=randomUUID()
  const {user}=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}))
  if(member)await checked(admin.from('hub_members').insert({workspace_id:workspace,user_id:user.id}))
  const client=createClient(endpoint,key,options)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {client,session}
 }
 const first=await account(true),second=await account(true),outsider=await account(false)
 const rpc=(name,args)=>checked(first.client.rpc(name,args))
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
 const args={w:workspace,l:lead,p:proposal,s:proposal,v:1,m:null}
 await rpc('hub_save_proposal',{...args,body:{title:'Projeto E2E',scope:'Escopo de teste',validity:date,setup:100,monthly:0,services:[]},decision:null,occurred:null,evidence:null})
 for(const decision of ['Enviada','Aceita'])await rpc('hub_save_proposal',{...args,body:null,decision,occurred:date,evidence:'Evidência fictícia'})
 await rpc('hub_open_project',{w:workspace,p:proposal})

 async function open(target,session){
  await target.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),session)
  await target.goto('/')
 }
 await open(page,first.session)
 await page.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
 await page.getByRole('button',{name:'Projeto E2E',exact:true}).click()
 await page.getByLabel('Título do chamado').fill('Ajuste E2E')
 await page.getByLabel('Responsável pelo chamado').fill('Equipe E2E')
 await page.getByRole('button',{name:'Abrir chamado'}).click()
 await expect(page.getByText('Ajuste E2E',{exact:true})).toBeVisible()

 const other=await browser.newContext()
 try{
  const secondPage=await other.newPage()
  await open(secondPage,second.session)
  await secondPage.getByRole('button',{name:'Agenda operacional',exact:true}).click()
  await secondPage.getByLabel('Situação de Ajuste E2E').selectOption('Concluída')
  await expect(secondPage.getByText('Ajuste E2E',{exact:true})).toHaveCount(0)
  const rows=await checked(second.client.from('hub_activities').select('status').eq('workspace_id',workspace).eq('title','Ajuste E2E'))
  expect(rows).toEqual([{status:'Concluída'}])
  expect(await checked(outsider.client.from('hub_activities').select('id').eq('workspace_id',workspace))).toEqual([])
 }finally{await other.close()}
})

test('link mágico do e-mail local abre o Hub e mantém a sessão após recarregar',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer a pilha local do Supabase.')
 const endpoint='http://127.0.0.1:54321'
 const origin='http://127.0.0.1:4181'
 const mailbox='http://127.0.0.1:54324'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw new Error('Use exclusivamente o Supabase local.')
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const email=randomUUID()+'@example.com'
 const workspace=randomUUID()
 const {data:{user},error}=await admin.auth.admin.createUser({email,email_confirm:true})
 if(error||!user)throw new Error('Falha ao criar a conta de teste.')
 const space=await admin.from('hub_workspaces').insert({id:workspace,name:'Decifaz Link Mágico'})
 if(space.error)throw space.error
 const member=await admin.from('hub_members').insert({workspace_id:workspace,user_id:user.id})
 if(member.error)throw member.error

 await page.goto('/')
 await page.getByLabel('E-mail',{exact:true}).fill(email)
 await page.getByRole('button',{name:'Enviar link de acesso'}).click()
 await expect(page.getByText('Confira seu e-mail para entrar.')).toBeVisible()

 let messageId
 await expect.poll(async()=>{
  const response=await fetch(mailbox+'/api/v1/messages')
  if(!response.ok)return false
  const {messages}=await response.json()
  messageId=messages?.find(message=>message.To?.some(recipient=>recipient.Address===email))?.ID
  return Boolean(messageId)
 },{timeout:15000,message:'O e-mail deve chegar à caixa local do destinatário'}).toBe(true)

 const response=await fetch(mailbox+'/api/v1/message/'+encodeURIComponent(messageId))
 expect(response.ok).toBe(true)
 const {HTML}=await response.json()
 const href=await page.evaluate(html=>{
  const document=new DOMParser().parseFromString(html,'text/html')
  return [...document.querySelectorAll('a[href]')].find(link=>link.href.includes('/auth/v1/verify?'))?.href
 },HTML)
 if(!href)throw new Error('O e-mail não contém o link de verificação.')
 const verification=new URL(href)
 if(verification.origin!==endpoint||verification.pathname!=='/auth/v1/verify'||verification.searchParams.get('redirect_to')!==origin+'/'){
  throw new Error('O link de teste aponta para um destino inesperado.')
 }
 await page.goto(verification.href)
 await expect(page.getByText('Decifaz Link Mágico',{exact:true})).toBeVisible()
 await expect(page).toHaveURL(origin+'/')
 await page.reload()
 await expect(page.getByText('Decifaz Link Mágico',{exact:true})).toBeVisible()
})
