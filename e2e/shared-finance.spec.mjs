import {test,expect} from '@playwright/test'

test('financeiro compartilhado exporta o mês e exclui estornos do total recebido',async({page})=>{
 test.skip(process.env.VITE_HUB_MODE!=='shared','Execute com o ambiente de teste compartilhado.')
 const charge={proposal_id:'p',kind:'Implantação',period:'0001-01-01',amount:100}
 await page.route('https://mock-hub.supabase.co/**',route=>{
  const path=new URL(route.request().url()).pathname
  const month=new Date().toISOString().slice(0,7)
  const fixtures={
   '/functions/v1/hub-workspaces':{workspaces:[{id:'w',name:'Homologação automatizada'}]},
   '/rest/v1/rpc/hub_dashboard':{funnel:{},priorities:{},scheduled:0,diagnosed:0,pending:0,overdue:0},
   '/rest/v1/hub_projects':[{proposal_id:'p',approved:{title:'Projeto teste'}}],
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
