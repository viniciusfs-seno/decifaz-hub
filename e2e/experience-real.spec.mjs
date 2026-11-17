import {test,expect} from '@playwright/test'
import {operationalFixture} from './helpers/operational-fixture.mjs'

test('Experiência: contexto de retorno, atalhos, vazios, teclado e temas em desktop e celular',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local fictício.')
 test.setTimeout(120000)
 const f=await operationalFixture()
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage()
   await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session)
   await page.goto('/')
   const nav=async name=>{const toggle=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
   await expect(page.getByRole('heading',{name:'Fila de ações'})).toBeVisible()
   await page.getByRole('button',{name:/Atividades vencidas/}).click()
   await expect(page.getByRole('button',{name:'Vencidas',exact:true})).toHaveAttribute('aria-pressed','true')
   await page.getByLabel('Buscar na agenda').fill('Enviar diagnóstico')
   await page.getByRole('button',{name:'Enviar diagnóstico revisado',exact:true}).click()
   await expect(page.locator('.op-dossier-head')).toContainText('Studio Aurora')
   await page.getByRole('button',{name:'← Voltar à agenda',exact:true}).click()
   await expect(page.getByLabel('Buscar na agenda')).toHaveValue('Enviar diagnóstico')
   await expect(page.getByRole('button',{name:'Vencidas',exact:true})).toHaveAttribute('aria-pressed','true')
   await nav('Dashboard');await page.getByRole('button',{name:/Atividades de hoje/}).click()
   await expect(page.getByRole('button',{name:'Hoje',exact:true})).toHaveAttribute('aria-pressed','true')
   await expect(page.getByLabel('Buscar na agenda')).toHaveValue('')
   await nav('Captação e CRM');await page.getByLabel('Buscar leads').fill('Studio')
   await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click()
   await page.getByRole('button',{name:'← Voltar à lista',exact:true}).click()
   await expect(page.getByLabel('Buscar leads')).toHaveValue('Studio')
   await page.getByLabel('Buscar leads').fill('Nenhum estabelecimento com este nome')
   await expect(page.getByText('Nenhum registro encontrado',{exact:true})).toBeVisible()
   await page.getByRole('button',{name:'Limpar filtros do CRM'}).click()
   await nav('Indicadores');await page.getByLabel('Responsável dos indicadores').selectOption('Marina · fictícia')
   await page.getByRole('button',{name:'Funil atual da coorte',exact:true}).click()
   const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).click()
   await page.getByRole('button',{name:'← Voltar aos indicadores',exact:true}).click()
   await expect(page.getByLabel('Responsável dos indicadores')).toHaveValue('Marina · fictícia')
   await page.getByRole('button',{name:'Funil atual da coorte',exact:true}).click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0)
   await expect(page.getByRole('button',{name:'Funil atual da coorte',exact:true})).toBeFocused()
   for(const theme of ['escuro','claro']){
    await page.getByRole('button',{name:'Ativar tema '+theme}).click()
    for(const section of ['Dashboard','Agenda operacional','Indicadores','Equipe']){
     await nav(section)
     expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
   }
   await page.keyboard.press('Control+Home');await page.keyboard.press('Tab')
   await page.getByRole('link',{name:'Ir para o conteúdo'}).focus();await page.keyboard.press('Enter')
   await expect(page.locator('#conteudo')).toBeFocused()
   await context.close()
   const commercial=await browser.newContext({viewport:{width,height:900}}),restricted=await commercial.newPage()
   await restricted.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.restricted.session)
   await restricted.goto('/')
   await expect(restricted.getByRole('heading',{name:'Fila de ações'})).toBeVisible()
   for(const theme of ['escuro','claro']){
    await restricted.getByRole('button',{name:'Ativar tema '+theme}).click()
    for(const section of ['Dashboard','Agenda operacional','Indicadores','Propostas comerciais']){
     const toggle=restricted.getByRole('button',{name:'Abrir navegação',exact:true})
     if(await toggle.isVisible())await toggle.click()
     await expect(restricted.getByRole('navigation').getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
     await expect(restricted.getByRole('navigation').getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
     await restricted.getByRole('navigation').getByRole('button',{name:section,exact:true}).click()
     await expect(restricted.getByText('R$ 2.400,00',{exact:true})).toHaveCount(0)
     expect(await restricted.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
    }
   }
   await commercial.close()
  }
 }finally{await f.cleanup()}
})
