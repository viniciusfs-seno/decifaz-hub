import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
async function nav(page,name){await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
test.use({actionTimeout:15000})
test('Busca global: projeção limitada, autorização, isolamento e sessão desativada',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  const search=(client,w=f.workspace,q='horizonte',result_limit=20)=>client.rpc('hub_search_records',{w,q,result_limit})
  const rows=await checked(search(f.restricted.client));expect(new Set(rows.map(r=>r.kind))).toEqual(new Set(['lead','project','contract']))
  for(const row of rows){expect(Object.keys(row).sort()).toEqual(['detail','id','kind','lead_id','title']);expect(JSON.stringify(row)).not.toMatch(/2400|180|Condição|scope|financial|snapshot/)}
  expect((await checked(search(f.owner.client,f.workspace,'CAFE'))).some(r=>r.id===f.lead)).toBe(true)
  expect(await checked(search(f.owner.client,f.workspace,'%_'))).toEqual([])
  expect(await checked(search(f.owner.client,f.workspace,'a'))).toEqual([])
  expect((await search(f.owner.client,f.workspace,'x'.repeat(101))).error?.code).toBe('22023')
  const ids=Array.from({length:25},()=>randomUUID());await checked(f.admin.from('hub_leads').insert(ids.map(id=>({workspace_id:f.workspace,id,name:'Empate busca fictícia',segment:'Teste',city:'Fortaleza',stage:'Novo'}))))
  const first=await checked(search(f.owner.client,f.workspace,'Empate busca',100)),again=await checked(search(f.owner.client,f.workspace,'Empate busca',100));expect(first).toHaveLength(20);expect(again).toEqual(first);expect(first.map(r=>r.id)).toEqual([...ids].sort().slice(0,20))
  expect((await search(f.owner.client,f.other)).error?.code).toBe('42501')
  const foreignId=randomUUID();await checked(f.admin.from('hub_leads').insert({workspace_id:f.other,id:foreignId,name:'Horizonte de outro espaço',segment:'Teste',city:'Fortaleza',stage:'Novo'}));expect((await checked(search(f.restricted.client))).some(r=>r.id===foreignId)).toBe(false)
  const anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});expect((await search(anon)).error?.code).toBe('42501')
  const member=(await checked(f.owner.client.rpc('hub_list_members',{w:f.workspace}))).find(m=>m.user_id===f.restricted.id)
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:member.revision}))
  expect((await search(f.restricted.client,f.workspace,'')).error?.code).toBe('42501');expect((await search(f.restricted.client)).error?.code).toBe('42501')
  expect((await checked(search(f.restricted.client,f.other))).map(r=>r.id)).toEqual([foreignId])
 }finally{await f.cleanup()}
})
test('Busca global: teclado, recuperação, troca rápida de termo e abertura do contexto',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await expect(page.getByRole('button',{name:'Buscar registros',exact:true})).toBeEnabled()
  await page.keyboard.press('Control+k');let dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Nome ou cidade')).toBeFocused()
  let fail=true;await page.route('**/rpc/hub_search_records',async route=>{if(fail){fail=false;await route.fulfill({status:503,json:{message:'Falha fictícia'}})}else await route.continue()})
  await dialog.getByLabel('Nome ou cidade').fill('horizonte');await expect(dialog.getByRole('alert')).toBeVisible();await dialog.getByRole('button',{name:'Tentar novamente a busca'}).click();await expect(dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})})).toHaveCount(1)
  await dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})}).click();await expect(page).toHaveURL(new RegExp('estabelecimento/'+f.lead));await expect(page.getByLabel('Nome do estabelecimento',{exact:true})).toHaveValue('Café Horizonte · fictício')
  await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByRole('button').filter({hasText:'Pedidos digitais · Horizonte'}).click();await expect(page.getByRole('heading',{name:/Pedidos digitais · Horizonte/})).toBeVisible()
  await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByRole('button').filter({hasText:'Contrato fictício · Café Horizonte'}).click();await expect(page.getByRole('dialog',{name:'Contrato · Contrato fictício · Café Horizonte'})).toBeVisible();await page.keyboard.press('Escape')
  await nav(page,'Dashboard');await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByLabel('Nome ou cidade').fill('nenhum resultado fictício');await expect(dialog.getByText('Nenhum registro autorizado encontrado',{exact:true})).toBeVisible();await expect(dialog.getByRole('button').filter({hasText:'Café Horizonte'})).toHaveCount(0);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
 }finally{await f.cleanup()}
})
