import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
import {mkdir} from 'node:fs/promises'
test.use({actionTimeout:15000})
test('Rotina comercial integrada: CSV até triagem, abordagem, conclusão, follow-up e Dashboard',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(180000)
 const f=await operationalFixture(),mobile=await browser.newContext({viewport:{width:390,height:844}}),desktop=await browser.newContext({viewport:{width:1440,height:1000}})
 const page=await mobile.newPage(),observer=await desktop.newPage()
 const nav=async(p,name)=>{const toggle=p.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await p.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
 try{
  for(const [p,session] of [[page,f.restricted.session],[observer,f.owner.session]]){await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),session);await p.goto('/');await expect(p.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible()}
  await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click()
  await nav(page,'Importar estabelecimentos')
  const csv='Nome;Segmento;Cidade;Site\r\nStudio Aurora · fictício;Serviços;Fortaleza;https://example.invalid\r\nRotina CSV fictícia;Serviços;Fortaleza;https://rotina.example.invalid'
  await page.getByLabel('Arquivo CSV').setInputFiles({name:'rotina-ficticia.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await page.getByRole('button',{name:'Validar e mostrar prévia',exact:true}).click()
  const duplicate=page.getByRole('row').filter({hasText:'2 · Studio Aurora'})
  await duplicate.getByRole('combobox',{name:'Ação da linha 2',exact:true}).selectOption('update')
  await duplicate.getByRole('combobox',{name:'Cadastro a atualizar na linha 2',exact:true}).selectOption(f.prospect)
  await page.getByRole('button',{name:'Confirmar linhas selecionadas',exact:true}).click()
  await expect(page.getByRole('row').filter({hasText:'3 · Rotina CSV fictícia'})).toContainText('Criada')
  await nav(page,'Captação e CRM');await page.getByLabel('Buscar leads').fill('Rotina CSV')
  await page.getByRole('button',{name:'Rotina CSV fictícia',exact:true}).click()
  await page.getByRole('button',{name:'Iniciar triagem',exact:true}).click()
  const dialog=page.getByRole('dialog')
  await dialog.getByRole('button',{name:/Diagnóstico preliminar/}).click();await dialog.getByLabel('Fatos observados diretamente').fill('Pesquisa fictícia observada; necessidade ainda será confirmada.')
  await dialog.getByLabel('Hipóteses ainda não confirmadas').fill('Hipótese fictícia, não confirmar automaticamente.')
  await dialog.getByRole('button',{name:/Pontuação/}).click()
  const criteria=['Encaixe com as soluções','Evidência da necessidade','Acesso ao tomador de decisão','Urgência','Potencial de receita','Reutilização da solução','Facilidade logística']
  for(const [i,label] of criteria.entries())await dialog.getByLabel(new RegExp(label)).selectOption(String([3,3,2,2,2,2,1][i]))
  await dialog.getByRole('button',{name:/Encaminhamento/}).click();await dialog.getByLabel('Abordagem sugerida').fill('Confirmar hipótese no contato.');await dialog.getByLabel('Responsável',{exact:true}).fill('Equipe fictícia');await dialog.getByLabel('Próxima ação',{exact:true}).fill('Contato fictício');await dialog.getByLabel('Prazo',{exact:true}).fill(f.today);await dialog.getByLabel('Mover para Qualificado ao concluir').check();await dialog.getByRole('button',{name:'Concluir triagem',exact:true}).click()
  await expect(dialog).toHaveCount(0);await expect(page.locator('.op-dossier-head')).toContainText('A · 15/15')
  await page.getByLabel('Definir próxima ação').check();await page.getByLabel(/^Próxima ação planejada/).fill('Contato da rotina CSV');await page.getByLabel(/^Responsável da próxima ação/).fill('Equipe fictícia');await page.getByLabel(/^Prazo da próxima ação/).fill(f.today)
  await page.getByRole('button',{name:'Salvar abordagem e plano',exact:true}).click();await expect(page.getByText('Abordagem registrada.',{exact:true})).toBeVisible()
  await page.context().route('https://rotina.example.invalid/**',r=>r.fulfill({body:'Canal fictício'}));const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir site',exact:true}).click();await(await popup).close()
  await page.getByLabel(/^Resultado da abordagem/).fill('Contato realizado em cenário fictício; retorno combinado.');await page.getByRole('button',{name:'Salvar abordagem e plano',exact:true}).click();await expect(page.getByText('Abordagem registrada.',{exact:true})).toBeVisible()
  await nav(page,'Agenda operacional');await page.getByLabel('Buscar na agenda').fill('Contato da rotina CSV')
  await page.getByRole('button',{name:'Editar acompanhamento',exact:true}).click();await dialog.getByRole('combobox',{name:/Situação da atividade/}).selectOption('Concluída');await dialog.getByLabel('Resultado da atividade',{exact:true}).fill('Resultado fictício registrado.');await dialog.getByLabel('Criar próximo acompanhamento nesta conclusão').check();await dialog.getByLabel(/^Título do próximo acompanhamento/).fill('Follow-up da rotina CSV');await dialog.getByLabel(/^Responsável do próximo acompanhamento/).fill('Equipe fictícia');await dialog.getByRole('button',{name:'Salvar acompanhamento',exact:true}).click();await expect(dialog).toHaveCount(0)
  await page.getByLabel('Buscar na agenda').fill('Follow-up da rotina CSV');await expect(page.getByRole('button',{name:'Follow-up da rotina CSV',exact:true})).toBeVisible()
  await nav(observer,'Agenda operacional');await observer.getByLabel('Buscar na agenda').fill('Follow-up da rotina CSV');await expect(observer.getByRole('button',{name:'Follow-up da rotina CSV',exact:true})).toBeVisible({timeout:25000})
  await mkdir('.validation/productivity-captures',{recursive:true});await page.screenshot({path:'.validation/productivity-captures/agenda-comercial-mobile-escuro.png',fullPage:true});await observer.screenshot({path:'.validation/productivity-captures/agenda-admin-desktop.png',fullPage:true})
  await nav(page,'Dashboard');await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  await nav(page,'Captação e CRM');await page.getByLabel('Buscar leads').fill('Rotina CSV');await page.getByRole('button',{name:'Rotina CSV fictícia',exact:true}).click();await expect(page.getByText(/Atividade concluída: Contato da rotina CSV/).last()).toBeVisible()
  const lead=await checked(f.admin.from('hub_leads').select('id,stage').eq('workspace_id',f.workspace).eq('name','Rotina CSV fictícia').single());expect(lead.stage).toBe('Qualificado')
 }finally{await mobile.close();await desktop.close();sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
