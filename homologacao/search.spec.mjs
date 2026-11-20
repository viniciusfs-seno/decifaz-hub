import {test,expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
test('HTTPS busca: contexto autorizado em desktop e celular',async({page,context},info)=>{
 const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD
 if(!origin||!password)throw Error('Prévia protegida não configurada')
 await page.goto('/');await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação'}).click();await expect(page.getByRole('heading',{name:'Escolha um perfil fictício',exact:true})).toBeVisible();await page.goto('/__review/persona/comercial');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible()
 const health=await(await context.request.get(origin+'/__health')).json();expect(health.isolated).toBe(true);if(process.env.HUB_HML_EXPECTED_SHA)expect(health.candidate).toBe(process.env.HUB_HML_EXPECTED_SHA)
 await page.getByRole('button',{name:'Buscar registros',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Buscar registros',exact:true});await dialog.getByLabel('Nome ou cidade').fill('CAFE')
 await expect(dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})})).toBeVisible();await expect(dialog).not.toContainText('Condição reservada');await mkdir('.validation/external-captures',{recursive:true});await page.screenshot({path:'.validation/external-captures/busca-'+info.project.name+'.png',fullPage:false})
 await dialog.getByRole('button').filter({has:page.locator('strong').filter({hasText:/^Café Horizonte · fictício$/})}).click();await expect(page).toHaveURL(/#estabelecimento\//);await expect(page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})
