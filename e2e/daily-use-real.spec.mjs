import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {recordTab} from './helpers/portal-ui.mjs'
test.use({actionTimeout:15000})

test('Rotina diária: identificação autorizada em atividade, reunião e histórico; guia em dois temas',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente contas fictícias locais.');test.setTimeout(150000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  await checked(f.admin.auth.admin.updateUserById(f.owner.id,{email:'socia-'+randomUUID()+'@example.invalid',user_metadata:{name:'Marina Fictícia'}}))
  await checked(f.admin.auth.admin.updateUserById(f.second.id,{email:'socio-sem-nome-'+randomUUID()+'@example.invalid'}))
  const people=await checked(f.restricted.client.rpc('hub_registry_people',{w:f.workspace})),secondName=people.find(p=>p.id===f.second.id).name
  expect(people.find(p=>p.id===f.owner.id).name).toBe('Marina Fictícia');expect(secondName).toMatch(/^Conta socio-sem-nome-/)
  expect((await f.owner.client.rpc('hub_work_assignees',{w:f.other})).error?.code).toBe('42501')
  const task=await checked(f.owner.client.rpc('hub_save_activity',{w:f.workspace,a:null,expected_revision:null,operation_id:randomUUID(),body:{lead_id:f.prospect,title:'Conferir identificação fictícia',owner:'Integrante '+f.second.id.slice(0,8),assigned_user_id:f.second.id,due:f.today,status:'Pendente',result:''}}))
  for(const [width,dark] of [[1440,false],[390,true]]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage()
   try{
    await page.addInitScript(({session,dark})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));localStorage.setItem('decifaz-theme',dark?'dark':'light')},{session:f.owner.session,dark})
    const errors=[];page.on('pageerror',e=>errors.push(e.name+': '+e.message.replace(/https?:\/\/\S+/g,'[url]').slice(0,200)))
    await page.goto('/');try{await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible()}catch(error){console.log('Abertura local',width,await page.evaluate(()=>({ready:document.readyState,bodyLength:document.body.innerText.length})),errors);throw error}
    async function go(label){const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click()}
    await go('Agenda operacional')
    const item=page.locator('.op-work-item').filter({hasText:'Conferir identificação fictícia'});await expect(item).toContainText(secondName)
    await item.getByRole('button',{name:'Editar acompanhamento',exact:true}).click()
    const dialog=page.getByRole('dialog'),assignee=dialog.getByRole('combobox',{name:'Conta responsável',exact:true});await expect(assignee).toHaveValue(f.second.id);await expect(assignee.locator('option').filter({hasText:secondName})).toHaveCount(1)
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click()
    await go('Projetos e entregas');await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões')
    await page.getByRole('button',{name:'Agendar reunião do projeto',exact:true}).click()
    const input=page.getByLabel('Responsável pela reunião',{exact:false});await expect(page.locator('datalist option[value="Marina Fictícia"]')).toHaveCount(1)
    await input.fill('Marina Fictícia');await page.getByLabel('Participantes da reunião',{exact:false}).fill('Sócios fictícios '+width)
    await page.getByRole('button',{name:'Salvar reunião do projeto',exact:true}).click();await expect(page.getByRole('heading',{name:new RegExp('Sócios fictícios '+width)})).toBeVisible()
    const meetings=await checked(f.second.client.from('hub_meetings').select('record').eq('workspace_id',f.workspace).eq('project_id',f.proposal));expect(meetings.some(m=>m.record.owner==='Marina Fictícia'&&m.record.participants==='Sócios fictícios '+width)).toBe(true)
    await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
    await go('Rastreabilidade');await expect(page.locator('.timeline').first()).toContainText('Marina Fictícia')
    await go('Base de conhecimento');await page.getByLabel('Buscar na base').fill('Início diário');await page.getByRole('button',{name:'Início diário dos sócios',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Início diário dos sócios',exact:true})).toBeVisible();await expect(page.locator('.article')).toContainText('Com o portal fechado');await expect(page.locator('.article')).toContainText('366 dias');await expect(page.locator('.article')).toContainText('Clientes não usam o portal')
    await page.evaluate(()=>document.fonts.ready);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    fs.mkdirSync('.validation/daily-captures',{recursive:true});await page.screenshot({path:'.validation/daily-captures/guia-'+width+'.png',fullPage:true})
   }finally{await context.close()}
  }
  // Viewing resolves a label without rewriting the original owner or assignment.
  const original=await checked(f.second.client.from('hub_activities').select('owner,assigned_user_id').eq('workspace_id',f.workspace).eq('id',task.current.id).single());expect(original.owner).toBe('Integrante '+f.second.id.slice(0,8));expect(original.assigned_user_id).toBe(f.second.id)
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,expected_revision:0,enabled:false}))
  expect((await f.restricted.client.rpc('hub_registry_people',{w:f.workspace})).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_work_assignees',{w:f.workspace})).error?.code).toBe('42501')
  expect((await checked(f.owner.client.rpc('hub_registry_people',{w:f.workspace}))).find(p=>p.id===f.restricted.id).active).toBe(false)
 }finally{await f.cleanup()}
})
