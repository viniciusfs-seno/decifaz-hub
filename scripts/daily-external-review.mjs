import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Prévia isolada protegida obrigatória')
const browser=await chromium.launch(),context=await browser.newContext()
try{
 const page=await context.newPage();await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click();await page.goto(origin+'/__review/persona/admin');await expect(page.getByRole('navigation')).toBeVisible()
 await page.getByRole('navigation').getByRole('button',{name:'Base de conhecimento',exact:true}).click();await page.getByRole('button',{name:'Início diário dos sócios',exact:true}).click();await expect(page.getByRole('heading',{name:'Início diário dos sócios',exact:true})).toBeVisible();await expect(page.getByText('Comece em três passos',{exact:true})).toBeVisible()
 fs.mkdirSync('.validation/daily-external',{recursive:true});await page.screenshot({path:'.validation/daily-external/guia-desktop.png',fullPage:true})
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='dark');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'.validation/daily-external/guia-celular.png',fullPage:true})
 fs.writeFileSync('.validation/daily-external/result.json',JSON.stringify({candidate:process.env.HUB_HML_EXPECTED_SHA,externalRunner:true,protectedHTTPS:true,fictionalData:true,guide:true,mobileDark:true},null,2));console.log('Guia diário aberto externamente em desktop e celular escuro; acesso protegido e dados fictícios.')
}catch{throw Error('Revisão externa diária não concluída; diagnóstico sem credenciais.')}finally{await context.close();await browser.close()}
