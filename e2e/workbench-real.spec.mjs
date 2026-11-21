import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {recordTab} from './helpers/portal-ui.mjs'

test.use({actionTimeout:15000})
test('Mesa de trabalho: recortes exatos, ação na primeira tela e navegação responsiva autorizada',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente dados fictícios locais.');test.setTimeout(150000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  for(const [user,width,dark] of [[f.owner,1440,false],[f.owner,390,true],[f.restricted,320,false]]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage()
   try{
    await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),user.session);await page.goto('/')
    await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible()
    const theme=page.getByRole('button',{name:dark?'Ativar tema escuro':'Ativar tema claro',exact:true});if(await theme.count())await theme.click()
    await page.evaluate(()=>document.fonts.ready)
    await expect(page.locator('.op-queue').getByRole('button').first()).toBeVisible()
    const first=await page.locator('.op-queue').getByRole('button').first().boundingBox()
    if(user===f.owner)expect(first.y+first.height).toBeLessThanOrEqual(844)
    await expect(page.locator('.op-queue')).toContainText('Aviso de renovação');await expect(page.locator('.op-queue')).toContainText('Aviso de término/cancelamento')
    for(const label of ['Vencidos','Hoje','Próximos 7 dias']){
     const tile=page.locator('.day-slices').getByRole('button').filter({hasText:label}),count=Number(await tile.locator('strong').innerText())
     await tile.click();await expect(page.locator('.op-work-item')).toHaveCount(count)
     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
     const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click()
     await page.getByRole('navigation').getByRole('button',{name:'Dashboard',exact:true}).click()
    }
    const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click()
    const management=page.locator('details.nav-group').filter({has:page.locator('summary h2').filter({hasText:'Gestão'})})
    await management.locator('summary').click();await expect(management).not.toHaveAttribute('open','')
    await page.getByLabel('Buscar área do portal').fill('Indicadores');await expect(page.getByRole('navigation').getByRole('button',{name:'Indicadores',exact:true})).toBeVisible()
    if(user===f.restricted)await expect(page.getByRole('navigation').getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
    await page.getByRole('navigation').getByRole('button',{name:'Indicadores',exact:true}).click()
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
   }finally{await context.close()}
  }
 }finally{await f.cleanup()}
})

test('Reunião interna: validação, ata e acompanhamento pela interface com confirmação em outra sessão',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente dados fictícios locais.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  await page.setViewportSize({width:390,height:844})
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await page.getByRole('button',{name:'Abrir navegação',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões')
  await page.getByRole('button',{name:'Agendar reunião do projeto',exact:true}).click()
  await page.getByRole('button',{name:'Salvar reunião do projeto',exact:true}).click();await expect(page.getByLabel('Participantes da reunião',{exact:false})).toBeFocused()
  await page.getByLabel('Participantes da reunião',{exact:false}).fill('Sócios · revisão fictícia')
  await expect(page.getByLabel('Participantes da reunião',{exact:false})).toHaveValue('Sócios · revisão fictícia')
  await page.getByLabel('Situação da reunião de projeto',{exact:false}).selectOption('Realizada')
  await page.getByLabel('Ata interna',{exact:false}).fill('Ata persistida da mesa de trabalho')
  await page.getByLabel('Decisões internas',{exact:true}).fill('Conferir os vencimentos atribuídos')
  await page.getByLabel('Criar ou atualizar acompanhamento pendente desta reunião',{exact:true}).check()
  await page.getByRole('button',{name:'Salvar reunião do projeto',exact:true}).click()
  try{await expect(page.getByLabel(/^Atividade resultante/)).toBeFocused()}catch(error){
   console.log('Diagnóstico limitado de foco',await page.evaluate(()=>({active:document.activeElement?.tagName,label:document.activeElement?.closest('label')?.textContent,invalid:[...document.querySelectorAll('form input:invalid,form textarea:invalid,form select:invalid')].map(e=>({label:e.closest('label')?.textContent,type:e.getAttribute('type')}))})))
   throw error
  }
  await page.getByLabel(/^Atividade resultante/).fill('Revisar domínio com o sócio')
  await page.getByLabel('Prazo da atividade resultante',{exact:false}).fill(f.today)
  await page.getByRole('button',{name:'Salvar reunião do projeto',exact:true}).click()
  await expect(page.getByRole('heading',{name:/Sócios · revisão fictícia/})).toBeVisible()
  const rows=await checked(f.second.client.from('hub_meetings').select('id,record').eq('workspace_id',f.workspace).eq('project_id',f.proposal))
  const row=rows.find(x=>x.record.participants==='Sócios · revisão fictícia');expect(row?.record.summary).toBe('Ata persistida da mesa de trabalho')
  expect(await checked(f.second.client.from('hub_activities').select('id,title').eq('workspace_id',f.workspace).eq('meeting_id',row.id))).toHaveLength(1)
  await page.getByRole('button',{name:'Preparar / registrar ata',exact:true}).first().click()
  await expect(page.locator('summary').filter({hasText:'Apresentação e prévia local'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Apresentação selecionada',exact:true})).toHaveCount(0)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await f.cleanup()}
})
