import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {weekStart} from '../src/management-data.ts'
import {openDisclosure} from './helpers/portal-ui.mjs'
test.use({actionTimeout:15000})
async function fixture(){const f=await operationalFixture();await registryFixture(f);for(const [u,name] of [[f.owner,'Marina Fictícia'],[f.second,'Caio Fictício'],[f.restricted,'Comercial Fictício']])await checked(f.admin.auth.admin.updateUserById(u.id,{user_metadata:{name}}));const previous=f.cleanup;f.cleanup=async()=>{sql(`delete from public.hub_financial_week_closures where workspace_id='${f.workspace}';delete from public.hub_expenses where workspace_id='${f.workspace}'`);await previous()};return f}
const report=(f,client=f.owner.client,args={})=>checked(client.rpc('hub_financial_week',{w:f.workspace,start_on:weekStart(f.today),...args}))

test('Revisão financeira: recorte completo, realização, concorrência, idempotência, auditoria e autorização',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(120000);const f=await fixture(),week=weekStart(f.today)
 try{
  const r=await report(f);expect(r.totals).toMatchObject({forecast:2400,received:800,expenses:159.9,paid:0});expect(r.items.some(i=>i.kind==='bill'&&i.contract_id)).toBe(true)
  expect((await f.restricted.client.rpc('hub_financial_week',{w:f.workspace,start_on:week})).error?.code).toBe('42501');expect((await f.owner.client.rpc('hub_financial_week',{w:f.other,start_on:week})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_financial_week',{w:f.workspace,start_on:week,page_offset:-1})).error?.code).toBe('22023')
  const base={w:f.workspace,start_on:week,expected_revision:0,notes_text:'Decisões financeiras FICTÍCIAS reservadas'}
  const operations=[randomUUID(),randomUUID()],race=await Promise.all([f.owner,f.second].map((u,i)=>checked(u.client.rpc('hub_close_financial_week',{...base,operation_id:operations[i]}))))
  expect(race.map(x=>x.status).sort()).toEqual(['conflict','saved']);const i=race.findIndex(x=>x.status==='saved'),winner=[f.owner,f.second][i]
  const retry=await checked(winner.client.rpc('hub_close_financial_week',{...base,operation_id:operations[i]}));expect(retry.current.revision).toBe(1)
  expect((await winner.client.rpc('hub_close_financial_week',{...base,operation_id:operations[i],notes_text:'Outra intenção'})).error?.code).toBe('22023')
  const closed=await checked(f.owner.client.from('hub_financial_week_closures').select('*').eq('workspace_id',f.workspace));expect(closed).toHaveLength(1);expect(closed[0].report.totals.paid).toBe(0)
  expect(await checked(f.restricted.client.from('hub_financial_week_closures').select('*').eq('workspace_id',f.workspace))).toEqual([])
  expect((await f.owner.client.from('hub_financial_week_closures').update({notes:'Tentativa direta'}).eq('workspace_id',f.workspace)).error?.code).toBe('42501');expect((await f.owner.client.from('hub_financial_week_closures').delete().eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_close_financial_week',{...base,operation_id:randomUUID()})).error?.code).toBe('42501')
  const bill=r.items.find(i=>i.kind==='bill'&&Number(i.expected)===60&&i.due_on===f.today),current=await checked(f.owner.client.from('hub_internal_bills').select('*').eq('id',bill.origin).single())
  const payment={w:f.workspace,b:bill.origin,expected_revision:current.revision,operation_id:randomUUID(),paid_on:f.today,amount:58.5,evidence:'Pagamento fictício conferido fora do Hub'}
  await checked(f.owner.client.rpc('hub_pay_internal_bill',payment));await checked(f.owner.client.rpc('hub_pay_internal_bill',payment));expect((await report(f)).totals).toMatchObject({expenses:159.9,paid:58.5});expect((await checked(f.owner.client.from('hub_financial_week_closures').select('report').eq('workspace_id',f.workspace)))[0].report.totals.paid).toBe(0)
  sql(`create function public.test_financial_close_failure() returns trigger language plpgsql as $$begin if new.workspace_id='${f.workspace}' and new.kind='financial_week' then raise exception 'Falha fictícia';end if;return new;end$$;create trigger test_financial_close_failure before insert on public.hub_registry_events for each row execute function public.test_financial_close_failure();`)
  try{expect((await f.owner.client.rpc('hub_close_financial_week',{...base,expected_revision:1,operation_id:randomUUID()})).error).toBeTruthy();expect(await checked(f.owner.client.from('hub_financial_week_closures').select('revision').eq('workspace_id',f.workspace))).toHaveLength(1)}finally{sql('drop trigger test_financial_close_failure on public.hub_registry_events;drop function public.test_financial_close_failure()')}
  await checked(f.owner.client.rpc('hub_set_roles',{w:f.workspace,u:f.second.id,r:['finance']}));expect((await report(f,f.second.client)).totals.paid).toBe(58.5)
  expect((await checked(f.second.client.rpc('hub_close_financial_week',{...base,expected_revision:1,operation_id:randomUUID(),notes_text:'Conferência fictícia por Financeiro'}))).status).toBe('saved')
  const m=await checked(f.admin.from('hub_members').select('role_revision').eq('workspace_id',f.workspace).eq('user_id',f.second.id).single());await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:m.role_revision}));expect((await f.second.client.rpc('hub_financial_week',{w:f.workspace,start_on:week})).error?.code).toBe('42501')
  await checked(f.admin.from('hub_expenses').insert(Array.from({length:105},(_,n)=>({workspace_id:f.workspace,id:randomUUID(),title:'Despesa de volume fictícia '+n,due_on:f.today,amount:1}))))
  const first=await report(f),next=await report(f,f.owner.client,{page_offset:100});expect(first.items).toHaveLength(100);expect(next.items.length).toBeGreaterThan(0);expect(first.totals).toEqual(next.totals);expect(first.totals.expenses).toBe(264.9);expect(first.as_of).toBe(f.today);expect(new Set([...first.items,...next.items].map(x=>x.kind+x.key)).size).toBe(first.count)
  expect(await checked(f.owner.client.from('hub_weekly_closures').select('*').eq('workspace_id',f.workspace))).toEqual([])
 }finally{await f.cleanup()}
})

test('Revisão financeira: duas sessões, baixa na origem, conflito, vazio, celular e restrição visual',async({browser,page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(150000);const f=await fixture(),other=await browser.newContext(),restricted=await browser.newContext()
 async function enter(p,u){await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),u.session);await p.goto('/');await p.getByRole('navigation').getByRole('button',{name:'Revisão semanal',exact:true}).click()}
 try{
  await enter(page,f.owner);const second=await other.newPage();await enter(second,f.second)
  const a=page.getByRole('region',{name:'Revisão financeira semanal'}),b=second.getByRole('region',{name:'Revisão financeira semanal'})
  await expect(a.getByText('Origens para conferir e agir',{exact:true})).toBeVisible();await openDisclosure(page,'Registrar conferência e decisões financeiras');await openDisclosure(second,'Registrar conferência e decisões financeiras')
  await a.getByLabel('Conferência e decisões financeiras',{exact:true}).fill('Primeira conferência fictícia');await b.getByLabel('Conferência e decisões financeiras',{exact:true}).fill('Rascunho concorrente fictício')
  await a.getByRole('button',{name:'Registrar fechamento financeiro',exact:true}).click();await expect(a.getByRole('status').filter({hasText:'Revisão financeira registrada'})).toBeVisible()
  await b.getByRole('button',{name:'Registrar fechamento financeiro',exact:true}).click();await expect(b.getByRole('alert')).toContainText('Outra sessão');await expect(b.getByLabel('Conferência e decisões financeiras',{exact:true})).toHaveValue('Primeira conferência fictícia')
  await a.getByLabel('Responsável financeiro',{exact:true}).selectOption(f.second.id);await expect(a.getByText('Nenhum lançamento neste recorte',{exact:true})).toBeVisible();await a.getByLabel('Responsável financeiro',{exact:true}).selectOption('');await expect(a.getByText('Origens para conferir e agir',{exact:true})).toBeVisible()
  fs.mkdirSync('.validation/financial-week',{recursive:true});await page.screenshot({path:'.validation/financial-week/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.documentElement.dataset.theme='dark');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.getByText('Revisão financeira dos sócios',{exact:true}).scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollBy(0,-100));await page.screenshot({path:'.validation/financial-week/mobile-dark.png'})
  await a.getByRole('button',{name:'Conferir e dar baixa',exact:true}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('textbox',{name:/^Referência ou evidência do pagamento/}).fill('Baixa fictícia da revisão');await page.getByLabel('Confirmo que o pagamento foi realizado fora do Hub',{exact:true}).check();await page.getByRole('button',{name:'Confirmar baixa manual',exact:true}).click();await expect(page.getByText('Baixa manual:',{exact:false})).toBeVisible()
  const limited=await restricted.newPage();await enter(limited,f.restricted);await expect(limited.getByRole('region',{name:'Revisão financeira semanal'})).toHaveCount(0);await expect(limited.locator('body')).not.toContainText('Primeira conferência fictícia')
  }finally{await other.close().catch(()=>{});await restricted.close().catch(()=>{});await f.cleanup()}
})
