import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test('Histórico: fonte datada, eventos atômicos, filtros/CSV e valores restritos',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture()
 try{
  const activity=(await checked(f.owner.client.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('title','Enviar diagnóstico revisado').single())).id
  await checked(f.owner.client.from('hub_activities').update({status:'Concluída'}).eq('workspace_id',f.workspace).eq('id',activity))
  await checked(f.owner.client.from('hub_activities').update({status:'Concluída'}).eq('workspace_id',f.workspace).eq('id',activity))
  const params={w:f.workspace,from_on:f.today.slice(0,7)+'-01',to_on:f.today,owner_filter:'',stage_filter:''}
  const admin=await checked(f.owner.client.rpc('hub_metric_history',params)),commercial=await checked(f.restricted.client.rpc('hub_metric_history',params))
  expect(admin.rows[0].atividades_concluidas).toBe(1);expect(admin.rows[0].receita_realizada).toBe(800);expect(admin.rows[0].receita_prevista).toBe(2400)
  expect(admin.rows[0].entradas_ganho).toBe(0) // Seed in Ganho is not a fabricated transition.
  expect(commercial.financial).toBe(false);expect(JSON.stringify(commercial)).not.toContain('receita_');expect(JSON.stringify(commercial)).not.toContain('2400')
  expect((await f.owner.client.rpc('hub_metric_history',{...params,w:f.other})).error?.code).toBe('42501')
  expect((await f.owner.client.from('hub_activity_events').update({after_status:'Pendente'}).eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  expect((await f.owner.client.from('hub_activity_events').delete().eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  expect((await checked(f.owner.client.rpc('hub_metric_history',{...params,owner_filter:'Marina · fictícia'}))).rows[0].atividades_concluidas).toBe(0)
  // UTC midnight belongs to the previous business day in Fortaleza.
  sql(`update public.hub_activity_events set occurred_at='2026-12-01T01:00:00Z' where workspace_id='${f.workspace}' and after_status='Concluída';`)
  const nov=await checked(f.owner.client.rpc('hub_metric_history',{...params,from_on:'2026-11-30',to_on:'2026-12-01'}))
  expect(nov.rows[0].atividades_concluidas).toBe(1);expect(nov.rows[1].atividades_concluidas).toBe(0)
  sql(`create function hub_private.fail_metric_event_test() returns trigger language plpgsql as $$begin raise exception 'falha fictícia';end$$;create trigger fail_metric_event_test before insert on public.hub_activity_events for each row when (new.workspace_id='${f.workspace}'::uuid) execute function hub_private.fail_metric_event_test();`)
  try{expect((await f.owner.client.from('hub_activities').update({status:'Pendente'}).eq('workspace_id',f.workspace).eq('id',activity)).error).toBeTruthy()}finally{sql('drop trigger fail_metric_event_test on public.hub_activity_events;drop function hub_private.fail_metric_event_test();')}
  expect((await checked(f.owner.client.from('hub_activities').select('status').eq('workspace_id',f.workspace).eq('id',activity).single())).status).toBe('Concluída')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.restricted.session);await page.goto('/')
  await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Indicadores',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Histórico verificável por mês'})).toBeVisible()
  await expect(page.getByRole('region',{name:'Histórico mensal, tabela com rolagem'})).not.toContainText('Receita')
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar histórico CSV',exact:true}).click();let csv='';for await(const c of await(await download).createReadStream())csv+=c.toString()
  expect(csv).toContain('Conclusões de atividades');expect(csv).not.toContain('Receita');expect(csv).not.toContain('2400')
  const member=(await checked(f.owner.client.rpc('hub_list_members',{w:f.workspace}))).find(m=>m.user_id===f.restricted.id)
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,enabled:false,expected_revision:member.revision}))
  expect((await f.restricted.client.rpc('hub_metric_history',params)).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_crm_page',{w:f.workspace})).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_crm_export',{w:f.workspace})).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:0,body:{name:'Negado'}})).error?.code).toBe('42501')
 }finally{await f.cleanup()}
})
