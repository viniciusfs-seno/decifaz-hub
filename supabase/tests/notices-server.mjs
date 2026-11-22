import {test} from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from '../../e2e/helpers/operational-fixture.mjs'
import {registryFixture} from '../../scripts/registry-preview-fixture.mjs'
import {sql,session} from '../../e2e/helpers/local-db.mjs'
import {processNotices,workerConfig} from '../functions/_shared/notice-worker.mjs'
import {verifyNoticeEvent} from '../functions/_shared/notice-webhook.mjs'
const rpc=async(c,n,b={})=>checked(c.rpc(n,b))
const config=workerConfig({HUB_NOTICE_MODE:'mailpit',SUPABASE_URL:'http://127.0.0.1:54321',HUB_NOTICE_FROM:'avisos@example.invalid',HUB_NOTICE_PORTAL_URL:'https://preview.example.invalid'})
const prefs={internal_enabled:true,email_enabled:true,lead_days:[30,7,1,0],daily_digest:false,digest_hour:9,watch_scope:'space'}
const data=q=>JSON.parse(sql(`select coalesce(json_agg(x),'[]') from (${q})x`))
async function fixture(){
 const f=await operationalFixture();await registryFixture(f)
 await rpc(f.owner.client,'hub_notice_prefs',{w:f.workspace,body:prefs,expected_revision:0})
 sql('update hub_private.notice_settings set generation_enabled=true,mail_enabled=true,sandbox_only=true')
 const cleanup=f.cleanup;f.cleanup=async()=>{sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}';delete from hub_private.notice_runs where workspace_id='${f.workspace}';delete from public.hub_notices where workspace_id='${f.workspace}';delete from public.hub_notice_preferences where workspace_id='${f.workspace}';update hub_private.notice_settings set generation_enabled=false,mail_enabled=false`);await cleanup()}
 return f
}
const generate=(f,at=`${f.today}T12:00:00Z`)=>sql(`select hub_private.generate_notices('${f.workspace}','${at}')`)
const outbox=f=>data(`select id,state,attempts,total_attempts,error_code,delivered_at from hub_private.notice_outbox where workspace_id='${f.workspace}' order by id`)
const keepOne=f=>{const id=outbox(f)[0].id;sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}' and id<>'${id}'`);return id}

test('Geração sem navegador: catch-up, fases, concorrência, fuso, permissão e isolamento',async()=>{
 const f=await fixture()
 try{
  generate(f);const initial=outbox(f).length;assert(initial>0)
  generate(f);assert.equal(outbox(f).length,initial)
  const a=session(),b=session();a.child.stdin.end(`select hub_private.generate_notices('${f.workspace}',clock_timestamp());`);b.child.stdin.end(`select hub_private.generate_notices('${f.workspace}',clock_timestamp());`);await Promise.all([a.done,b.done]);assert.equal(outbox(f).length,initial)
  const common=await rpc(f.restricted.client,'hub_list_notices',{w:f.workspace});assert(common.length>0);assert(common.every(n=>n.financial===false))
  assert.equal((await f.owner.client.rpc('hub_notice_status',{w:f.other})).error.code,'42501')
  assert.equal((await f.restricted.client.rpc('hub_notice_status',{w:f.workspace})).error.code,'42501')
  for(const name of ['hub_notice_generate','hub_notice_claim','hub_notice_prepare'])assert.equal((await f.owner.client.rpc(name,name==='hub_notice_prepare'?{i:randomUUID(),l:randomUUID()}:{})).error.code,'42501')
  for(const table of ['notice_outbox','notice_runs','notice_settings','notice_attempts','notice_delivery_events','notice_summaries'])for(const privilege of ['SELECT','INSERT','UPDATE','DELETE'])assert.equal(sql(`select has_table_privilege('authenticated','hub_private.${table}','${privilege}')`),'f')
  // Configured 7-day reminder resurfaces once after read; 02:59 UTC is still
  // the previous business day. Missed jobs catch up, not exact-equality dates.
  const bill=data(`select id,due_on from public.hub_internal_bills where workspace_id='${f.workspace}' order by id limit 1`)[0]
  sql(`update public.hub_internal_bills set due_on='2030-02-08' where id='${bill.id}';delete from public.hub_notices where workspace_id='${f.workspace}' and record_id='${bill.id}'`)
  generate(f,'2030-01-31T12:00:00Z');const notice=data(`select id,stage from public.hub_notices where workspace_id='${f.workspace}' and user_id='${f.owner.id}' and record_id='${bill.id}'`)[0];assert.equal(notice.stage,30)
  await rpc(f.owner.client,'hub_read_notice',{w:f.workspace,n:notice.id});generate(f,'2030-02-01T02:59:00Z');assert.equal(data(`select read_at is not null as read from public.hub_notices where id='${notice.id}'`)[0].read,true)
  generate(f,'2030-02-01T03:01:00Z');assert.equal(data(`select stage,read_at from public.hub_notices where id='${notice.id}'`)[0].stage,7);assert.equal(data(`select read_at from public.hub_notices where id='${notice.id}'`)[0].read_at,null)
  generate(f,'2030-02-12T12:00:00Z');assert.equal(data(`select stage from public.hub_notices where id='${notice.id}'`)[0].stage,0)
 }finally{await f.cleanup()}
})

test('Mailpit: envio capturado, conteúdo mínimo, aceite separado, reexecução sem duplicação',async()=>{
 const f=await fixture()
 try{
  generate(f);const id=keepOne(f)
  const result=await processNotices(f.admin,config,{pace:0,limit:1});assert.equal(result.accepted,1);assert.equal(result.delivered,1)
  assert.equal(outbox(f)[0].state,'delivered');assert(outbox(f)[0].delivered_at)
  const row=data(`select envelope,provider_id from hub_private.notice_outbox where id='${id}'`)[0]
  assert(!/2400|99\.9|condição|contrato fictício|access_token|refresh_token/i.test(row.envelope.text))
  assert.equal(new URL(row.envelope.text.match(/https:\/\/\S+/)[0]).search,'?central=1')
  assert.equal((await processNotices(f.admin,config,{pace:0})).claimed,0)
  const duplicate=await f.admin.rpc('hub_notice_delivery',{provider_message:row.provider_id,event_key:'mailpit:'+row.provider_id,outcome:'delivered'});assert.equal(duplicate.error,null);assert.equal(duplicate.data,false)
  assert.equal(data(`select state from hub_private.notice_attempts where outbox_id='${id}' order by id`).map(x=>x.state).join(','),'pending,processing,accepted,delivered')
 }finally{await f.cleanup()}
})

test('Pagamento, reagendamento, cancelamento e membro desativado suprimem antes do envio',async()=>{
 const f=await fixture()
 try{
  generate(f)
  // Make only one bill notice eligible. Payment happens after claim/envelope.
  sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}' and notice_id not in(select id from public.hub_notices where kind='bill');`);const id=keepOne(f)
  let calls=0
  const result=await processNotices(f.admin,config,{pace:0,limit:1,fetcher:async()=>{calls++;throw Error('Must not send')},beforeSend:async()=>{
   const bill=data(`select b.id,b.revision,b.amount from public.hub_internal_bills b join public.hub_notices n on n.record_id=b.id join hub_private.notice_outbox o on o.notice_id=n.id where o.id='${id}'`)[0]
   await rpc(f.owner.client,'hub_pay_internal_bill',{w:f.workspace,b:bill.id,expected_revision:bill.revision,operation_id:randomUUID(),paid_on:f.today,amount:Number(bill.amount),evidence:'Baixa fictícia no preflight'})
  }})
  assert.equal(calls,0);assert.equal(result.suppressed,1);assert.equal(outbox(f)[0].state,'suppressed')
  generate(f);sql(`update public.hub_internal_obligations set status='Cancelada' where workspace_id='${f.workspace}';update public.hub_contracts set status='Cancelado' where workspace_id='${f.workspace}';update public.hub_receivables set due_on='2099-01-01' where workspace_id='${f.workspace}'`)
  const member=(await rpc(f.second.client,'hub_list_members',{w:f.workspace})).find(m=>m.user_id===f.owner.id)
  await rpc(f.second.client,'hub_update_member_active',{w:f.workspace,u:f.owner.id,enabled:false,expected_revision:member.revision})
  assert.equal((await processNotices(f.admin,config,{pace:0})).accepted,0)
  assert.equal((await f.owner.client.rpc('hub_list_notices',{w:f.workspace})).error.code,'42501')
 }finally{await f.cleanup()}
})

test('Falhas: 429 progressivo e limitado, resposta incerta em retenção, reprocessamento administrativo',async()=>{
 const f=await fixture()
 try{
  generate(f);const id=keepOne(f)
  for(let attempt=1;attempt<=5;attempt++){
   const result=await processNotices(f.admin,config,{pace:0,limit:1,fetcher:async()=>new Response('',{status:429})});assert.equal(result.retry,1)
   const row=outbox(f)[0];assert.equal(row.attempts,attempt);assert.equal(row.state,attempt===5?'failed':'pending')
   if(attempt<5){assert.equal(data(`select next_attempt_at>clock_timestamp()+interval '${Math.pow(2,attempt-1)*60-5} seconds' as delayed from hub_private.notice_outbox where id='${id}'`)[0].delayed,true);sql(`update hub_private.notice_outbox set next_attempt_at=clock_timestamp() where id='${id}'`)}
  }
  assert.equal((await f.restricted.client.rpc('hub_notice_retry',{w:f.workspace,i:id,confirmation:'Tentativa indevida',expected_attempts:5})).error.code,'42501')
  await rpc(f.owner.client,'hub_notice_retry',{w:f.workspace,i:id,confirmation:'Risco de duplicidade revisado em sandbox',expected_attempts:5})
  const uncertain=await processNotices(f.admin,config,{pace:0,limit:1,fetcher:async()=>{throw Error('timeout')}});assert.equal(uncertain.uncertain,1);assert.equal(outbox(f)[0].state,'uncertain')
  assert.equal((await processNotices(f.admin,config,{pace:0})).claimed,0)
  assert((await f.owner.client.rpc('hub_notice_retry',{w:f.workspace,i:id,confirmation:'Revisão antiga',expected_attempts:5})).error)
  await rpc(f.owner.client,'hub_notice_retry',{w:f.workspace,i:id,confirmation:'Segunda e última repetição fictícia revisada',expected_attempts:6})
  assert.equal((await processNotices(f.admin,config,{pace:0,limit:1})).delivered,1)
 }finally{await f.cleanup()}
})

test('Dois processadores não capturam a mesma mensagem; lease perdido exige revisão',async()=>{
 const f=await fixture()
 try{
  generate(f);keepOne(f)
  const claimed=await Promise.all([rpc(f.admin,'hub_notice_claim'),rpc(f.admin,'hub_notice_claim')]);assert.equal(claimed.filter(Boolean).length,1)
  sql(`update hub_private.notice_outbox set lease_until=clock_timestamp()-interval '1 minute' where workspace_id='${f.workspace}'`)
  assert.equal(await rpc(f.admin,'hub_notice_claim'),null);assert.equal(outbox(f)[0].state,'uncertain')
 }finally{await f.cleanup()}
})

test('Callback assinado: assinatura inválida e repetição; aceite não significa entrega',async()=>{
 const secret='whsec_'+Buffer.from(randomUUID()).toString('base64'),id=randomUUID(),stamp=String(Math.floor(Date.now()/1000)),raw=JSON.stringify({type:'email.delivered',data:{email_id:randomUUID()}})
 const {createHmac}=await import('node:crypto');const signature=createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(id+'.'+stamp+'.'+raw).digest('base64')
 const headers=new Headers({'svix-id':id,'svix-timestamp':stamp,'svix-signature':'v1,'+signature})
 assert.equal((await verifyNoticeEvent(raw,headers,secret)).outcome,'delivered')
 await assert.rejects(()=>verifyNoticeEvent(raw+' ',headers,secret));await assert.rejects(()=>verifyNoticeEvent(raw,headers,secret,Date.now()+3600000))
 const f=await fixture()
 try{
  generate(f);keepOne(f);const claim=await rpc(f.admin,'hub_notice_claim');await rpc(f.admin,'hub_notice_ack',{i:claim.id,l:claim.lease,outcome:'accepted',provider_message:id})
  assert.equal(outbox(f)[0].state,'accepted')
  await rpc(f.admin,'hub_notice_delivery',{provider_message:id,event_key:'test-'+id,outcome:'delivered'});assert.equal(outbox(f)[0].state,'delivered')
 }finally{await f.cleanup()}
})

test('Resumo às 9h, atraso sem perder aviso, preferências e mensagens de ontem suprimidas',async()=>{
 const f=await fixture()
 try{
  await rpc(f.owner.client,'hub_notice_prefs',{w:f.workspace,body:{...prefs,daily_digest:true},expected_revision:1})
  generate(f,f.today+'T11:59:00Z');assert.equal(outbox(f).length,0);assert.equal((await f.owner.client.rpc('hub_notice_summary',{w:f.workspace})).data,null)
  generate(f,f.today+'T12:01:00Z');assert.equal(outbox(f).length,1)
  const summary=await rpc(f.owner.client,'hub_notice_summary',{w:f.workspace}),restricted=await rpc(f.restricted.client,'hub_notice_summary',{w:f.workspace});assert(summary.pending>restricted.pending);assert(restricted.pending>0)
  generate(f,f.today+'T21:00:00Z');assert.equal(outbox(f).length,1)
  sql(`update hub_private.notice_outbox set digest_on=digest_on-1 where workspace_id='${f.workspace}'`)
  assert.equal((await processNotices(f.admin,config,{pace:0})).suppressed,0);assert.equal(outbox(f)[0].state,'suppressed')
  // Disabling email suppresses even already queued messages; no provider IO.
  sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}'`);generate(f,f.today+'T21:00:00Z')
  await rpc(f.owner.client,'hub_notice_prefs',{w:f.workspace,body:{...prefs,email_enabled:false},expected_revision:2})
  assert.equal((await processNotices(f.admin,config,{pace:0})).accepted,0);assert.equal(outbox(f)[0].state,'suppressed')
 }finally{await f.cleanup()}
})

test('Recorrências: dia 31, fevereiro bissexto, anual e pagamento não alteram outras competências',async()=>{
 const f=await fixture()
 try{
  const monthly=randomUUID(),annual=randomUUID()
  for(const [id,frequency] of [[monthly,1],[annual,12]])sql(`insert into public.hub_internal_obligations(workspace_id,id,title,supplier,category,owner,owner_id,amount,frequency,anchor_on,status) values('${f.workspace}','${id}','Assinatura fictícia','Exemplo','Teste','Marina','${f.owner.id}',50,${frequency},'2028-01-31','Ativa')`)
  generate(f,'2028-01-01T12:00:00Z');generate(f,'2028-01-01T12:00:00Z')
  const dates=data(`select due_on from public.hub_internal_bills where obligation_id='${monthly}' order by due_on`).map(x=>x.due_on)
  assert.deepEqual(dates.slice(0,3),['2028-01-31','2028-02-29','2028-03-31']);assert.equal(new Set(dates).size,dates.length)
  generate(f,'2029-02-01T12:00:00Z');assert(data(`select due_on from public.hub_internal_bills where obligation_id='${annual}'`).some(x=>x.due_on==='2029-01-31'))
 }finally{await f.cleanup()}
})

test('Portal fechado: pg_cron real gera e processador independente captura no Mailpit',async()=>{
 const f=await fixture(),job='hub-notice-test-'+randomUUID()
 try{
  sql(`create extension if not exists pg_cron;select cron.schedule('${job}','5 seconds',$cron$select hub_private.notice_tick()$cron$)`)
  // No Playwright, page or browser process. This is the same server worker.
  for(let turn=0;turn<15;turn++){await new Promise(r=>setTimeout(r,1000));await processNotices(f.admin,config,{pace:0,limit:5});if(outbox(f).some(x=>x.state==='delivered'))break}
  assert(outbox(f).some(x=>x.state==='delivered'))
  assert(data(`select state from hub_private.notice_runs where workspace_id='${f.workspace}'`).some(r=>r.state==='completed'))
 }finally{sql(`select cron.unschedule('${job}')`);await f.cleanup()}
})

test('Prazo alterado e assinatura pausada invalidam mensagem já enfileirada',async()=>{
 for(const action of ['reschedule','pause']){
  const f=await fixture()
  try{
   generate(f);sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}' and notice_id not in(select id from public.hub_notices where kind='bill')`);const id=keepOne(f)
   const bill=data(`select b.id,b.obligation_id,b.revision from public.hub_internal_bills b join public.hub_notices n on n.record_id=b.id join hub_private.notice_outbox o on o.notice_id=n.id where o.id='${id}'`)[0]
   if(action==='reschedule')await rpc(f.owner.client,'hub_reschedule_internal',{w:f.workspace,b:bill.id,expected_revision:bill.revision,new_due:sql(`select '${f.today}'::date+35`),reason:'Novo prazo fictício'})
   else sql(`update public.hub_internal_obligations set status='Pausada' where id='${bill.obligation_id}'`)
   let called=false;await processNotices(f.admin,config,{pace:0,limit:1,fetcher:async()=>{called=true;throw Error('Must not send')}})
   assert.equal(called,false);assert.equal(outbox(f)[0].state,'suppressed')
  }finally{await f.cleanup()}
 }
})
