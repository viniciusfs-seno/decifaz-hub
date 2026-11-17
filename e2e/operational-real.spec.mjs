import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {mkdir} from 'node:fs/promises'

test('Operacional: recortes, revisão concorrente, duas sessões, papéis e vínculo desativado',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer pilha local.')
 test.setTimeout(120000)
 const f=await operationalFixture(),context=await browser.newContext(),second=await context.newPage()
 const open=async(p,session)=>{await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session);await p.goto('/')}
 const nav=async(p,name)=>{const toggle=p.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await p.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
 try{
  await open(page,f.owner.session);await open(second,f.second.session)
  await expect(page.getByRole('heading',{name:'Fila de ações'})).toBeVisible()
  await expect(page.getByText('R$ 2.400,00',{exact:true})).toBeVisible()
  await expect(page.getByText('R$ 800,00',{exact:true})).toBeVisible()
  await page.getByRole('button',{name:/Atividades vencidas/}).click()
  await expect(page.getByRole('button',{name:'Vencidas',exact:true})).toHaveAttribute('aria-pressed','true')
  await expect(page.getByRole('button',{name:'Enviar diagnóstico revisado',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Confirmar prioridade da automação',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Hoje',exact:true}).click()
  await expect(page.getByRole('button',{name:'Confirmar prioridade da automação',exact:true})).toBeVisible()
  await page.getByLabel('Buscar na agenda').fill('inexistente')
  await expect(page.getByText('Nenhum compromisso neste recorte')).toBeVisible()
  await page.getByRole('button',{name:'Limpar filtros da agenda'}).click()
  await nav(page,'Revisão semanal');await nav(second,'Revisão semanal')
  const article=p=>p.getByRole('article').filter({has:p.getByRole('heading',{name:'Studio Aurora · fictício',exact:true})})
  await article(page).getByRole('button',{name:'Planejar ação',exact:true}).click()
  await article(second).getByRole('button',{name:'Planejar ação',exact:true}).click()
  for(const p of [page,second]){await p.getByLabel('Ação vinculada').fill('Revisar prioridade sem duplicar');await p.getByLabel('Responsável pela ação').fill('Caio · fictício')}
  await Promise.all([page.getByRole('button',{name:'Salvar ação da revisão'}).click(),second.getByRole('button',{name:'Salvar ação da revisão'}).click()])
  await expect(page.getByRole('dialog')).toHaveCount(0);await expect(second.getByRole('dialog')).toHaveCount(0)
  const actions=await checked(f.admin.from('hub_activities').select('id,title').eq('workspace_id',f.workspace).eq('review_id',f.prospect))
  expect(actions).toHaveLength(1)
  const concurrent={w:f.workspace,k:'meeting',s:f.meeting,t:'Preparar diagnóstico em conjunto',o:'Equipe fictícia',d:f.today}
  const ids=await Promise.all([checked(f.owner.client.rpc('hub_review_action',concurrent)),checked(f.second.client.rpc('hub_review_action',concurrent))])
  expect(ids[0]).toBe(ids[1])
  expect(await checked(f.admin.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('review_id',f.meeting))).toHaveLength(1)
  const simultaneous=await Promise.all([f.owner.client,f.second.client].map(client=>checked(client.rpc('hub_review_action',{w:f.workspace,k:'meeting',s:f.meeting,t:'Retomar diagnóstico',o:'Equipe fictícia',d:f.today}))))
  expect(simultaneous[0]).toBe(simultaneous[1])
  expect(await checked(f.admin.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('review_id',f.meeting))).toHaveLength(1)
  // The second session must see a real write from the first, through normal refresh.
  await nav(second,'Dashboard')
  await checked(f.owner.client.from('hub_activities').update({title:'Prioridade atualizada na outra sessão'}).eq('id',actions[0].id))
  await second.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(second.getByRole('button',{name:/Prioridade atualizada na outra sessão/})).toBeVisible()
  await nav(second,'Agenda operacional')
  await expect(second.getByRole('button',{name:'Prioridade atualizada na outra sessão',exact:true})).toBeVisible()
  await second.getByRole('button',{name:'Prioridade atualizada na outra sessão',exact:true}).click()
  await expect(second.getByRole('heading',{name:'Jornada comercial de Studio Aurora · fictício'})).toBeVisible()
  // Financial JSON and cross-space writes remain server-protected.
  expect((await f.restricted.client.from('hub_projects').select('approved')).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_review_action',{w:f.other,k:'lead',s:f.prospect,t:'Outra origem',o:'Fictício',d:f.today})).error?.code).toBe('42501')
  await open(second,f.restricted.session)
  await expect(second.getByText('Valores financeiros são restritos',{exact:false})).toBeVisible()
  await expect(second.getByRole('navigation').getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
  expect((await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:0}))).status).toBe('saved')
  await second.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(second.getByText('Outro espaço fictício',{exact:true})).toBeVisible()
  expect(await checked(f.restricted.client.from('hub_leads').select('id').eq('workspace_id',f.workspace))).toEqual([])
  expect((await f.restricted.client.rpc('hub_review_action',{w:f.workspace,k:'lead',s:f.prospect,t:'Sessão antiga',o:'Fictício',d:f.today})).error?.code).toBe('42501')
  if(process.env.HUB_CAPTURE==='1'){
   await mkdir('docs/operacional/capturas',{recursive:true})
   for(const [name,width,height] of [['desktop',1440,1000],['celular',390,844]]){
    await page.setViewportSize({width,height});await nav(page,'Dashboard')
    await page.screenshot({path:`docs/operacional/capturas/dashboard-${name}.png`,fullPage:true})
    await nav(page,'Agenda operacional');await page.screenshot({path:`docs/operacional/capturas/agenda-${name}.png`,fullPage:true})
    await page.getByRole('button',{name:'Acompanhar implantação do cardápio',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
    await nav(page,'Captação e CRM');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício'})).toBeVisible()
    await page.screenshot({path:`docs/operacional/capturas/ficha-${name}.png`,fullPage:true})
   }
  }
 }finally{await context.close();await f.cleanup()}
})
