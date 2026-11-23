import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD,sha=process.env.HUB_HML_EXPECTED_SHA
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Protected isolated preview required')
const browser=await chromium.launch(),contexts=[];fs.mkdirSync('.validation/financial-external',{recursive:true})
try{
 for(const persona of ['admin','comercial']){
  const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click()
  const health=await(await context.request.get(origin+'/__health')).json();if(health.candidate!==sha||!health.isolated)throw Error('Candidate/isolation mismatch')
  await page.goto(origin+'/__review/persona/'+persona);await page.getByRole('navigation').getByRole('button',{name:'Revisão semanal',exact:true}).click();const region=page.getByRole('region',{name:'Revisão financeira semanal'})
  if(persona==='comercial'){await expect(region).toHaveCount(0);continue}
  await expect(region.getByRole('heading',{name:'Origens para conferir e agir',exact:true})).toBeVisible();await page.getByText('Revisão financeira dos sócios',{exact:true}).scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-100));await page.screenshot({path:'.validation/financial-external/desktop.png'})
  await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.getByText('Revisão financeira dos sócios',{exact:true}).scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-100));expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'.validation/financial-external/mobile-dark.png'})
 }
 fs.writeFileSync('.validation/financial-external/result.json',JSON.stringify({sha,externalRunner:true,isolated:true,admin:true,commercialDenied:true,mobileEmulated:true,dark:true,passed:true}));console.log('External protected financial preview passed; fictional data only.')
}finally{for(const c of contexts)await c.close();await browser.close()}
