import {test,expect} from '@playwright/test'

test.beforeEach(async({page})=>{
 test.skip(process.env.VITE_SUPABASE_URL!=='https://mock-hub.supabase.co','Requer API simulada.')
 await page.addInitScript(()=>localStorage.setItem('sb-mock-hub-auth-token',JSON.stringify({user:{id:'fake',email:'fake@example.invalid'},access_token:'fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600})))
})

async function fixtures(page,{financeError=false}={}){
 await page.route('https://mock-hub.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname
  if(financeError&&path==='/rest/v1/hub_receipts')return route.fulfill({status:403,json:{message:'Denied'}})
  const rows={
   '/functions/v1/hub-workspaces':{workspaces:[{id:'w',name:'Espaço fictício',role:'admin'}]},
   '/rest/v1/rpc/hub_dashboard':{funnel:{},priorities:{},scheduled:0,diagnosed:0,pending:0,overdue:0},
   '/rest/v1/hub_leads':[{id:'l',name:'Cliente central',segment:'Serviços',city:'Fortaleza',stage:'Qualificado',notes:'',profile:{owner:'Ana',next:'Ligar ao cliente',due:'2026-11-10'},created_at:'2026-11-01'}],
   '/rest/v1/hub_projects_visible':[{proposal_id:'p',lead_id:'l',status:'Em andamento',owner:'Bia',due_on:'2026-11-15',deliverables:'Entrega',delivery:null,approved:{title:'Projeto central',scope:'Escopo',services:[],version:1,setup:10,monthly:0}}],
   '/rest/v1/hub_activities':[{id:'t',title:'Revisar projeto',owner:'Bia',due_on:'2026-11-15',status:'Pendente',lead_id:'l',project_proposal_id:'p'}],
   '/rest/v1/hub_receivables':[{proposal_id:'p',kind:'Implantação',period:'0001-01-01',amount:100,due_on:'2026-10-10'}],
   '/rest/v1/hub_receipts':[{id:'r',proposal_id:'p',kind:'Implantação',period:'0001-01-01',amount:30,received_on:'2026-11-02',reversed_at:null}],
   '/rest/v1/hub_expenses':[{id:'e',title:'Licença mensal',amount:20,due_on:'2026-10-05',paid_on:'2026-11-03',paid_amount:25}],
  }
  return route.fulfill({json:rows[path]??[]})
 })
 await page.goto('/')
}

test('Central filtra responsável, prazo e situação, limpa e abre as fichas',async({page})=>{
 await fixtures(page)
 await page.getByRole('button',{name:'Central comercial',exact:true}).click()
 await expect(page.getByRole('button',{name:'Ligar ao cliente',exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:/^Responsável/}).selectOption('Bia')
 await expect(page.getByRole('button',{name:'Ligar ao cliente',exact:true})).toHaveCount(0)
 await page.getByLabel('Prazo até').fill('2026-11-01')
 await expect(page.getByText('Nenhum item no recorte',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Limpar filtros'}).click()
 await page.getByRole('combobox',{name:/^Situação/}).selectOption('Pendente')
 await page.getByRole('button',{name:'Revisar projeto',exact:true}).click()
 await expect(page.getByRole('dialog')).toContainText('Projeto central')
 await page.getByRole('button',{name:'Cancelar',exact:true}).click()
 await page.getByRole('button',{name:'Central comercial',exact:true}).click()
 await page.getByRole('button',{name:'Ligar ao cliente',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Editar estabelecimento',exact:true})).toBeVisible()
 await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Cliente central')
})

test('Conhecimento busca conteúdo, filtra categoria e mostra estado vazio',async({page})=>{
 await fixtures(page)
 await page.getByRole('button',{name:'Base de conhecimento',exact:true}).click()
 await page.getByLabel('Categoria',{exact:true}).selectOption('Scripts')
 await page.getByLabel('Buscar na base').fill('primeiro contato')
 await page.getByRole('button',{name:'Script de primeiro contato',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Script de primeiro contato',exact:true})).toBeVisible()
 await expect(page.getByText('Sugestão · a validar',{exact:true})).toBeVisible()
 await page.getByLabel('Buscar na base').fill('inexistente-xyz')
 await expect(page.getByText('Selecione um material',{exact:true})).toBeVisible()
 await page.getByLabel('Buscar na base').fill('')
 await page.getByRole('button',{name:'Abrir reuniões',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Central comercial',exact:true})).toBeVisible()
})

test('Falha financeira preserva CRM, Central e conhecimento',async({page})=>{
 await fixtures(page,{financeError:true})
 await expect(page.getByRole('alert')).toContainText('Financeiro:')
 await page.getByRole('button',{name:'Central comercial',exact:true}).click()
 await expect(page.getByRole('button',{name:'Ligar ao cliente',exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Base de conhecimento',exact:true}).click()
 await expect(page.getByLabel('Buscar na base')).toBeVisible()
})

test('Dashboard, financeiro e CSV mantêm o mesmo mês nas duas direções',async({page})=>{
 await fixtures(page)
 await page.getByLabel('Mês de análise').fill('2026-10')
 await expect(page.getByText('Saldo atrasado no mês')).toBeVisible()
 await page.getByRole('button',{name:'Abrir financeiro neste mês'}).click()
 await expect(page.getByLabel('Mês de referência')).toHaveValue('2026-10')
 await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Saldo a receber',exact:true})})).toContainText('70,00')
 const downloading=page.waitForEvent('download')
 await page.getByRole('button',{name:'Exportar relatório CSV'}).click()
 const download=await downloading
 expect(download.suggestedFilename()).toBe('decifaz-financeiro-2026-10.csv')
 let csv=''
 for await(const chunk of await download.createReadStream())csv+=chunk.toString()
 expect(csv).toContain('"Receita prevista"')
 expect(csv).toContain('"Despesa prevista"')
 expect(csv).not.toContain('"Recebimento"')
 expect(csv).not.toContain('"Despesa paga"')
 await page.getByLabel('Mês de referência').fill('2026-11')
 await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Recebido',exact:true})})).toContainText('30,00')
 await page.getByRole('button',{name:'Dashboard',exact:true}).click()
 await expect(page.getByLabel('Mês de análise')).toHaveValue('2026-11')
})
