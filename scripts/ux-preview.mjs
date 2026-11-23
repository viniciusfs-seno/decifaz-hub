import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD,sha=process.env.HUB_HML_EXPECTED_SHA
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Protected isolated preview required')
const browser=await chromium.launch();fs.mkdirSync('.validation/ux-external',{recursive:true})
try{for(const [persona,width,theme] of [['admin',1440,'light'],['admin',390,'dark'],['comercial',390,'light']]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();try{
  await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click();const health=await(await context.request.get(origin+'/__health')).json();if(health.candidate!==sha||!health.isolated)throw Error('Candidate or isolation mismatch')
  await page.goto(origin+'/__review/persona/'+persona);await expect(page.getByRole('heading',{name:'Fila de ações',exact:true})).toBeVisible();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme)
  async function nav(name){const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
  if(persona==='admin'){
   await nav('Contratos');await page.getByRole('button',{name:'Cadastrar contrato',exact:true}).click();const dialog=page.getByRole('dialog');await expect(dialog.locator('form.workflow-form')).toHaveCount(1);await dialog.getByRole('button',{name:'Salvar contrato',exact:true}).click();await expect(dialog.getByRole('combobox',{name:'Estabelecimento',exact:true})).toBeFocused();await expect(dialog.getByRole('alert')).toContainText('Confira');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'.validation/ux-external/contrato-'+width+'-'+theme+'.png'});await dialog.getByRole('button',{name:'Fechar',exact:true}).click()
  }else{
   const menu=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await expect(page.getByRole('navigation').getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0);await expect(page.getByRole('navigation').getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0);await page.getByRole('navigation').getByRole('button',{name:'Revisão semanal',exact:true}).click();await expect(page.getByRole('region',{name:'Revisão financeira semanal'})).toHaveCount(0)
  }
 }finally{await context.close()}
}fs.writeFileSync('.validation/ux-external/result.json',JSON.stringify({sha,externalRunner:true,isolated:true,admin:true,commercialRestricted:true,mobileEmulated:true,dark:true,invalidFocus:true,passed:true}));console.log('External protected UX preview passed; fictional data only.')}finally{await browser.close()}
