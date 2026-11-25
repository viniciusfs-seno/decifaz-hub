import {commercialMetricsFixture} from './helpers/commercial-metrics-fixture.mjs'
import {recordTab} from './helpers/portal-ui.mjs'
import {test,expect} from '@playwright/test'

test('financeiro compartilhado exporta o mês e exclui estornos do total recebido',async({page})=>{
 test.skip(process.env.VITE_HUB_MODE!=='shared','Execute com o ambiente de teste compartilhado.')
 let delivery=null
 let activity=[]
 const charge={proposal_id:'p',kind:'Implantação',period:'0001-01-01',amount:100}
 await page.route('https://mock-hub.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname
  const month=new Date().toISOString().slice(0,7)
  if(path==='/rest/v1/rpc/hub_accept_delivery'){
   const {c,d,e,t,o,due}=route.request().postDataJSON()
   delivery={checks:c,acceptedAt:d,reference:e}
   activity=[{id:'a',title:t,owner:o,due_on:due,status:'Pendente'}]
   return route.fulfill({json:true})
  }
  if(path==='/rest/v1/rpc/hub_open_support'){
   const {p,t,o,d}=route.request().postDataJSON()
   activity.push({id:'s',title:t,owner:o,due_on:d,status:'Pendente',support:true,project_proposal_id:p})
   return route.fulfill({json:true})
  }
  if(path==='/rest/v1/hub_activities'&&route.request().method()==='PATCH'){
   const id=new URL(route.request().url()).searchParams.get('id').slice(3)
   const item=activity.find(row=>row.id===id)
   item.status=route.request().postDataJSON().status
   return route.fulfill({json:{id}})
  }
  const fixtures={
   '/functions/v1/hub-workspaces':{workspaces:[{id:'w',name:'Homologação automatizada',role:'admin'}]},
   '/rest/v1/rpc/hub_commercial_metrics':commercialMetricsFixture,
   '/rest/v1/rpc/hub_dashboard':{funnel:{},priorities:{},scheduled:0,diagnosed:0,pending:0,overdue:0},
   '/rest/v1/hub_projects_visible':[{proposal_id:'p',status:delivery?'Entregue':'Em andamento',owner:'Equipe',due_on:null,deliverables:'',delivery,approved:{title:'Projeto teste',scope:'Teste',version:1,services:[],setup:100,monthly:0}}],
   '/rest/v1/hub_activities':activity,
   '/rest/v1/hub_receivables':[{...charge,due_on:month+'-02'}],
   '/rest/v1/hub_receipts':[{...charge,id:'r',received_on:month+'-02',reversed_at:month+'-03',reversal_reason:'Teste'}],
  }
  return route.fulfill({json:fixtures[path]??[]})
 })
 await page.addInitScript(()=>{
  const user={id:'teste',email:'teste@example.invalid'}
  localStorage.setItem('sb-mock-hub-auth-token',JSON.stringify({user,access_token:'fixture',refresh_token:'fixture',
   expires_at:Math.floor(Date.now()/1000)+3600}))
 })
 await page.goto('/')
 await expect(page.getByText('Homologação automatizada')).toBeVisible()
 await page.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
 await page.getByRole('button',{name:'Projeto teste',exact:true}).click()
 await recordTab(page,'Entrega e aceite');for(const label of ['Testes dos fluxos críticos concluídos','Entregáveis conferidos com o escopo aprovado','Pendências resolvidas ou acordadas com o cliente'])await page.getByLabel(label).check()
 await page.getByLabel('Evidência do aceite').fill('Aceite automatizado')
 await page.getByLabel('Criar atividade de pós-venda').check()
 await page.getByRole('button',{name:'Confirmar aceite da entrega'}).click()
 await expect(page.getByText('Entregue',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Projeto teste',exact:true}).click()
 await recordTab(page,'Atividades e suporte');await expect(page.getByText('Acompanhamento pós-venda',{exact:true})).toBeVisible()
 await page.getByLabel('Título do chamado').fill('Ajustar cadastro')
 await page.getByLabel('Responsável pelo chamado').fill('Equipe')
 await page.getByRole('button',{name:'Abrir chamado'}).click()
 await expect(page.getByText('Ajustar cadastro',{exact:true})).toBeVisible()
 await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
 await page.getByRole('button',{name:'Agenda operacional',exact:true}).click()
 const status=page.getByLabel('Situação de Ajustar cadastro')
 await status.selectOption('Em andamento')
 await expect(status).toHaveValue('Em andamento')
 await page.getByRole('button',{name:'Financeiro',exact:true}).click()
 await page.getByRole('button',{name:'Todos os meses'}).click()
 await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Recebido',exact:true})})).toContainText(/0,00/)
 await expect(page.getByText(/Estornado em/)).toBeVisible()
 const downloading=page.waitForEvent('download')
 await page.getByRole('button',{name:'Exportar relatório CSV'}).click()
 const download=await downloading
 expect(download.suggestedFilename()).toBe('decifaz-financeiro-todos.csv')
 const stream=await download.createReadStream()
 let csv=''
 for await(const chunk of stream)csv+=chunk.toString()
 expect(csv).toContain('"Receita prevista"')
 expect(csv).toContain('"Estornado"')
})
