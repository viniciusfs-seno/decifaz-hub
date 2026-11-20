import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import {mkdir} from 'node:fs/promises'
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
  const ids=Array.from({length:25},()=>randomUUID());await checked(f.admin.from('hub_leads').insert(ids.map(id=>({workspace_id:f.workspace,id,name:'Empate busca fictícia',segment:'Teste',city:'Fortaleza',stage:'Identificado'}))))
  const first=await checked(search(f.owner.client,f.workspace,'Empate busca',100)),again=await checked(search(f.owner.client,f.workspace,'Empate busca',100));expect(first).toHaveLength(20);expect(again).toEqual(first);expect(first.map(r=>r.id)).toEqual([...ids].sort().slice(0,20))
  expect((await search(f.owner.client,f.other)).error?.code).toBe('42501')
  const foreignId=randomUUID();await checked(f.admin.from('hub_leads').insert({workspace_id:f.other,id:foreignId,name:'Horizonte de outro espaço',segment:'Teste',city:'Fortaleza',stage:'Identificado'}));expect((await checked(search(f.restricted.client))).some(r=>r.id===foreignId)).toBe(false)
  const anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});expect((await search(anon)).error?.code).toBe('42501')
  const member=(await checked(f.owner.client.rpc('hub_list_members',{w:f.workspace}))).find(m=>m.user_id===f.restricted.id)
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:member.revision}))
  expect((await search(f.restricted.client,f.workspace,'')).error?.code).toBe('42501');expect((await search(f.restricted.client)).error?.code).toBe('42501')
  expect((await checked(search(f.restricted.client,f.other))).map(r=>r.id)).toEqual([foreignId])
 }finally{await f.cleanup()}
})
test('Busca global: respostas antigas, cancelamento da abertura e celular entre espaços',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f);let release,openingRelease
 try{
  await checked(f.admin.from('hub_members').insert({workspace_id:f.other,user_id:f.owner.id,role:'admin'}))
  await page.setViewportSize({width:390,height:844});await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click()
  if(await page.getByLabel('Espaço de trabalho').inputValue()!==f.workspace)await page.getByLabel('Espaço de trabalho').selectOption(f.workspace)
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await page.getByRole('button',{name:'Buscar registros',exact:true}).click();let dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true})
  let arrived;const received=new Promise(r=>{arrived=r}),gate=new Promise(r=>{release=r})
  await page.route('**/rpc/hub_search_records',async route=>{if(route.request().postDataJSON().q==='consulta antiga'){arrived();await gate;await route.fulfill({status:200,json:[{kind:'lead',id:f.lead,title:'RESULTADO ANTIGO FICTÍCIO',detail:'Não deve aparecer',lead_id:f.lead}]}).catch(()=>{});return}await route.continue()})
  await dialog.getByLabel('Nome ou cidade').fill('consulta antiga');await received;await dialog.getByLabel('Nome ou cidade').fill('sem correspondência fictícia');await expect(dialog.getByText('Nenhum registro autorizado encontrado',{exact:true})).toBeVisible();release();await expect(dialog).not.toContainText('RESULTADO ANTIGO FICTÍCIO')
  await dialog.getByLabel('Nome ou cidade').fill('horizonte');await expect(dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})})).toBeVisible();await mkdir('.validation/search-captures',{recursive:true});await page.screenshot({path:'.validation/search-captures/busca-mobile-escuro.png',fullPage:false});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  let openingArrived;const openingReceived=new Promise(r=>{openingArrived=r}),openingGate=new Promise(r=>{openingRelease=r})
  await page.route('**/rest/v1/hub_leads?*',async route=>{if(new URL(route.request().url()).searchParams.get('id')!=='eq.'+f.lead){await route.continue();return}const response=await route.fetch();openingArrived();await openingGate;await route.fulfill({response}).catch(()=>{})})
  await dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})}).click();await openingReceived;await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);openingRelease();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await expect(page).not.toHaveURL(/estabelecimento/)
  await page.getByLabel('Espaço de trabalho').selectOption(f.other);await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await expect(dialog.getByText('Nenhum registro autorizado encontrado',{exact:true})).toBeVisible()
 }finally{release?.();openingRelease?.();await f.cleanup()}
})
test('Busca global: teclado, recuperação, troca rápida de termo e abertura do contexto',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await expect(page.getByRole('button',{name:'Buscar registros',exact:true})).toBeEnabled()
  await page.keyboard.press('Control+k');let dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await expect(dialog).toBeVisible();await expect(dialog.getByLabel('Nome ou cidade')).toBeFocused()
  let fail=true;await page.route('**/rpc/hub_search_records',async route=>{if(fail){fail=false;await route.fulfill({status:503,json:{message:'Falha fictícia'}})}else await route.continue()})
  await dialog.getByLabel('Nome ou cidade').fill('horizonte');await expect(dialog.getByRole('alert')).toBeVisible();await dialog.getByRole('button',{name:'Tentar novamente a busca'}).click();await expect(dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})})).toHaveCount(1)
  await dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})}).click();await expect(page).toHaveURL(new RegExp('estabelecimento/'+f.lead));await expect(page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByRole('button').filter({hasText:'Pedidos digitais · Horizonte'}).click();await expect(page.getByRole('dialog',{name:'Pedidos digitais · Horizonte',exact:true})).toBeVisible();await expect(dialog).toHaveCount(0);await page.keyboard.press('Control+k');await expect(page.getByRole('dialog',{name:'Buscar registros',exact:true})).toHaveCount(0);await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByRole('button').filter({hasText:'Contrato fictício · Café Horizonte'}).click();await expect(page.getByRole('dialog',{name:'Contrato · Contrato fictício · Café Horizonte'})).toBeVisible();await page.keyboard.press('Escape')
  await nav(page,'Dashboard');await page.getByRole('button',{name:'Buscar registros',exact:true}).click();dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('horizonte');await dialog.getByLabel('Nome ou cidade').fill('nenhum resultado fictício');await expect(dialog.getByText('Nenhum registro autorizado encontrado',{exact:true})).toBeVisible();await expect(dialog.getByRole('button').filter({hasText:'Café Horizonte'})).toHaveCount(0);await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0)
 }finally{await f.cleanup()}
})
