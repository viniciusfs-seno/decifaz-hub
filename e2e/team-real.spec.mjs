import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'

test('Equipe: admin edita conjuntos, servidor nega usuário comum e outro espaço, último admin permanece',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente pilha fictícia local.')
 test.setTimeout(90000)
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Somente Supabase local')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY,settings={auth:{persistSession:false}}
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async operation=>{const {data,error}=await operation;if(error)throw error;return data}
 const w=uuid(),other=uuid(),users=[],contexts=[]
 async function account(){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(service.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id)
  const client=createClient(endpoint,key,settings)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,email,client,session}
 }
 async function open(person){
  const context=await browser.newContext();contexts.push(context)
  const page=await context.newPage()
  page.setDefaultTimeout(15000)
  await page.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),person.session)
  await page.goto('http://127.0.0.1:4181')
  await expect(page.getByRole('button',{name:'Sair',exact:true})).toBeVisible()
  return page
 }
 try{
  const owner=await account(),member=await account(),external=await account()
  await checked(service.from('hub_workspaces').insert([{id:w,name:'Equipe fictícia'},{id:other,name:'Outro espaço fictício'}]))
  await checked(service.from('hub_members').insert([{workspace_id:w,user_id:owner.id,role:'admin'},{workspace_id:w,user_id:member.id,role:'commercial'},{workspace_id:other,user_id:owner.id,role:'commercial'},{workspace_id:other,user_id:external.id,role:'admin'}]))
  const page=await open(owner)
  await page.getByRole('button',{name:'Equipe',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Equipe',exact:true})).toBeVisible()
  await expect(page.getByRole('form',{name:/^Papéis de /})).toHaveCount(2)
  await page.screenshot({path:test.info().outputPath('equipe-desktop.png'),fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await expect.poll(()=>page.locator('.sidebar').evaluate(node=>node.getBoundingClientRect().right)).toBeLessThan(1)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:test.info().outputPath('equipe-mobile.png'),fullPage:true})
  await page.setViewportSize({width:1280,height:720})
  await expect(page.getByText(external.email,{exact:true})).toHaveCount(0)
  const form=page.getByRole('form',{name:'Papéis de '+member.email})
  await form.getByRole('checkbox',{name:'Comercial',exact:true}).uncheck()
  await form.getByRole('checkbox',{name:'Operação',exact:true}).check()
  await form.getByRole('checkbox',{name:'Financeiro',exact:true}).check()
  await form.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect(form.getByRole('checkbox',{name:'Operação',exact:true})).toBeChecked()
  await expect(form.getByRole('checkbox',{name:'Financeiro',exact:true})).toBeChecked()
  await expect.poll(async()=> (await checked(owner.client.rpc('hub_list_members',{w}))).find(row=>row.user_id===member.id)?.roles).toEqual(['finance','operations'])
  await page.getByRole('button',{name:'Atualizar equipe',exact:true}).click()
  await expect(form.getByRole('checkbox',{name:'Comercial',exact:true})).not.toBeChecked()
  const own=page.getByRole('form',{name:'Papéis de '+owner.email})
  await own.getByRole('checkbox',{name:'Administração',exact:true}).uncheck()
  await own.getByRole('checkbox',{name:'Comercial',exact:true}).check()
  await own.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect(own.getByRole('alert')).toContainText('pelo menos um administrador')
  expect(await checked(owner.client.rpc('hub_can',{w,module:'admin',writing:true}))).toBe(true)
  expect((await member.client.rpc('hub_list_members',{w})).error?.code).toBe('42501')
  expect(await checked(member.client.rpc('hub_set_roles',{w,u:owner.id,r:['finance']}))).toBe(false)
  expect((await owner.client.rpc('hub_list_members',{w:other})).error?.code).toBe('42501')
  expect(await checked(owner.client.rpc('hub_set_roles',{w:other,u:external.id,r:['finance']}))).toBe(false)
  const common=await open(member)
  await expect(common.getByRole('button',{name:'Atualizar',exact:true})).toBeEnabled()
  await expect(common.getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
  await page.getByRole('combobox',{name:'Espaço de trabalho',exact:true}).selectOption(other)
  await expect(page.getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
  await expect(page.getByText('Seu papel não permite gerir a equipe deste espaço.',{exact:true})).toBeVisible()
  await expect(page.getByText(member.email,{exact:true})).toHaveCount(0)
  // A second fictitious admin permits self-demotion; the UI must drop access.
  expect(await checked(owner.client.rpc('hub_set_roles',{w,u:member.id,r:['admin','commercial']}))).toBe(true)
  await page.getByRole('combobox',{name:'Espaço de trabalho',exact:true}).selectOption(w)
  await own.getByRole('checkbox',{name:'Administração',exact:true}).uncheck()
  await own.getByRole('checkbox',{name:'Comercial',exact:true}).check()
  await own.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect(page.getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
  await expect(page.getByText('Seu papel não permite gerir a equipe deste espaço.',{exact:true})).toBeVisible()
  expect((await owner.client.rpc('hub_list_members',{w})).error?.code).toBe('42501')
  await expect(page.getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
  expect(await checked(owner.client.rpc('hub_can',{w,module:'admin',writing:true}))).toBe(false)
  expect(await checked(owner.client.rpc('hub_can',{w,module:'finance',writing:true}))).toBe(false)
  expect(await checked(owner.client.rpc('hub_can',{w,module:'projects',writing:true}))).toBe(false)
  expect((await owner.client.rpc('hub_update_member_roles',{w,u:member.id,r:['finance'],expected_revision:'0'})).error?.code).toBe('42501')
 }finally{
  for(const context of contexts)await context.close().catch(()=>{})
  for(const id of users)await service.auth.admin.deleteUser(id)
 }
})
