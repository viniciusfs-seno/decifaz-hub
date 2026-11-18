import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('Atividades: conclusão/follow-up atômicos, duas sessões, revisão, isolamento e desativação',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(120000)
 const f=await operationalFixture(),second=await browser.newContext()
 try{
  const initial={w:f.workspace,a:null,expected_revision:null,operation_id:randomUUID(),body:{lead_id:f.prospect,title:'Contato de rotina fictício',owner:'Equipe fictícia',assigned_user_id:f.owner.id,due:f.today,status:'Pendente',result:''}}
  const created=await checked(f.owner.client.rpc('hub_save_activity',initial));expect(created.status).toBe('saved')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  const other=await second.newPage();await other.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.second.session);await other.goto('/')
  for(const p of [page,other])await p.getByRole('navigation').getByRole('button',{name:'Agenda operacional',exact:true}).click()
  await page.getByRole('button',{name:'Minhas atividades',exact:true}).click()
  await expect(page.getByRole('button',{name:'Contato de rotina fictício',exact:true})).toBeVisible()
  await other.getByRole('button',{name:'Minhas atividades',exact:true}).click();await expect(other.getByRole('button',{name:'Contato de rotina fictício',exact:true})).toHaveCount(0)
  await other.getByRole('button',{name:'Agenda do espaço',exact:true}).click()
  await page.getByRole('article').filter({hasText:'Contato de rotina fictício'}).getByRole('button',{name:'Editar acompanhamento',exact:true}).click()
  const dialog=page.getByRole('dialog');await dialog.getByRole('combobox',{name:/Situação da atividade/}).selectOption('Concluída')
  await dialog.getByLabel('Resultado da atividade',{exact:true}).fill('Conversa fictícia registrada; retorno combinado.')
  await dialog.getByLabel('Criar próximo acompanhamento nesta conclusão').check()
  await dialog.getByLabel(/^Título do próximo acompanhamento/).fill('Retorno fictício confirmado')
  await dialog.getByLabel(/^Responsável do próximo acompanhamento/).fill('Equipe fictícia')
  await dialog.getByRole('button',{name:'Salvar acompanhamento',exact:true}).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Retorno fictício confirmado',exact:true})).toBeVisible()
  await expect(other.getByRole('button',{name:'Retorno fictício confirmado',exact:true})).toBeVisible({timeout:25000})
  const saved=await checked(f.admin.from('hub_activities').select('*').eq('workspace_id',f.workspace).eq('id',created.current.id).single());expect(saved.status).toBe('Concluída');expect(saved.completed_at).toBeTruthy()
  const follow=await checked(f.admin.from('hub_activities').select('*').eq('workspace_id',f.workspace).eq('title','Retorno fictício confirmado').single());expect(follow.lead_id).toBe(f.prospect)
  const body={...initial.body,title:follow.title,status:'Concluída',result:'Resultado de repetição fictício',followup:{title:'Último retorno fictício',owner:'Equipe fictícia',assigned_user_id:f.owner.id,due:f.today}}
  const args={w:f.workspace,a:follow.id,expected_revision:follow.revision,operation_id:randomUUID(),body}
  const [a,b]=await Promise.all([checked(f.owner.client.rpc('hub_save_activity',args)),checked(f.owner.client.rpc('hub_save_activity',args))]);expect(a).toEqual(b)
  expect((await checked(f.admin.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('title','Último retorno fictício')))).toHaveLength(1)
  expect((await checked(f.second.client.rpc('hub_save_activity',{...args,operation_id:randomUUID()}))).status).toBe('conflict')
  expect((await f.owner.client.rpc('hub_save_activity',{...args,w:f.other})).error?.code).toBe('42501')
  expect((await f.restricted.client.from('hub_activity_audit').insert({workspace_id:f.workspace,activity_id:follow.id,after_record:{}})).error?.code).toBe('42501')
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.restricted.id,expected_revision:0,enabled:false}))
  expect((await f.restricted.client.rpc('hub_save_activity',initial)).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_workspace_version',{w:f.workspace})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_workspace_version',{w:f.other})).error?.code).toBe('42501')
 }finally{await second.close();sql(`delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
test('Atividades: falha no acompanhamento reverte conclusão, auditoria e recibo; papéis por módulo',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.')
 const f=await operationalFixture(),suffix=randomUUID().replaceAll('-',''),fn='fail_follow_'+suffix
 try{
  const initial={w:f.workspace,a:null,expected_revision:null,operation_id:randomUUID(),body:{lead_id:f.prospect,title:'Conclusão atômica fictícia',owner:'Equipe fictícia',due:f.today,status:'Pendente',result:''}}
  const created=await checked(f.owner.client.rpc('hub_save_activity',initial))
  sql(`create function hub_private.${fn}() returns trigger language plpgsql as $$ begin if new.workspace_id='${f.workspace}' and new.after_record->>'title'='Falha fictícia controlada' then raise exception 'Falha de auditoria fictícia';end if;return new;end $$;create trigger ${fn} before insert on public.hub_activity_audit for each row execute function hub_private.${fn}();`)
  const args={...initial,a:created.current.id,expected_revision:created.current.revision,operation_id:randomUUID(),body:{...initial.body,status:'Concluída',result:'Resultado fictício',followup:{title:'Falha fictícia controlada',owner:'Equipe fictícia',due:f.today}}}
  const version=await checked(f.owner.client.rpc('hub_workspace_version',{w:f.workspace}))
  expect((await f.owner.client.rpc('hub_save_activity',args)).error).toBeTruthy()
  expect(await checked(f.owner.client.rpc('hub_workspace_version',{w:f.workspace}))).toBe(version)
  const actual=await checked(f.admin.from('hub_activities').select('status,revision').eq('workspace_id',f.workspace).eq('id',created.current.id).single());expect(actual).toEqual({status:'Pendente',revision:0})
  expect((await checked(f.admin.from('hub_activity_audit').select('id').eq('workspace_id',f.workspace).eq('activity_id',created.current.id)))).toHaveLength(1)
  sql(`drop trigger ${fn} on public.hub_activity_audit;drop function hub_private.${fn}();`)
  const retried=await checked(f.owner.client.rpc('hub_save_activity',args));expect(retried.status).toBe('saved')
  expect((await checked(f.owner.client.rpc('hub_save_activity',args))).followup_id).toBe(retried.followup_id)
  const project={...initial,operation_id:randomUUID(),body:{...initial.body,lead_id:f.lead,project_id:f.proposal,title:'Operação fictícia'}}
  expect((await f.restricted.client.rpc('hub_save_activity',project)).error?.code).toBe('42501')
  await checked(f.owner.client.rpc('hub_set_roles',{w:f.workspace,u:f.restricted.id,r:['operations']}))
  expect((await checked(f.restricted.client.rpc('hub_save_activity',project))).status).toBe('saved')
  expect((await f.restricted.client.rpc('hub_save_activity',{...initial,operation_id:randomUUID()})).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_plan_contact',{w:f.workspace,l:f.prospect,expected_revision:0,operation_id:randomUUID(),body:{result:'Recusa fictícia'}})).error?.code).toBe('42501')
  expect((await f.restricted.client.rpc('hub_import_lead',{w:f.workspace,operation_id:randomUUID(),body:{name:'Recusa fictícia'},initial_stage:'Identificado'})).error?.code).toBe('42501')
 }finally{
  sql(`drop trigger if exists ${fn} on public.hub_activity_audit;drop function if exists hub_private.${fn}();delete from public.hub_activity_audit where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()
 }
})
