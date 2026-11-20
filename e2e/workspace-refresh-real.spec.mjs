import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
test.use({actionTimeout:15000})
test('Duas sessões: contrato atualiza lista e Dashboard sem depender do relógio comercial',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f);const context=await browser.newContext(),observer=await context.newPage()
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Contratos',exact:true}).click();await expect(page.getByRole('button',{name:'Contrato fictício · Café Horizonte',exact:true})).toBeVisible()
  await observer.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.second.session);await observer.goto('/');await expect(observer.getByRole('button',{name:'Contrato fictício · Café Horizonte',exact:true})).toBeVisible()
  // Establish the commercial cursor first: a later contract-only change must still refresh.
  await observer.waitForResponse(r=>r.url().includes('/rpc/hub_workspace_version')&&r.status()===200,{timeout:22000})
  const before=await checked(f.owner.client.rpc('hub_workspace_version',{w:f.workspace}))
  const metadata=await checked(f.owner.client.from('hub_contracts').select('id').eq('workspace_id',f.workspace).single())
  const row=await checked(f.owner.client.rpc('hub_contract_detail',{w:f.workspace,c:metadata.id}))
  const fields=['lead_id','proposal_id','project_ids','title','owner','owner_id','status','starts_on','ends_on','renews_on','notice_days','cancel_notice_days']
  const body={...Object.fromEntries(fields.map(k=>[k,row[k]])),amount:row.financial.amount,monthly:row.financial.monthly,conditions:row.financial.conditions};body.title='Contrato atualizado na outra sessão';body.confirmation='Alteração fictícia para validar a atualização compartilhada'
  await checked(f.owner.client.rpc('hub_save_contract',{w:f.workspace,c:row.id,expected_revision:row.revision,operation_id:randomUUID(),body}))
  expect(await checked(f.owner.client.rpc('hub_workspace_version',{w:f.workspace}))).toBe(before)
  await expect(observer.getByRole('button',{name:body.title,exact:true})).toBeVisible({timeout:22000});await expect(page.getByRole('button',{name:body.title,exact:true})).toBeVisible({timeout:22000})
 }finally{await context.close();await f.cleanup()}
})
