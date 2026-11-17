import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'

test('membros compartilham chamados e lançamentos financeiros com isolamento',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer a pilha local do Supabase.')
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw new Error('Use exclusivamente o Supabase local.')
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,options)
 async function checked(operation){
  const {data,error}=await operation
  if(error)throw error
  if(data===false)throw new Error('Operação recusada')
  return data
 }
 test.setTimeout(90000)
 const workspace=randomUUID()
 await checked(admin.from('hub_workspaces').insert({id:workspace,name:'Decifaz E2E'}))
 async function account(member){
  const email=randomUUID()+'@example.com',password=randomUUID()
  const {user}=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}))
  if(member)await checked(admin.from('hub_members').insert({workspace_id:workspace,user_id:user.id,role:'admin'}))
  const client=createClient(endpoint,key,options)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {client,session}
 }
 const first=await account(true),second=await account(true),outsider=await account(false)
 async function open(target,session){
  await target.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),session)
  await target.goto('/')
 }
 await open(page,first.session)
 await page.getByRole('button',{name:'Captação e CRM',exact:true}).click()
 await page.getByRole('button',{name:/Novo lead/}).click()
 await page.getByLabel('Nome',{exact:true}).fill('Cliente fictício')
 await page.getByLabel('Segmento',{exact:true}).fill('Serviços')
 await page.getByLabel('Cidade',{exact:true}).fill('Aracaju')
 await page.getByRole('button',{name:'Salvar estabelecimento'}).click()
 const quote=page.getByRole('dialog')
 await page.getByRole('button',{name:'Iniciar triagem',exact:true}).click()
 await quote.getByRole('button',{name:/Diagnóstico preliminar/}).click()
 await quote.getByLabel('Fatos observados diretamente').fill('Cadastro manual observado.')
 await quote.getByRole('button',{name:/Pontuação/}).click()
 const criteria=['Encaixe com as soluções','Evidência da necessidade','Acesso ao tomador de decisão','Urgência','Potencial de receita','Reutilização da solução','Facilidade logística']
 for(const [index,label] of criteria.entries())await quote.getByLabel(new RegExp(label)).selectOption(String([3,3,2,2,2,2,1][index]))
 await quote.getByRole('button',{name:/Encaminhamento/}).click()
 await quote.getByLabel('Abordagem sugerida').fill('Apresentar automação.')
 await quote.getByLabel('Responsável',{exact:true}).fill('Equipe E2E')
 await quote.getByLabel('Próxima ação',{exact:true}).fill('Agendar diagnóstico')
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
 await quote.getByLabel('Prazo',{exact:true}).fill(today)
 await quote.getByLabel('Mover para Qualificado ao concluir').check()
 await quote.getByRole('button',{name:'Concluir triagem'}).click()
 await expect(quote).toHaveCount(0)
 const row=page.locator('.op-dossier-head')
 await expect(row).toContainText('A · 15/15')
 await expect(row).toContainText('Qualificado')
 await page.getByRole('button',{name:'Registrar reunião',exact:true}).click()
 await quote.getByLabel(/^Participantes/).fill('Equipe e cliente')
 await quote.getByLabel(/^Situação/).selectOption('Realizada')
 await quote.getByLabel(/^Resumo do diagnóstico/).fill('Diagnóstico fictício de automação')
 await quote.getByLabel('Próxima ação',{exact:true}).fill('Apresentar proposta')
 await quote.getByLabel('Responsável pelo acompanhamento').fill('Equipe E2E')
 await quote.getByLabel('Prazo do acompanhamento').fill(today)
 await quote.getByLabel('Criar atividade de acompanhamento ao salvar').check()
 await quote.getByLabel(/Atualizar a etapa do CRM/).check()
 await quote.getByRole('button',{name:'Salvar reunião'}).click()
 await expect(quote).toHaveCount(0)
 await expect(row).toContainText('Diagnóstico realizado')
 const followup=await checked(second.client.from('hub_activities').select('title,owner,due_on')
  .eq('workspace_id',workspace).eq('title','Apresentar proposta').single())
 expect(followup).toEqual({title:'Apresentar proposta',owner:'Equipe E2E',due_on:today})
 await page.getByRole('button',{name:'Criar proposta',exact:true}).click()
 await expect(quote.getByText('Diagnóstico fictício de automação',{exact:true})).toBeVisible()
 await quote.getByLabel(/^Título/).fill('Projeto E2E')
 await quote.getByLabel('Escopo e entregáveis').fill('Escopo de teste')
 await quote.getByLabel('Implantação (R$)').fill('100')
 await quote.getByRole('button',{name:'Salvar rascunho'}).click()
 await expect(quote).toHaveCount(0)
 await page.getByRole('button',{name:'Propostas comerciais',exact:true}).click()
 const proposalButton=page.getByRole('button',{name:'Projeto E2E',exact:true})
 await proposalButton.click()
 await quote.getByLabel(/Nova situação/).selectOption('Enviada')
 await quote.getByLabel('Canal, evidência ou contexto').fill('Envio fictício')
 await quote.getByRole('button',{name:'Registrar envio'}).click()
 await expect(quote).toHaveCount(0)
 await expect(page.getByRole('row').filter({has:proposalButton})).toContainText('Enviada')
 await proposalButton.click()
 await quote.getByLabel(/Nova situação/).selectOption('Aceita')
 await quote.getByLabel('Evidência do aceite explícito').fill('Aceite fictício')
 await quote.getByRole('button',{name:'Registrar aceite'}).click()
 await expect(quote).toHaveCount(0)
 await expect(page.getByRole('row').filter({has:proposalButton})).toContainText('Aceita')
 await proposalButton.click()
 await quote.getByRole('button',{name:'Abrir projeto a partir do aceite'}).click()
 await expect(page.getByRole('dialog').getByRole('button',{name:'Salvar projeto',exact:true})).toBeVisible()
 await expect(page.getByRole('dialog').getByRole('paragraph').filter({hasText:/^Escopo de teste$/})).toBeVisible()
 const saved=await checked(second.client.from('hub_projects').select('proposal_id,lead_id').eq('workspace_id',workspace).single())
 const proposal=saved.proposal_id
 const lead=await checked(second.client.from('hub_leads').select('stage').eq('workspace_id',workspace).eq('id',saved.lead_id).single())
 expect(lead.stage).toBe('Ganho')
 await page.getByLabel('Título do chamado').fill('Ajuste E2E')
 await page.getByLabel('Responsável pelo chamado').fill('Equipe E2E')
 await page.getByRole('button',{name:'Abrir chamado'}).click()
 await expect(page.getByText('Ajuste E2E',{exact:true})).toBeVisible()

 const other=await browser.newContext()
 try{
  const secondPage=await other.newPage()
  await open(secondPage,second.session)
  await secondPage.getByRole('button',{name:'Agenda operacional',exact:true}).click()
  await secondPage.getByLabel('Situação de Ajuste E2E').selectOption('Concluída')
  await expect(secondPage.getByText('Ajuste E2E',{exact:true})).toHaveCount(0)
  const rows=await checked(second.client.from('hub_activities').select('status').eq('workspace_id',workspace).eq('title','Ajuste E2E'))
  expect(rows).toEqual([{status:'Concluída'}])
  expect(await checked(outsider.client.from('hub_activities').select('id').eq('workspace_id',workspace))).toEqual([])
 }finally{await other.close()}
 const forecast=page.getByRole('button',{name:'Registrar previsão'})
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 await page.getByRole('button',{name:'Financeiro',exact:true}).click()
 await page.getByRole('button',{name:'Todos os meses'}).click()
 await page.getByLabel('Projeto',{exact:true}).selectOption(proposal)
 await forecast.click()
 const receipt=page.getByLabel('Previsão',{exact:true})
 await receipt.selectOption({index:1})
 await page.getByLabel('Valor recebido (R$)').fill('40')
 await page.getByRole('button',{name:'Salvar recebimento'}).click()
 const received=page.locator('article').filter({has:page.getByRole('heading',{name:'Recebido',exact:true})})
 await expect(received).toContainText(/40,00/)
 await page.getByRole('button',{name:'Estornar',exact:true}).click()
 await page.getByLabel('Motivo do estorno').fill('Duplicidade de teste')
 await page.getByRole('button',{name:'Confirmar estorno'}).click()
 await expect(received).toContainText(/0,00/)
 await expect(page.getByText(/Estornado em.*Duplicidade de teste/)).toBeVisible()
 const ledger=await checked(second.client.from('hub_receipts').select('amount,reversed_at').eq('workspace_id',workspace))
 expect(ledger).toHaveLength(1)
 expect(ledger[0].amount).toBe(40)
 expect(ledger[0].reversed_at).toBeTruthy()
 expect(await checked(outsider.client.from('hub_receipts').select('id').eq('workspace_id',workspace))).toEqual([])

 await page.getByLabel(/^Descrição/).fill('Licença de teste')
 await page.getByLabel('Valor previsto (R$)').fill('25')
 await page.getByRole('button',{name:'Registrar despesa prevista'}).click()
 const expense=page.getByRole('row').filter({hasText:'Licença de teste'})
 await expense.getByRole('button',{name:'Dar baixa'}).click()
 await expense.getByLabel('Valor pago (R$)').fill('30')
 await expense.getByRole('button',{name:'Registrar pagamento'}).click()
 await expect(expense).toContainText(/30,00/)
 const expenseEvents=await checked(second.client.from('hub_finance_audit').select('operation,before_record,after_record')
  .eq('workspace_id',workspace).eq('entity','hub_expenses'))
 expect(expenseEvents.map(event=>event.operation).sort()).toEqual(['INSERT','UPDATE'])
 const payment=expenseEvents.find(event=>event.operation==='UPDATE')
 expect(payment.before_record.paid_amount).toBeNull()
 expect(payment.after_record).toMatchObject({amount:25,paid_amount:30})
 await expect(page.getByText(/Despesa · Baixa/)).toBeVisible()

 const month=await expense.getByRole('cell').nth(1).textContent()
 const [day,mm,year]=month.trim().split('/')
 expect(day).toMatch(/^\d{2}$/)
 await page.getByLabel('Mês de referência').fill(year+'-'+mm)
 const downloading=page.waitForEvent('download')
 await page.getByRole('button',{name:'Exportar relatório CSV'}).click()
 const download=await downloading
 expect(download.suggestedFilename()).toBe('decifaz-financeiro-'+year+'-'+mm+'.csv')
 const stream=await download.createReadStream()
 let csv=''
 for await(const chunk of stream)csv+=chunk.toString()
 expect(csv).toContain('"Despesa prevista";"Licença de teste";"'+month+'";"25,00"')
 expect(csv).toMatch(/"Despesa paga";"Licença de teste";"[^"]+";"30,00";"Realizado"/)
 expect(csv).toContain('"Estornado"')

 await page.getByRole('button',{name:'Central comercial',exact:true}).click()
 const contact=page.getByRole('row').filter({hasText:'Apresentar proposta'})
 await expect(contact).toContainText('Equipe E2E')
 await contact.getByRole('button',{name:'Apresentar proposta',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Jornada comercial de Cliente fictício'})).toBeVisible()
 await page.getByRole('button',{name:'Base de conhecimento',exact:true}).click()
 await page.getByLabel('Buscar na base').fill('Checklist de entrega e homologação')
 await page.getByRole('button',{name:'Checklist de entrega e homologação',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Checklist de entrega e homologação',exact:true})).toBeVisible()

})

test('link mágico do e-mail local abre o Hub e mantém a sessão após recarregar',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer a pilha local do Supabase.')
 const endpoint='http://127.0.0.1:54321'
 const origin='http://127.0.0.1:4181'
 const mailbox='http://127.0.0.1:54324'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw new Error('Use exclusivamente o Supabase local.')
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
 const email=randomUUID()+'@example.com'
 const workspace=randomUUID()
 const {data:{user},error}=await admin.auth.admin.createUser({email,email_confirm:true})
 if(error||!user)throw new Error('Falha ao criar a conta de teste.')
 const space=await admin.from('hub_workspaces').insert({id:workspace,name:'Decifaz Link Mágico'})
 if(space.error)throw space.error
 const member=await admin.from('hub_members').insert({workspace_id:workspace,user_id:user.id,role:'admin'})
 if(member.error)throw member.error

 await page.goto('/')
 await page.getByLabel('E-mail',{exact:true}).fill(email)
 await page.getByRole('button',{name:'Enviar link de acesso'}).click()
 await expect(page.getByText('Confira seu e-mail para entrar.')).toBeVisible()

 let messageId
 await expect.poll(async()=>{
  const response=await fetch(mailbox+'/api/v1/messages')
  if(!response.ok)return false
  const {messages}=await response.json()
  messageId=messages?.find(message=>message.To?.some(recipient=>recipient.Address===email))?.ID
  return Boolean(messageId)
 },{timeout:15000,message:'O e-mail deve chegar à caixa local do destinatário'}).toBe(true)

 const response=await fetch(mailbox+'/api/v1/message/'+encodeURIComponent(messageId))
 expect(response.ok).toBe(true)
 const {HTML}=await response.json()
 const href=await page.evaluate(html=>{
  const document=new DOMParser().parseFromString(html,'text/html')
  return [...document.querySelectorAll('a[href]')].find(link=>link.href.includes('/auth/v1/verify?'))?.href
 },HTML)
 if(!href)throw new Error('O e-mail não contém o link de verificação.')
 const verification=new URL(href)
 if(verification.origin!==endpoint||verification.pathname!=='/auth/v1/verify'||verification.searchParams.get('redirect_to')!==origin+'/'){
  throw new Error('O link de teste aponta para um destino inesperado.')
 }
 await page.goto(verification.href)
 await expect(page.getByText('Decifaz Link Mágico',{exact:true})).toBeVisible()
 await expect(page).toHaveURL(url=>url.origin===origin&&url.pathname==='/'&&!url.search&&!url.hash)
 await page.reload()
 await expect(page.getByText('Decifaz Link Mágico',{exact:true})).toBeVisible()
})
