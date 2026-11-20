import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql,session,literal,authenticate} from './helpers/local-db.mjs'
test('Atividade e ficha: duas sessões não invertem o bloqueio do lead e da atualização do espaço',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(45000)
 const f=await operationalFixture();let writer,finisher
 try{
  const activity=await checked(f.owner.client.from('hub_activities').select('*').eq('workspace_id',f.workspace).eq('title','Confirmar prioridade da automação').single())
  await checked(f.owner.client.from('hub_leads').update({profile:{next:activity.title,due:f.today,owner:'Equipe fictícia'}}).eq('workspace_id',f.workspace).eq('id',f.prospect))
  writer=session();writer.child.stdin.write(`begin;${authenticate(f.owner.id)}select id from public.hub_leads where workspace_id='${f.workspace}' and id='${f.prospect}' for update;\n\\echo LEAD_LOCKED\n`)
  await expect.poll(()=>writer.output(),{timeout:10000}).toContain('LEAD_LOCKED')
  const application='activity-'+randomUUID(),body={title:activity.title,owner:activity.owner,due:f.today,status:'Concluída',result:'Conclusão fictícia concorrente',followup:{title:'Próxima ação fictícia',owner:'Equipe fictícia',due:f.today}}
  finisher=session();finisher.child.stdin.end(`set application_name=${literal(application)};begin;${authenticate(f.second.id)}select public.hub_save_activity('${f.workspace}','${activity.id}',${activity.revision},'${randomUUID()}',${literal(JSON.stringify(body))}::jsonb);commit;`)
  // Both sessions overlap. The activity must wait before holding the workspace clock.
  await expect.poll(()=>sql(`select count(*) from pg_stat_activity where application_name=${literal(application)} and wait_event_type='Lock';`),{timeout:10000}).toBe('1')
  writer.child.stdin.end(`update public.hub_leads set profile=profile||'${JSON.stringify({needs:'Dados preservados da outra sessão'})}'::jsonb where workspace_id='${f.workspace}' and id='${f.prospect}';commit;`)
  const outcomes=await Promise.allSettled([writer.done,finisher.done]);for(const outcome of outcomes)if(outcome.status==='rejected')expect(outcome.reason.message).toContain('deadlock detected');expect(outcomes.map(r=>r.status)).toEqual(['fulfilled','fulfilled'])
  expect((await checked(f.owner.client.from('hub_activities').select('status').eq('id',activity.id).single())).status).toBe('Concluída')
  expect(await checked(f.owner.client.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('title','Próxima ação fictícia'))).toHaveLength(1)
  expect((await checked(f.owner.client.from('hub_leads').select('profile').eq('id',f.prospect).single())).profile).toMatchObject({next:'Próxima ação fictícia',needs:'Dados preservados da outra sessão'})
 }finally{
  for(const s of [writer,finisher])if(s&&!s.child.stdin.writableEnded)s.child.stdin.end('rollback;\n');await Promise.allSettled([writer?.done,finisher?.done]);sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';`);await f.cleanup()
 }
})
