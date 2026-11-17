import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('CRM: busca/contagem/exportação completa acima de 1000, ordem estável, filtros e retorno à página',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(120000)
 const f=await operationalFixture()
 try{
  await checked(f.admin.from('hub_leads').insert(Array.from({length:1005},(_,i)=>({workspace_id:f.workspace,name:'Volume fictício '+String(i).padStart(4,'0'),segment:'Teste',city:'Fortaleza',created_at:'2026-11-01T12:00:00Z',profile:{owner:i%2?'Equipe B':'Equipe A'}}))))
  const params={w:f.workspace,q:'Volume',sort_by:'Nome',page_size:25,page_offset:0}
  const first=await checked(f.owner.client.rpc('hub_crm_page',params)),next=await checked(f.owner.client.rpc('hub_crm_page',{...params,page_offset:25}))
  expect(first.total).toBe(1005);expect(first.rows).toHaveLength(25);expect(next.rows[0].name).toBe('Volume fictício 0025');expect(new Set([...first.rows,...next.rows].map(l=>l.id)).size).toBe(50)
  expect((await checked(f.owner.client.rpc('hub_crm_page',{...params,q:'cafe'}))).rows[0].id).toBe(f.lead)
  const csv=await checked(f.restricted.client.rpc('hub_crm_export',{w:f.workspace,q:'Volume',s:'',o:'Equipe A',p:'',sort_by:'Nome'}))
  expect(csv.split('\r\n')).toHaveLength(504);expect(csv).not.toContain('Equipe B');expect(csv).not.toContain('2400')
  expect((await f.owner.client.rpc('hub_crm_page',{...params,w:f.other})).error?.code).toBe('42501')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click()
  await page.getByLabel('Buscar leads').fill('Volume')
  await expect(page.getByRole('navigation',{name:'Páginas do CRM'})).toContainText('1–25 de 1005')
  await page.getByRole('combobox',{name:'Ordenar',exact:true}).selectOption('Nome')
  await page.getByRole('button',{name:'Próxima página',exact:true}).click()
  await expect(page.getByRole('navigation',{name:'Páginas do CRM'})).toContainText('26–50 de 1005')
  await page.getByRole('button',{name:'Volume fictício 0025',exact:true}).click()
  await page.getByRole('button',{name:'← Voltar à lista',exact:true}).click()
  await expect(page.getByRole('navigation',{name:'Páginas do CRM'})).toContainText('26–50 de 1005')
  await expect(page.getByLabel('Buscar leads')).toHaveValue('Volume')
  await expect(page.getByRole('button',{name:'Volume fictício 0025',exact:true})).toBeFocused()
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar CRM CSV'}).click();let exported='';for await(const c of await(await download).createReadStream())exported+=c.toString()
  expect(exported.replace(/^\uFEFF/,'').split('\r\n')).toHaveLength(1006)
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Dashboard',exact:true}).click()
  await expect(page.getByRole('button',{name:/Estabelecimentos/})).toContainText('1008')
 }finally{sql(`delete from public.hub_lead_audit where workspace_id='${f.workspace}';`);await f.cleanup()}
})
