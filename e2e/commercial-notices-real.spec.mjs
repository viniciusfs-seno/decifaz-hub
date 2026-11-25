import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql,session} from './helpers/local-db.mjs'
test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local')
const prefs={internal_enabled:true,email_enabled:true,lead_days:[30,7,1,0],daily_digest:false,digest_hour:9,watch_scope:'mine'}
const generate=f=>sql(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z')`)
const list=(f,who=f.owner)=>checked(who.client.rpc('hub_list_notices',{w:f.workspace}))
async function task(f){return checked(f.owner.client.rpc('hub_save_activity',{w:f.workspace,a:null,expected_revision:null,operation_id:randomUUID(),body:{lead_id:f.prospect,title:'Acompanhamento do aviso fictício',owner:'Responsável fictício',assigned_user_id:f.owner.id,due:f.today,status:'Pendente',result:''}}))}
test('Avisos comerciais sem navegador: concorrência, reenvio, leitura, atribuição, reagendamento, conclusão e perda de acesso',async()=>{
 const f=await operationalFixture();try{
  for(const u of [f.owner,f.restricted])await checked(u.client.rpc('hub_notice_prefs',{w:f.workspace,expected_revision:0,body:prefs}));let saved=await task(f),a=saved.current;
  const one=session(),two=session();one.child.stdin.end(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z');`);two.child.stdin.end(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z');`);await Promise.all([one.done,two.done]);let notices=(await list(f)).filter(n=>n.record_id===a.id);expect(notices).toHaveLength(1);expect(notices[0].financial).toBe(false);expect((await list(f,f.restricted)).some(n=>n.record_id===a.id)).toBe(false)
  await checked(f.owner.client.rpc('hub_read_notice',{w:f.workspace,n:notices[0].id}));expect((await checked(f.owner.client.from('hub_activities').select('status').eq('id',a.id).single())).status).toBe('Pendente')
  const write=async(body)=>{const r=await checked(f.owner.client.rpc('hub_save_activity',{w:f.workspace,a:a.id,expected_revision:a.revision,operation_id:randomUUID(),body:{title:a.title,owner:a.owner,assigned_user_id:a.assigned_user_id,due:a.due_on,status:a.status,result:'',...body}}));a=r.current;return r}
  await write({assigned_user_id:f.restricted.id});expect((await list(f)).find(n=>n.record_id===a.id).effective_resolved_at).toBeTruthy();generate(f);notices=(await list(f,f.restricted)).filter(n=>n.record_id===a.id);expect(notices).toHaveLength(1)
  const tomorrow=new Date(Date.parse(f.today+'T12:00Z')+86400000).toISOString().slice(0,10);await write({due:tomorrow});expect((await list(f,f.restricted)).find(n=>n.record_id===a.id).effective_resolved_at).toBeTruthy();generate(f);expect((await list(f,f.restricted)).filter(n=>n.record_id===a.id&&n.due_on===tomorrow&&!n.effective_resolved_at)).toHaveLength(1);generate(f);expect((await list(f,f.restricted)).filter(n=>n.record_id===a.id&&n.due_on===tomorrow)).toHaveLength(1)
  await write({status:'Concluída',result:'Concluído ficticiamente'});expect((await list(f,f.restricted)).filter(n=>n.record_id===a.id).every(n=>n.effective_resolved_at)).toBe(true);generate(f)
  const safe=await checked(f.restricted.client.rpc('hub_dues',{w:f.workspace,period:'all'}));expect(safe.rows.every(r=>!r.financial&&r.amount===null&&r.paid===null)).toBe(true)
  expect(sql(`select count(*) from hub_private.notice_outbox o join hub_notices n on n.id=o.notice_id where o.workspace_id='${f.workspace}' and n.kind like 'commercial-%'`)).toBe('0')
  await checked(f.admin.from('hub_members').update({active:false}).eq('workspace_id',f.workspace).eq('user_id',f.restricted.id));expect((await f.restricted.client.rpc('hub_list_notices',{w:f.workspace})).error?.code).toBe('42501');expect((await f.owner.client.rpc('hub_list_notices',{w:f.other})).error?.code).toBe('42501')
 }finally{await f.cleanup()}
})
test('Aviso comercial: origem editável, leitura sem conclusão e contexto preservado no celular',async({page})=>{
 const f=await operationalFixture();try{
  await task(f);generate(f);await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Central de vencimentos',exact:true}).click();await page.getByRole('tab',{name:'Meus avisos',exact:true}).click();const item=page.locator('.due-notices li').filter({has:page.getByRole('heading',{name:'Acompanhamento do aviso fictício',exact:true})});await item.getByRole('button',{name:'Marcar como lido',exact:true}).click();await expect(item).toContainText('Lido');await item.getByRole('button',{name:'Abrir origem do aviso',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByLabel('Título da atividade',{exact:true})).toHaveValue('Acompanhamento do aviso fictício');await page.keyboard.press('Escape');await expect(page.getByRole('tab',{name:'Meus avisos',exact:true})).toHaveAttribute('aria-selected','true')
  fs.mkdirSync('.validation/commercial-routine',{recursive:true});await page.screenshot({path:'.validation/commercial-routine/avisos-1440-light.png'});await page.setViewportSize({width:390,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await page.screenshot({path:'.validation/commercial-routine/avisos-390-dark.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await f.cleanup()}
})

test('Avisos: oportunidade encerrada, retomada, preferências, atraso e rollback do gerador',async()=>{
 const f=await operationalFixture();try{
  const a=(await task(f)).current;generate(f);const own=()=>list(f).then(rows=>rows.find(n=>n.record_id===a.id));expect((await own()).effective_resolved_at).toBeNull()
  for(const stage of ['Perdido','Ganho']){await checked(f.admin.from('hub_leads').update({stage}).eq('id',f.prospect));expect((await own()).effective_resolved_at).toBeTruthy();generate(f)}
  await checked(f.admin.from('hub_leads').update({stage:'Qualificado'}).eq('id',f.prospect));generate(f);expect((await own()).effective_resolved_at).toBeNull()
  await checked(f.owner.client.rpc('hub_notice_prefs',{w:f.workspace,expected_revision:0,body:{...prefs,email_enabled:false,internal_enabled:false}}));expect((await own()).effective_resolved_at).toBeTruthy();generate(f)
  const pref=await checked(f.owner.client.rpc('hub_notice_prefs',{w:f.workspace}));await checked(f.owner.client.rpc('hub_notice_prefs',{w:f.workspace,expected_revision:pref.revision,body:{...prefs,email_enabled:false}}));sql(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z'::timestamptz+interval '10 days')`);expect((await own()).effective_resolved_at).toBeNull();expect(sql(`select count(*) from hub_notices where workspace_id='${f.workspace}' and user_id='${f.owner.id}' and record_id='${a.id}'`)).toBe('1')
  const before=sql(`select md5(jsonb_agg(to_jsonb(n) order by id)::text) from hub_notices n where workspace_id='${f.workspace}'`);sql(`create function hub_private.fail_notices_test() returns trigger language plpgsql as $$begin raise exception 'Falha fictícia';end$$;create trigger fail_notices_test before update on hub_notices for each row when(new.workspace_id='${f.workspace}'::uuid) execute function hub_private.fail_notices_test();`)
  try{expect(()=>generate(f)).toThrow('Falha fictícia')}finally{sql('drop trigger fail_notices_test on hub_notices;drop function hub_private.fail_notices_test()')};expect(sql(`select md5(jsonb_agg(to_jsonb(n) order by id)::text) from hub_notices n where workspace_id='${f.workspace}'`)).toBe(before)
 }finally{await f.cleanup()}
})

test('Ativação separada: frontend anterior não recebe novas origens; recuperação invalida sem apagar',async()=>{
 const f=await operationalFixture();try{
  const a=(await task(f)).current;sql('update hub_private.notice_settings set commercial_enabled=false');let sources=await checked(f.owner.client.rpc('hub_dues',{w:f.workspace,period:'all'}));expect(sources.rows.some(r=>r.kind.startsWith('commercial-'))).toBe(false);expect((await checked(f.owner.client.rpc('hub_commercial_metrics',{w:f.workspace,from_on:f.today,to_on:f.today}))).pending).toBeGreaterThan(0);generate(f);expect((await list(f)).some(n=>n.record_id===a.id)).toBe(false)
  expect(sql("select hub_private.notice_commercial_date('today') is null and hub_private.notice_commercial_date('25/11/2026') is null and hub_private.notice_commercial_date('2026-02-30') is null")).toBe('t')
  sql('update hub_private.notice_settings set commercial_enabled=true');generate(f);expect((await list(f)).filter(n=>n.record_id===a.id&&!n.effective_resolved_at)).toHaveLength(1);sql('update hub_private.notice_settings set commercial_enabled=false');generate(f);expect((await list(f)).some(n=>n.record_id===a.id)).toBe(false);expect(sql(`select bool_and(resolved_at is not null) from hub_notices where workspace_id='${f.workspace}' and record_id='${a.id}'`)).toBe('t');expect(sql(`select count(*) from hub_notices where workspace_id='${f.workspace}' and record_id='${a.id}'`)).not.toBe('0')
 }finally{sql('update hub_private.notice_settings set commercial_enabled=true');await f.cleanup()}
})
