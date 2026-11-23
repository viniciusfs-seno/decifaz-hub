import {chromium,webkit,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD,sha=process.env.HUB_HML_EXPECTED_SHA
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password||!sha)throw Error('Exige prévia protegida com SHA informado.')
fs.mkdirSync('.validation/notice-external',{recursive:true})
for(const [engine,name,viewport] of [[chromium,'desktop',{width:1440,height:1000}],[webkit,'celular',{width:390,height:844}]]){
 const browser=await engine.launch(),context=await browser.newContext({viewport})
 try{
  const health=await(await context.request.get(origin+'/__health')).json();expect(health.candidate).toBe(sha);expect(health.isolated).toBe(true)
  const page=await context.newPage();await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click()
  await page.getByRole('link',{name:'Administração',exact:true}).click()
  if(name==='celular')await page.getByRole('button',{name:'Abrir navegação',exact:true}).click()
  await page.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Central de vencimentos',exact:true})).toBeVisible()
  await expect(page.getByRole('status').filter({hasText:'registros no recorte'})).toBeVisible()
  if(name==='celular')await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await page.screenshot({path:'.validation/notice-external/central-'+name+'.png',fullPage:true})
  await page.getByRole('tab',{name:'Meus avisos',exact:true}).click();await expect(page.getByRole('button',{name:'Abrir origem do aviso',exact:true}).first()).toBeVisible()
  await page.getByRole('tab',{name:'Processamento',exact:true}).click();await expect(page.getByText('Nenhuma mensagem na caixa de saída',{exact:true})).toBeVisible()
  await page.screenshot({path:'.validation/notice-external/processamento-'+name+'.png',fullPage:true})
  await page.goto(origin+'/__review');await page.getByRole('link',{name:'Comercial · acesso restrito',exact:true}).click()
  if(name==='celular')await page.getByRole('button',{name:'Abrir navegação',exact:true}).click()
  await page.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click();await expect(page.getByRole('tab',{name:'Preferências',exact:true})).toBeVisible();await expect(page.getByRole('tab',{name:'Processamento',exact:true})).toHaveCount(0)
  await expect(page.getByText('Domínios',{exact:true})).toHaveCount(0)
  console.log('Prévia externa '+name+': Central e monitor autorizados, perfil restrito e layout aprovados.')
 }finally{await context.close();await browser.close()}
}
fs.writeFileSync('.validation/notice-external/result.json',JSON.stringify({candidate:sha,externalRunner:!!process.env.GITHUB_ACTIONS,protected:true,desktop:true,mobileWebkit:true,restricted:true},null,2))
