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
