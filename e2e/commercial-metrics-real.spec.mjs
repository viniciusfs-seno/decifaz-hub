import {test,expect} from '@playwright/test'
import fs from 'node:fs'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local')
const report=(f,extra={})=>checked(f.restricted.client.rpc('hub_commercial_metrics',{w:f.workspace,from_on:f.today,to_on:f.today,...extra}))
test('Métricas: eventos comprovados, 1.025 resultados, CSV completo, ausência distinta de zero e acesso',async()=>{
 const f=await operationalFixture();try{
  sql(`insert into hub_interactions(workspace_id,lead_id,author_id,body,kind,occurred_on,result_code) select '${f.workspace}','${f.prospect}','${f.owner.id}','Evento fictício','other','${f.today}','advanced' from generate_series(1,1025);insert into hub_interactions(workspace_id,lead_id,author_id,body) values('${f.workspace}','${f.prospect}','${f.owner.id}','Legado sem data comprovada');`)
  let r=await report(f);expect(r.total).toBe(1025);expect(r.rows).toHaveLength(25);expect(r.results.advanced).toBe(1025);expect(r.approach_observed).toBe(1);expect(r.approach_cohort).toBe(3);expect(r.approach_days).toBe(0);expect(r.response_days).toBeNull();expect(r.legacy_uncovered).toBe(1);expect(r.coverage_since).toBeTruthy();expect((await report(f,{skip:1025})).rows).toHaveLength(0)
  const csv=await checked(f.restricted.client.rpc('hub_commercial_metrics_csv',{w:f.workspace,from_on:f.today,to_on:f.today}));expect(csv.split('\r\n').filter(l=>l.startsWith('"result";'))).toHaveLength(1025);expect(csv).not.toMatch(/2400|Condição fictícia reservada|amount|terms|setup/)
  r=await report(f,{owner_filter:'Marina · fictícia'});expect(r.total).toBe(0);expect(r.approach_days).toBeNull();expect(r.approach_cohort).toBe(2)
  const a=await report(f,{skip:0}),b=await report(f,{skip:25});expect(new Set([...a.rows,...b.rows].map(x=>x.id)).size).toBe(50)
  expect((await f.restricted.client.rpc('hub_commercial_metrics',{w:f.other,from_on:f.today,to_on:f.today})).data.total).toBe(0)
  expect((await f.owner.client.rpc('hub_commercial_metrics',{w:f.other,from_on:f.today,to_on:f.today})).error?.code).toBe('42501')
  await checked(f.admin.from('hub_members').update({active:false}).eq('workspace_id',f.workspace).eq('user_id',f.restricted.id));expect((await f.restricted.client.rpc('hub_commercial_metrics',{w:f.workspace,from_on:f.today,to_on:f.today})).error?.code).toBe('42501')
 }finally{await f.cleanup()}
})
test('Indicadores: mesma seleção no CSV, origem, celular e tema escuro',async({page})=>{
 const f=await operationalFixture();try{
  const lead=await checked(f.owner.client.from('hub_leads').select('revision').eq('id',f.prospect).single());await checked(f.owner.client.rpc('hub_record_commercial_interaction',{w:f.workspace,l:f.prospect,expected_revision:lead.revision,operation_id:randomUUID(),body:{kind:'other',occurred_on:f.today,summary:'Abordagem fictícia comprovada',outcome:'advanced'}}))
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.restricted.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Indicadores',exact:true}).click();const section=page.getByRole('region',{name:'Acompanhamento comercial verificável'});await expect(section).toContainText('1 observados / 3 cadastros');await expect(section).toContainText('Abordagem realizada / avançar: 1');const download=page.waitForEvent('download');await section.getByRole('button',{name:'Exportar acompanhamentos CSV',exact:true}).click();expect((await download).suggestedFilename()).toBe('decifaz-acompanhamentos.csv');await section.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click();await expect(page.getByRole('heading',{name:'Ficha do estabelecimento',exact:true})).toBeVisible();await page.getByRole('button',{name:/Voltar/}).first().click();
  fs.mkdirSync('.validation/commercial-routine',{recursive:true});await section.evaluate(el=>{el.scrollIntoView({block:'start'});scrollBy(0,-150)});await page.screenshot({path:'.validation/commercial-routine/indicadores-1440-light.png'});await page.setViewportSize({width:390,height:900});await page.evaluate(()=>document.documentElement.dataset.theme='dark');await expect(section.locator('.commercial-summary')).toHaveCSS('grid-template-columns',/^[\d.]+px$/);await section.evaluate(el=>{el.scrollIntoView({block:'start'});scrollBy(0,-170)});await page.screenshot({path:'.validation/commercial-routine/indicadores-390-dark.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 }finally{await f.cleanup()}
})

test('Resultado de reunião não duplica após corrigir a ata; eventos anteriores ao cadastro não viram SLA',async()=>{
 const f=await operationalFixture();try{
  await checked(f.admin.from('hub_meetings').update({state:'Realizada'}).eq('id',f.meeting));const meeting=await checked(f.owner.client.from('hub_meetings').select('*').eq('id',f.meeting).single()),lead=await checked(f.owner.client.from('hub_leads').select('*').eq('id',f.meetingLead).single())
  await checked(f.owner.client.rpc('hub_record_commercial_interaction',{w:f.workspace,l:lead.id,expected_revision:lead.revision,operation_id:randomUUID(),body:{kind:'meeting',meeting_id:f.meeting,meeting_revision:meeting.revision,occurred_on:f.today,summary:'Resultado fictício',outcome:'waiting'}}));await checked(f.owner.client.from('hub_meetings').update({record:{...meeting.record,summary:'Ata corrigida sem novo resultado'}}).eq('id',f.meeting));let r=await report(f);expect(r.results.waiting).toBe(1);expect(r.total).toBe(1)
  sql(`insert into hub_interactions(workspace_id,lead_id,author_id,body,kind,occurred_on,result_code) values('${f.workspace}','${f.prospect}','${f.owner.id}','Data legada fictícia','other','${f.today}'::date-1,'advanced')`);r=await report(f);expect(r.approach_excluded).toBe(1);expect(r.approach_observed).toBe(0);expect(r.approach_days).toBeNull()
 }finally{await f.cleanup()}
})

test('Jornada integrada: legado, confirmação, interação, atividade, aviso, conclusão e indicadores em outra sessão',async()=>{
 const f=await operationalFixture();try{
  const lead=await checked(f.restricted.client.from('hub_leads').select('*').eq('id',f.prospect).single()),regular=await checked(f.restricted.client.rpc('hub_regularize_lead',{w:f.workspace,l:f.prospect,expected_revision:lead.revision,operation_id:randomUUID(),field:'owner',confirmed:true,body:{name:lead.name,profile:{owner_id:f.owner.id}}}));expect(regular.current.profile.owner_legacy).toBe('Caio · fictício')
  const saved=await checked(f.owner.client.rpc('hub_record_commercial_interaction',{w:f.workspace,l:f.prospect,expected_revision:regular.current.revision,operation_id:randomUUID(),body:{kind:'phone',occurred_on:f.today,summary:'Abordagem fictícia da jornada',outcome:'advanced',plan:{next_action_id:'followup',next:'Retorno da jornada fictícia',owner_id:f.owner.id,due:f.today}}}));const task=await checked(f.restricted.client.from('hub_activities').select('*').eq('id',saved.activity_id).single());expect(task.title).toBe('Retorno da jornada fictícia')
  sql(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z')`);let notices=await checked(f.restricted.client.rpc('hub_list_notices',{w:f.workspace}));expect(notices.filter(n=>n.record_id===task.id&&!n.effective_resolved_at)).toHaveLength(1)
  await checked(f.owner.client.rpc('hub_save_activity',{w:f.workspace,a:task.id,expected_revision:task.revision,operation_id:randomUUID(),body:{title:task.title,owner:task.owner,assigned_user_id:task.assigned_user_id,due:task.due_on,status:'Concluída',result:'Resultado fictício',followup:{title:'Próximo retorno da jornada fictícia',owner:task.owner,assigned_user_id:f.owner.id,due:f.today}}}));notices=await checked(f.restricted.client.rpc('hub_list_notices',{w:f.workspace}));expect(notices.find(n=>n.record_id===task.id).effective_resolved_at).toBeTruthy();expect((await report(f)).results.advanced).toBe(1);expect((await report(f)).approach_observed).toBe(1)
  sql(`select hub_private.generate_notices('${f.workspace}','${f.today}T12:00:00Z')`);expect((await checked(f.restricted.client.rpc('hub_list_notices',{w:f.workspace}))).filter(n=>n.title==='Próximo retorno da jornada fictícia'&&!n.effective_resolved_at)).toHaveLength(1)
 }finally{await f.cleanup()}
})
