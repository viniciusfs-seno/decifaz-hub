import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
test('Reunião: pauta persistida, roteiro, apresentação limpa, captura e cancelamento',async({page,context})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local.')
 const f=await operationalFixture()
 try{
  await page.addInitScript(session=>{
   localStorage.setItem('sb-127-auth-token',JSON.stringify(session));window.captureStopped=false
   Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:async()=>{if(window.captureDeny)throw new DOMException('Denied','NotAllowedError');const canvas=document.createElement('canvas');const stream=canvas.captureStream();const track=stream.getTracks()[0],stop=track.stop.bind(track);track.stop=()=>{window.captureStopped=true;stop()};return stream}})
  },f.owner.session)
  await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click()
  await page.getByRole('button',{name:'Mercado Sol · fictício',exact:true}).click()
  await page.getByRole('button',{name:'Editar reunião',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByLabel('Pauta da reunião').fill('Pauta fictícia de atendimento')
  await dialog.getByRole('button',{name:'Modo reunião',exact:true}).click()
  await dialog.getByLabel('Pergunta realizada',{exact:true}).first().check()
  await dialog.getByLabel('Resposta',{exact:true}).first().fill('NOTA INTERNA NÃO APRESENTAR')
  await dialog.getByRole('button',{name:'Voltar à ficha completa'}).click()
  await dialog.getByLabel('Link da chamada (HTTPS)').fill('https://meet.example.invalid/sala-ficticia')
  await dialog.getByRole('button',{name:'Salvar reunião',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  const persisted=await checked(f.second.client.from('hub_meetings').select('record').eq('id',f.meeting).single())
  expect(persisted.record.agenda).toBe('Pauta fictícia de atendimento');expect(persisted.record.answers['0']).toBe('NOTA INTERNA NÃO APRESENTAR')
  await page.getByRole('button',{name:'Editar reunião',exact:true}).click()
  await dialog.getByRole('region',{name:'Apresentação e tela'}).getByLabel('Reunião cadastrada').selectOption(f.meeting)
  await expect(dialog.getByLabel('Link da chamada',{exact:true})).toHaveValue('https://meet.example.invalid/sala-ficticia')
  const client=dialog.locator('.client-presentation');await client.getByLabel('Cardápio digital',{exact:true}).check()
  const popupPromise=context.waitForEvent('page');await client.getByRole('button',{name:'Abrir visão do cliente'}).click();const popup=await popupPromise
  await expect(popup.getByRole('heading',{name:'Cardápio digital',exact:true})).toBeVisible()
  await expect(popup.locator('body')).not.toContainText('NOTA INTERNA');await expect(popup.locator('body')).not.toContainText('R$');await popup.close()
  await dialog.getByRole('button',{name:'Selecionar tela para prévia'}).click();await expect(dialog.getByRole('button',{name:'Encerrar prévia'})).toBeVisible()
  await dialog.getByRole('button',{name:'Encerrar prévia'}).click();expect(await page.evaluate(()=>window.captureStopped)).toBe(true)
  await page.evaluate(()=>window.captureDeny=true);await dialog.getByRole('button',{name:'Selecionar tela para prévia'}).click();await expect(dialog.getByRole('alert')).toContainText('captura não foi iniciada')
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click()
  await page.evaluate(()=>Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{configurable:true,value:undefined}))
  await page.getByRole('button',{name:'Editar reunião',exact:true}).click()
  await expect(dialog.getByText('Este navegador ou endereço não permite captura de tela.',{exact:false})).toBeVisible()
 }finally{await f.cleanup()}
})
