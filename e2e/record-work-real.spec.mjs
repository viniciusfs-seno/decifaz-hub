import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {mkdir} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})

test('Ficha: resposta de salvamento anterior não reabre o registro depois de trocar de espaço',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(60000)
 const f=await operationalFixture();let release
 try{
  await checked(f.admin.from('hub_members').insert({workspace_id:f.other,user_id:f.owner.id,role:'admin'}))
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();if(await page.getByLabel('Espaço de trabalho').inputValue()!==f.workspace)await page.getByLabel('Espaço de trabalho').selectOption(f.workspace)
  await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click();await page.getByText('Editar dados do estabelecimento',{exact:true}).click();await page.getByLabel('Nome da empresa',{exact:true}).fill('Gravação tardia fictícia')
  let arrived;const received=new Promise(r=>{arrived=r}),gate=new Promise(r=>{release=r})
  await page.route('**/rpc/hub_save_commercial_lead',async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response})})
  await page.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click();await received;await page.getByLabel('Espaço de trabalho').selectOption(f.other);await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await expect(page.getByRole('main')).toContainText('Outro espaço fictício')
  const completed=page.waitForResponse(r=>r.url().includes('/rpc/hub_save_commercial_lead'));release();await(await completed).finished();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();await expect(page.getByLabel('Espaço de trabalho')).toHaveValue(f.other);await expect(page).not.toHaveURL(/estabelecimento/);await expect(page.getByText('Gravação tardia fictícia',{exact:true})).toHaveCount(0)
  expect((await checked(f.owner.client.from('hub_leads').select('name').eq('workspace_id',f.workspace).eq('id',f.prospect).single())).name).toBe('Gravação tardia fictícia');expect(await checked(f.owner.client.from('hub_leads').select('id').eq('workspace_id',f.other))).toEqual([])
 }finally{release?.();sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';delete from public.hub_registry_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})

test('Proposta: abrir uma linha desatualizada consulta a versão atual e preserva o histórico',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(60000)
 const f=await operationalFixture(),series=randomUUID(),v2=randomUUID(),body={title:'Versão atual fictícia',scope:'Escopo anterior',services:[],validity:f.today,setup:100,monthly:10,terms:'Condição fictícia'}
 try{
  const save=(id,version,scope)=>f.second.client.rpc('hub_save_proposal',{w:f.workspace,l:f.prospect,p:id,s:series,v:version,m:null,body:{...body,scope},decision:null,occurred:null,evidence:null})
  await checked(save(series,1,'Escopo anterior'))
  const previous=await checked(f.owner.client.from('hub_proposals_visible').select('id,lead_id,series_id,version,meeting_id,status,record').eq('workspace_id',f.workspace))
  let rejectFresh=true;await page.route('**/rest/v1/hub_proposals_visible?*',async route=>{if(!new URL(route.request().url()).searchParams.has('series_id'))await route.fulfill({status:200,json:previous});else if(rejectFresh)await route.fulfill({status:503,json:{message:'Falha fictícia'}});else await route.continue()})
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Propostas comerciais',exact:true}).click()
  const button=page.getByRole('button',{name:body.title,exact:true});await expect(page.getByRole('row').filter({has:button})).toContainText('v1 · Atual')
  await checked(save(v2,2,'Escopo da versão mais recente'))
  await button.click();await expect(page.getByRole('alert')).toContainText('Não foi possível abrir a versão atual',{timeout:15000});await expect(page.getByText('Consultando a versão atual da proposta…',{exact:true})).toHaveCount(0);rejectFresh=false
  await button.click();const dialog=page.getByRole('dialog');await expect(dialog).toContainText('Versão 2 · Rascunho');await expect(dialog.getByLabel(/^Escopo e entregáveis/)).toHaveValue('Escopo da versão mais recente');await expect(dialog.getByLabel(/^Nova situação/)).toBeVisible();await expect(page.getByRole('alert')).toHaveCount(0)
  await dialog.getByRole('button',{name:'v1 · Substituída',exact:true}).click();await expect(dialog).toContainText('Versão 1 · Substituída');await expect(dialog.getByRole('paragraph').filter({hasText:'Escopo anterior'})).toBeVisible();await expect(dialog.getByLabel(/^Nova situação/)).toHaveCount(0)
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();await expect(button).toBeFocused()
 }finally{sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';delete from public.hub_registry_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
test('Ficha dedicada: rascunho entre áreas, revisão original, URL e proposta em etapas',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(150000)
 const f=await operationalFixture()
 const nav=async name=>{const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name,exact:true}).click()}
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await nav('Captação e CRM');await page.getByLabel('Buscar leads').fill('Studio Aurora');await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click()
  await expect(page).toHaveURL(new RegExp('#estabelecimento/'+f.prospect+'$'));await expect(page.getByRole('heading',{name:'Ficha do estabelecimento',exact:true})).toBeVisible()
  await mkdir('.validation/record-captures',{recursive:true});await page.screenshot({path:'.validation/record-captures/ficha-desktop.png',fullPage:true})
  await page.getByText('Editar dados do estabelecimento',{exact:true}).click();await page.getByLabel('Nome da empresa',{exact:true}).fill('Rascunho fictício de pesquisa')
  await page.getByLabel(/^Resultado da abordagem/).fill('Rascunho fictício ainda não registrado')
  await nav('Agenda operacional');await nav('Captação e CRM');await expect(page.getByLabel('Buscar leads')).toHaveValue('Studio Aurora');await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click()
  await page.getByText('Editar dados do estabelecimento',{exact:true}).click();await expect(page.getByLabel('Nome da empresa',{exact:true})).toHaveValue('Rascunho fictício de pesquisa');await expect(page.getByLabel(/^Resultado da abordagem/)).toHaveValue('Rascunho fictício ainda não registrado')
  const actual=await checked(f.second.client.from('hub_leads').select('revision').eq('workspace_id',f.workspace).eq('id',f.prospect).single())
  await checked(f.second.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:actual.revision,body:{name:'Nome conferido na segunda sessão'}}))
  await page.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Outra sessão alterou a ficha');await expect(page.getByLabel('Nome da empresa',{exact:true})).toHaveValue('Nome conferido na segunda sessão')
  await nav('Dashboard');await page.goto('/#estabelecimento/'+f.prospect);await expect(page.getByRole('heading',{name:'Jornada comercial de Nome conferido na segunda sessão',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Nova proposta',exact:true}).click()
  const d=page.getByRole('dialog'),steps=d.getByRole('navigation',{name:'Etapas da proposta'})
  await d.getByLabel('Título',{exact:false}).fill('Proposta fictícia em etapas');await d.getByLabel(/^Escopo e entregáveis/).fill('Entrega fictícia preservada na versão')
  await steps.getByRole('button',{name:/Valores e condições/}).click();await d.getByLabel(/^Validade/).fill('');await steps.getByRole('button',{name:/Revisão e encaminhamento/}).click();await d.getByRole('button',{name:'Salvar rascunho',exact:true}).click()
  await expect(steps.getByRole('button',{name:/Valores e condições/})).toHaveAttribute('aria-current','step');await expect(d.getByLabel(/^Validade/)).toBeFocused();await expect(d.getByRole('alert')).toContainText('primeira pendência')
  await d.getByLabel(/^Validade/).fill(f.today);await d.getByLabel(/^Implantação/).fill('350');await d.getByLabel(/^Mensalidade/).fill('70');await steps.getByRole('button',{name:/Revisão e encaminhamento/}).click();await expect(d).toContainText('R$ 350,00');await page.screenshot({path:'.validation/record-captures/proposta-revisao.png',fullPage:true});await d.getByRole('button',{name:'Salvar rascunho',exact:true}).click();await expect(d).toHaveCount(0)
  const row=await checked(f.owner.client.from('hub_proposals_visible').select('record,version').eq('workspace_id',f.workspace).eq('record->>title','Proposta fictícia em etapas').single());expect(row.version).toBe(1);expect(row.record.scope).toBe('Entrega fictícia preservada na versão')
  const restricted=await checked(f.restricted.client.from('hub_proposals_visible').select('record').eq('workspace_id',f.workspace));for(const item of restricted)for(const key of ['setup','monthly','terms'])expect(item.record).not.toHaveProperty(key)
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await page.evaluate(()=>window.scrollTo(0,0));const nextAction=page.getByRole('button',{name:'Registrar abordagem ou planejar contato',exact:true});await expect(nextAction).toBeVisible();expect(await nextAction.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight)).toBe(true)
  await page.screenshot({path:'.validation/record-captures/ficha-mobile-escuro.png',fullPage:true})
  await nav('Captação e CRM');await page.getByLabel('Buscar leads').fill('Café Horizonte');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).click();await page.getByRole('button',{name:/^Projeto · Em andamento/}).click();await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click();await expect(page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício',exact:true})).toBeVisible();await page.getByRole('button',{name:'← Voltar à lista',exact:true}).click();await expect(page.getByLabel('Buscar leads')).toHaveValue('Café Horizonte');await expect(page.locator('[data-crm-lead="'+f.lead+'"]')).toBeFocused()
 }finally{sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';delete from public.hub_registry_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
