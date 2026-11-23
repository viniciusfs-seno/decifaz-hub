import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {createClient} from '@supabase/supabase-js'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10)
async function fixture(){const f=await operationalFixture();await registryFixture(f);await checked(f.owner.client.rpc('hub_set_member_label',{w:f.workspace,u:f.owner.id,n:'Marina fictícia',expected_revision:0}));await checked(f.owner.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Caio fictício',expected_revision:0}));const cleanup=f.cleanup;f.cleanup=async()=>{sql(`delete from public.hub_notices where workspace_id='${f.workspace}';delete from public.hub_notice_preferences where workspace_id='${f.workspace}';`);await cleanup()};return f}
const rpc=async(client,name,body)=>checked(client.rpc(name,body))
test('Central: projeção autorizada, contagem completa, preferências concorrentes, leitura e baixa',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(120000);const f=await fixture()
 try{
  const all=await rpc(f.owner.client,'hub_dues',{w:f.workspace,period:'all'});expect(all.total).toBeGreaterThan(8)
  const limited=await rpc(f.restricted.client,'hub_dues',{w:f.workspace,period:'all'});expect(limited.rows.length).toBeGreaterThan(0);expect(limited.rows.every(x=>!x.financial&&x.amount===null&&x.paid===null)).toBe(true);expect(limited.categories).not.toContain('Domínios')
  const anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}})
  expect((await anon.rpc('hub_dues',{w:f.workspace})).error?.code).toBe('42501');expect((await f.owner.client.rpc('hub_dues',{w:f.other})).error?.code).toBe('42501')
  const prefs={internal_enabled:true,email_enabled:false,lead_days:[30,7,1,0],daily_digest:true,digest_hour:9,watch_scope:'space'}
  const saved=await rpc(f.owner.client,'hub_notice_prefs',{w:f.workspace,body:prefs,expected_revision:0});expect(saved.current.revision).toBe(1)
  const edits=await Promise.all([f.owner.client.rpc('hub_notice_prefs',{w:f.workspace,body:{...prefs,digest_hour:10},expected_revision:1}),f.owner.client.rpc('hub_notice_prefs',{w:f.workspace,body:{...prefs,digest_hour:11},expected_revision:1})]);expect(edits.map(r=>r.data.status).sort()).toEqual(['conflict','saved'])
  expect((await f.owner.client.from('hub_notice_preferences').update({digest_hour:12}).eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  const bill=all.rows.find(r=>r.kind==='bill'),nid=randomUUID();sql(`insert into public.hub_notices(id,workspace_id,user_id,source_key,kind,record_id,due_on,financial) values('${nid}','${f.workspace}','${f.owner.id}','${bill.source_key}','bill','${bill.record_id}','${bill.due_on}',true)`)
  await rpc(f.owner.client,'hub_read_notice',{w:f.workspace,n:nid});expect((await rpc(f.owner.client,'hub_list_notices',{w:f.workspace}))[0].read_at).toBeTruthy();expect((await rpc(f.owner.client,'hub_list_notices',{w:f.workspace}))[0].effective_resolved_at).toBeNull()
  expect((await f.second.client.rpc('hub_read_notice',{w:f.workspace,n:nid})).error?.code).toBe('42501');expect(await rpc(f.restricted.client,'hub_list_notices',{w:f.workspace})).toEqual([])
  const changes=await Promise.all([f.owner.client.rpc('hub_reschedule_internal',{w:f.workspace,b:bill.record_id,expected_revision:bill.revision,new_due:shift(f.today,2),reason:'Acordo fictício A'}),f.second.client.rpc('hub_reschedule_internal',{w:f.workspace,b:bill.record_id,expected_revision:bill.revision,new_due:shift(f.today,3),reason:'Acordo fictício B'})]);expect(changes.map(r=>r.data.status).sort()).toEqual(['conflict','saved'])
  const updated=changes.find(r=>r.data.status==='saved').data.current;expect(updated.competency.slice(0,7)).toBe(bill.due_on.slice(0,7));expect((await rpc(f.owner.client,'hub_list_notices',{w:f.workspace}))[0].effective_resolved_at).toBeTruthy()
  expect((await f.restricted.client.rpc('hub_reschedule_internal',{w:f.workspace,b:bill.record_id,expected_revision:updated.revision,new_due:shift(f.today,4),reason:'Não permitido'})).error?.code).toBe('42501')
  await rpc(f.owner.client,'hub_pay_internal_bill',{w:f.workspace,b:bill.record_id,expected_revision:updated.revision,operation_id:randomUUID(),paid_on:f.today,amount:Number(updated.amount),evidence:'Comprovante fictício'})
  const paid=(await rpc(f.owner.client,'hub_dues',{w:f.workspace,period:'all',closed:true})).rows.find(x=>x.record_id===bill.record_id);expect(paid.state).toBe('Paga');expect(paid.paid).toBe(paid.amount)
  const member=(await rpc(f.owner.client,'hub_list_members',{w:f.workspace})).find(x=>x.user_id===f.restricted.id);await rpc(f.owner.client,'hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:member.revision});expect((await f.restricted.client.rpc('hub_dues',{w:f.workspace})).error?.code).toBe('42501')
 }finally{await f.cleanup()}
})

test('Central: 61 ocorrências, paginação estável e filtros antes das contagens',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');const f=await fixture()
 try{
  sql(`insert into public.hub_internal_obligations(workspace_id,id,title,supplier,category,owner,owner_id,amount,frequency,anchor_on,status) select '${f.workspace}',gen_random_uuid(),'Lote fictício '||i,'Exemplo','Lote fictício','Responsável fictício','${f.owner.id}',10,0,'${f.today}','Ativa' from generate_series(1,61)i`)
  await rpc(f.owner.client,'hub_generate_internal',{w:f.workspace,through_on:f.today})
  const query={w:f.workspace,period:'today',cat:'Lote fictício',person:f.owner.id},a=await rpc(f.owner.client,'hub_dues',query),b=await rpc(f.owner.client,'hub_dues',{...query,skip:50})
  expect(a.total).toBe(61);expect(a.counts.today).toBe(61);expect(a.rows).toHaveLength(50);expect(b.rows).toHaveLength(11);expect(new Set([...a.rows,...b.rows].map(x=>x.source_key)).size).toBe(61)
  expect((await rpc(f.restricted.client,'hub_dues',query)).total).toBe(0)
 }finally{await f.cleanup()}
})

test('Central: duas sessões, origem, retorno com filtro, preferências, teclado e celular',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(150000);const f=await fixture(),other=await browser.newContext()
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Central de vencimentos',exact:true})).toBeVisible();await page.getByText('Filtrar vencimentos',{exact:true}).click();await page.getByLabel('Categoria',{exact:true}).selectOption('Domínios');await expect(page.getByRole('status').filter({hasText:'registros no recorte'})).toContainText('2 registros')
  await page.getByText('Filtrar vencimentos',{exact:true}).click();fs.mkdirSync('.validation/dues-captures',{recursive:true});await page.screenshot({path:'.validation/dues-captures/central-desktop.png',fullPage:true})
  const p2=await other.newPage();await p2.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.second.session);await p2.goto('/');await p2.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click();await p2.getByText('Filtrar vencimentos',{exact:true}).click();await p2.getByLabel('Categoria',{exact:true}).selectOption('Domínios')
  await page.getByRole('button',{name:'Abrir / registrar pagamento',exact:true}).first().click();const dialog=page.getByRole('dialog').filter({has:page.getByRole('heading',{name:/Ocorrência/})});await expect(dialog).toBeVisible();await dialog.getByLabel('Referência ou evidência do pagamento').fill('Baixa manual fictícia de homologação');await dialog.getByLabel('Confirmo que o pagamento foi realizado fora do Hub',{exact:true}).check();await dialog.getByRole('button',{name:'Confirmar baixa manual',exact:true}).click();await expect(dialog.getByText(/Baixa manual:/)).toBeVisible();await page.keyboard.press('Escape')
  await page.getByRole('button',{name:'← Voltar à Central de vencimentos',exact:true}).click();await expect(page.getByLabel('Categoria',{exact:true})).toHaveValue('Domínios');await expect(page.getByRole('status').filter({hasText:'registros no recorte'})).toContainText('1 registros')
  await p2.getByRole('button',{name:'Atualizar Central',exact:true}).click();await expect(p2.getByRole('status').filter({hasText:'registros no recorte'})).toContainText('1 registros')
  await page.getByRole('tab',{name:'Preferências',exact:true}).click();await page.getByLabel('Horário do resumo (Fortaleza)',{exact:true}).selectOption('10');await page.getByRole('button',{name:'Salvar preferências',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Preferências salvas.'})).toBeVisible();await page.getByRole('button',{name:'Salvar preferências',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Preferências salvas.'})).toBeVisible()
  await page.getByRole('tab',{name:'Preferências',exact:true}).focus();await page.keyboard.press('Home');await expect(page.getByRole('tab',{name:'Vencimentos',exact:true})).toBeFocused()
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,behavior:'instant'})});await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);const firstAction=await page.getByRole('button',{name:'Abrir registro original',exact:true}).first().boundingBox();expect(firstAction.y+firstAction.height).toBeLessThanOrEqual(844);await page.screenshot({path:'.validation/dues-captures/central-celular-escuro.png',fullPage:true})
  await page.getByText('Filtrar vencimentos',{exact:true}).click();await page.getByLabel('Categoria',{exact:true}).selectOption('Contrato');await page.getByLabel('Período dos vencimentos',{exact:true}).selectOption('overdue');await expect(page.getByRole('button',{name:'Abrir registro original',exact:true})).toHaveCount(0)
 }finally{await other.close();await f.cleanup()}
})
