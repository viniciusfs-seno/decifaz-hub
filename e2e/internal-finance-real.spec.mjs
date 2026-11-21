import {bootDiagnostics} from './helpers/boot-diagnostics.mjs'
import {openDisclosure,recordTab} from './helpers/portal-ui.mjs'
import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'

test.use({actionTimeout:15000})
test('Obrigações: competências, concorrência, baixa atômica, isolamento e interface',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(150000)
 const f=await operationalFixture(),o=randomUUID(),annual=randomUUID(),one=randomUUID()
 const cleanup=()=>sql(`delete from public.hub_private_documents where workspace_id='${f.workspace}';delete from public.hub_internal_payments where workspace_id='${f.workspace}';delete from public.hub_internal_bills where workspace_id='${f.workspace}';delete from public.hub_internal_obligations where workspace_id='${f.workspace}';delete from public.hub_registry_events where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`)
 let second
 try{
  expect(sql(`select hub_private.obligation_due('2027-01-31',1)||','||hub_private.obligation_due('2027-01-31',2)||','||hub_private.obligation_due('2024-02-29',12)||','||hub_private.obligation_due('2028-01-30',1);`)).toBe('2027-02-28,2027-03-31,2025-02-28,2028-02-29')
  const anchor=f.today.slice(0,7)+'-01',body={title:'Assinatura fictícia',supplier:'Fornecedor fictício',category:'Ferramentas',owner:'Sócio fictício',owner_id:f.owner.id,amount:99.9,frequency:1,anchor_on:anchor,payment_method:'Pix informativo',status:'Ativa',auto_renew:true,cancel_by:f.today,panel_url:'https://example.invalid/painel',lead_id:null,project_id:null,contract_id:null,confirmation:'Cadastro fictício conferido'}
  const args={w:f.workspace,o,expected_revision:null,operation_id:randomUUID(),body}
  const saved=await checked(f.owner.client.rpc('hub_save_internal_obligation',args));expect(saved.status).toBe('saved');expect(await checked(f.owner.client.rpc('hub_save_internal_obligation',args))).toEqual(saved)
  for(const table of ['hub_internal_obligations','hub_internal_bills','hub_internal_payments'])expect(await checked(f.restricted.client.from(table).select('*').eq('workspace_id',f.workspace))).toEqual([])
  expect((await f.restricted.client.rpc('hub_save_internal_obligation',{...args,o:randomUUID(),operation_id:randomUUID()})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_save_internal_obligation',{...args,w:f.other,o:randomUUID(),operation_id:randomUUID()})).error?.code).toBe('42501')
  await checked(f.owner.client.rpc('hub_save_internal_obligation',{...args,o:annual,operation_id:randomUUID(),body:{...body,title:'Domínio anual fictício',frequency:12,amount:60}}))
  await checked(f.owner.client.rpc('hub_save_internal_obligation',{...args,o:one,operation_id:randomUUID(),body:{...body,title:'Despesa avulsa fictícia',frequency:0,amount:40}}))
  const through=new Date(Date.parse(f.today+'T12:00:00Z')+366*86400000).toISOString().slice(0,10)
  const generation=await Promise.all([f.owner,f.second].map(u=>checked(u.client.rpc('hub_generate_internal',{w:f.workspace,through_on:through}))));expect(generation).toEqual([0,0])
  let bills=await checked(f.owner.client.from('hub_internal_bills').select('*').eq('workspace_id',f.workspace).eq('obligation_id',o).order('due_on'));expect(bills.length).toBeGreaterThan(12);expect(new Set(bills.map(b=>b.competency)).size).toBe(bills.length)
  expect((await checked(f.owner.client.from('hub_internal_bills').select('id').eq('workspace_id',f.workspace).eq('obligation_id',annual))).length).toBe(2)
  expect((await checked(f.owner.client.from('hub_internal_bills').select('id').eq('workspace_id',f.workspace).eq('obligation_id',one))).length).toBe(1)
  for(const table of ['hub_internal_obligations','hub_internal_bills','hub_internal_payments'])expect(await checked(f.restricted.client.from(table).select('*').eq('workspace_id',f.workspace))).toEqual([])
  expect((await f.restricted.client.rpc('hub_generate_internal',{w:f.workspace,through_on:f.today})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_generate_internal',{w:f.other,through_on:f.today})).error?.code).toBe('42501')
  expect((await f.owner.client.from('hub_internal_bills').update({amount:1}).eq('id',bills[0].id)).error?.code).toBe('42501')
  const b=bills[0],payArgs={w:f.workspace,b:b.id,expected_revision:b.revision,operation_id:randomUUID(),paid_on:f.today,amount:98.5,evidence:'Pagamento fictício confirmado'}
  const paid=await checked(f.owner.client.rpc('hub_pay_internal_bill',payArgs));expect(paid.current.paid_amount).toBe(98.5);expect(await checked(f.owner.client.rpc('hub_pay_internal_bill',payArgs))).toEqual(paid)
  const stale=await checked(f.second.client.rpc('hub_pay_internal_bill',{...payArgs,operation_id:randomUUID()}));expect(stale.status).toBe('conflict')
  expect(await checked(f.owner.client.from('hub_internal_payments').select('id').eq('workspace_id',f.workspace).eq('bill_id',b.id))).toHaveLength(1)
  const updated=await Promise.all([f.owner,f.second].map(u=>checked(u.client.rpc('hub_save_internal_obligation',{...args,expected_revision:0,operation_id:randomUUID(),body:{...body,amount:120,status:'Pausada'}}))));expect(updated.map(x=>x.status).sort()).toEqual(['conflict','saved'])
  bills=await checked(f.owner.client.from('hub_internal_bills').select('*').eq('workspace_id',f.workspace).eq('obligation_id',o).order('due_on'));expect(bills.find(x=>x.id===b.id)).toMatchObject({status:'Paga',amount:99.9,paid_amount:98.5});expect(bills.filter(x=>x.due_on>f.today).every(x=>x.status==='Suspensa'&&x.amount===120)).toBe(true)
  await checked(f.owner.client.rpc('hub_save_internal_obligation',{...args,expected_revision:1,operation_id:randomUUID(),body:{...body,amount:120}}))
  const next=(await checked(f.owner.client.from('hub_internal_bills').select('*').eq('workspace_id',f.workspace).eq('obligation_id',o).gt('due_on',f.today).order('due_on')))[0]
  expect((await f.restricted.client.rpc('hub_pay_internal_bill',{w:f.workspace,b:next.id,expected_revision:next.revision,operation_id:randomUUID(),paid_on:f.today,amount:120,evidence:'Tentativa fictícia sem permissão'})).error?.code).toBe('42501')
  sql(`create function public.test_reject_internal_event() returns trigger language plpgsql as $$begin if new.workspace_id='${f.workspace}'::uuid and new.kind='payment' then raise exception 'Falha fictícia de auditoria';end if;return new;end$$;create trigger test_reject_internal_event before insert on public.hub_registry_events for each row execute function public.test_reject_internal_event();`)
  try{expect((await f.owner.client.rpc('hub_pay_internal_bill',{...payArgs,b:next.id,expected_revision:next.revision,operation_id:randomUUID()})).error).toBeTruthy();expect((await checked(f.owner.client.from('hub_internal_bills').select('status').eq('id',next.id).single())).status).toBe('Prevista');expect(await checked(f.owner.client.from('hub_internal_payments').select('id').eq('bill_id',next.id))).toHaveLength(0)}finally{sql('drop trigger test_reject_internal_event on public.hub_registry_events;drop function public.test_reject_internal_event();')}
  const races=await Promise.all([f.owner,f.second].map(u=>checked(u.client.rpc('hub_pay_internal_bill',{...payArgs,b:next.id,expected_revision:next.revision,operation_id:randomUUID()}))));expect(races.map(x=>x.status).sort()).toEqual(['conflict','paid'])
  const timeline=await checked(f.owner.client.rpc('hub_registry_timeline',{w:f.workspace,r:next.id}));expect(timeline.filter(e=>e.kind==='payment')).toHaveLength(1);expect(timeline.some(e=>e.actor_id===f.owner.id||e.actor_id===f.second.id)).toBe(true)
  expect(await checked(f.restricted.client.rpc('hub_registry_timeline',{w:f.workspace,r:next.id}))).toEqual([])
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Obrigações da Decifaz',exact:true}).click();await openDisclosure(page,'Planos e assinaturas');await expect(page.locator('article').getByRole('button',{name:'Domínio anual fictício',exact:true})).toBeVisible();await page.locator('article').getByRole('button',{name:'Assinatura fictícia',exact:true}).click();await page.getByLabel(/^Fornecedor/).fill('Fornecedor fictício atualizado');await page.getByLabel(/^Confirmação da alteração financeira/).fill('Edição de configuração fictícia conferida');await page.getByRole('button',{name:'Salvar obrigação',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);expect((await checked(f.owner.client.from('hub_internal_obligations').select('supplier').eq('id',o).single())).supplier).toBe('Fornecedor fictício atualizado');await page.getByLabel('Buscar obrigação',{exact:true}).fill('Assinatura');await expect(page.locator('tbody')).toContainText('Paga')
  second=await browser.newContext();const p=await second.newPage();await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.second.session);await bootDiagnostics(p,async()=>{await p.goto('/');await p.getByRole('navigation').getByRole('button',{name:'Obrigações da Decifaz',exact:true}).click()});await openDisclosure(p,'Planos e assinaturas');await expect(p.locator('article').getByRole('button',{name:'Domínio anual fictício',exact:true})).toBeVisible()
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:0}));expect((await f.second.client.rpc('hub_generate_internal',{w:f.workspace,through_on:f.today})).error?.code).toBe('42501');expect(await checked(f.second.client.from('hub_internal_bills').select('*').eq('workspace_id',f.workspace))).toEqual([])
 }finally{await second?.close();cleanup();await f.cleanup()}
})
