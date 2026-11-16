import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {weekStart} from '../src/management-data.ts'
test('Gerencial: período/CSV, fechamento concorrente, ações atômicas, histórico e autorização',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture(),context=await browser.newContext(),other=await context.newPage()
 const open=async(p,s)=>{await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),s);await p.goto('/')}
 try{
  await open(page,f.owner.session);await open(other,f.second.session)
  await page.getByRole('navigation').getByRole('button',{name:'Indicadores',exact:true}).click()
  await page.getByLabel('Indicadores de',{exact:true}).fill(f.today.slice(0,7)+'-01');await page.getByLabel('Indicadores até',{exact:true}).fill(f.today)
  await page.getByRole('button',{name:/Receita prevista/}).click();await expect(page.getByRole('dialog')).toContainText('2.400,00');await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar indicadores CSV'}).click();let csv='';for await(const chunk of await (await downloading).createReadStream())csv+=chunk.toString()
  expect(csv).toContain('"2400,00"');expect(csv).toContain('"800,00"');expect(csv).toContain('Conversão: denominador')
  await page.getByLabel('Responsável dos indicadores').selectOption('Caio · fictício')
  const filteredDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar indicadores CSV'}).click();let filteredCsv='';for await(const chunk of await (await filteredDownload).createReadStream())filteredCsv+=chunk.toString()
  expect(filteredCsv).not.toContain('2400,00');expect(filteredCsv).not.toContain('800,00')
  await page.getByLabel('Responsável dos indicadores').selectOption('')
  for(const p of [page,other])await p.getByRole('navigation').getByRole('button',{name:'Revisão semanal',exact:true}).click()
  for(const p of [page,other]){await p.getByLabel('Resumo da semana').fill('Fechamento em duas sessões');await p.getByLabel('Decisões da semana').fill('Priorizar diagnóstico fictício')}
  await page.getByLabel('Origem da ação').selectOption(f.prospect);await page.getByLabel('Ação do fechamento').fill('Planejar a semana seguinte');await page.getByLabel('Responsável do fechamento').fill('Caio fictício');await page.getByRole('button',{name:'Adicionar ao plano do fechamento'}).click()
  await page.getByRole('button',{name:'Salvar fechamento semanal'}).click();await expect(page.getByText('Fechamento salvo com suas ações na mesma transação.')).toBeVisible()
  await other.getByRole('button',{name:'Salvar fechamento semanal'}).click();await expect(other.getByRole('alert')).toContainText('Outra sessão alterou')
  expect(await checked(f.admin.from('hub_weekly_closure_history').select('revision').eq('workspace_id',f.workspace))).toHaveLength(1)
  const params={w:f.workspace,start_on:weekStart(f.today),expected_revision:1,summary_text:'Fechamento API concorrente',decision_text:'Decisão',planned:[]}
  const results=await Promise.all([f.owner.client,f.second.client].map(c=>checked(c.rpc('hub_close_week',params))))
  expect(results.map(r=>r.status).sort()).toEqual(['conflict','saved'])
  expect(await checked(f.admin.from('hub_weekly_closure_history').select('revision').eq('workspace_id',f.workspace))).toHaveLength(2)
  expect((await f.restricted.client.rpc('hub_close_week',{...params,expected_revision:2})).error?.code).toBe('42501')
  expect((await f.owner.client.from('hub_weekly_closure_history').delete().eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  await checked(f.admin.from('hub_weekly_closures').insert({workspace_id:f.other,week_start:weekStart(f.today),revision:1,summary:'Fechamento de outro espaço',decisions:'Fictício',actions:[],actor_id:f.owner.id}))
  expect(await checked(f.owner.client.from('hub_weekly_closures').select('*').eq('workspace_id',f.other))).toEqual([])
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:0}))
  expect(await checked(f.restricted.client.from('hub_weekly_closures').select('*').eq('workspace_id',f.workspace))).toEqual([])
  expect(await checked(f.restricted.client.from('hub_weekly_closures').select('summary').eq('workspace_id',f.other))).toHaveLength(1)
 }finally{await context.close();await f.cleanup()}
})
