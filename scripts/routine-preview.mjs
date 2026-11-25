import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD,sha=process.env.HUB_HML_EXPECTED_SHA
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password||!sha)throw Error('Prévia isolada protegida obrigatória')
const browser=await chromium.launch();fs.mkdirSync('.validation/routine-external',{recursive:true})
try{for(const [persona,width,theme] of [['admin',1440,'light'],['admin',390,'dark'],['comercial',390,'light']]){
 const context=await browser.newContext({locale:'pt-BR',viewport:{width,height:900},timezoneId:'America/Fortaleza'}),page=await context.newPage();try{
  expect((await context.request.get(origin+'/__supabase/rest/v1/hub_leads')).status()).toBe(401)
  await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click();const health=await(await context.request.get(origin+'/__health')).json();if(health.candidate!==sha||!health.isolated)throw Error('SHA ou isolamento divergente')
  await page.goto(origin+'/__review/persona/'+persona);await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
  const nav=async name=>{const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
  await nav('Captação e CRM');await page.getByRole('button',{name:'Regularização cadastral',exact:true}).click();await expect(page.getByRole('heading',{name:'Regularização cadastral',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:/Revisar segmento de/}).first()).toBeVisible();await page.screenshot({path:`.validation/routine-external/regularizacao-${persona}-${width}-${theme}.png`,fullPage:true})
  await nav('Central de vencimentos');await page.getByRole('tab',{name:'Meus avisos',exact:true}).click();await expect(page.getByRole('button',{name:'Abrir origem do aviso',exact:true}).first()).toBeVisible();await page.screenshot({path:`.validation/routine-external/avisos-${persona}-${width}-${theme}.png`})
  await nav('Indicadores');await expect(page.getByRole('heading',{name:'Acompanhamento comercial verificável',exact:true})).toBeVisible();await expect(page.getByText('Resposta do cliente',{exact:true})).toBeVisible();await page.screenshot({path:`.validation/routine-external/indicadores-${persona}-${width}-${theme}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await context.close()}
}fs.writeFileSync('.validation/routine-external/result.json',JSON.stringify({sha,externalRunner:true,isolated:true,protectedApi:true,admin:true,commercial:true,mobileEmulated:true,dark:true,passed:true}));console.log('Prévia da rotina protegida conferida por runner externo; somente dados fictícios.')}finally{await browser.close()}
