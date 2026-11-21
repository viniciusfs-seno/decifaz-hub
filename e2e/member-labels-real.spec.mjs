import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('Nomes: duas sessões, conflito, rascunho de papéis, histórico, isolamento e falha atômica',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente dados fictícios locais.');test.setTimeout(150000)
 const f=await operationalFixture();await registryFixture(f);const contexts=[]
 try{
  async function session(user){const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),user.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Equipe',exact:true}).click();const form=page.getByRole('form',{name:'Papéis de '+f.second.email});await expect(form).toBeVisible();await form.locator('summary').filter({hasText:'Identificação no espaço'}).click();return {page,form}}
  const a=await session(f.owner),b=await session(f.second)
  await a.form.getByLabel('Financeiro',{exact:true}).check()
  await a.form.getByLabel('Nome no espaço',{exact:true}).fill('Caio · homologação')
  await b.form.getByLabel('Nome no espaço',{exact:true}).fill('Seleção desatualizada')
  await a.form.getByLabel('Nome no espaço',{exact:true}).press('Enter')
  await expect(a.form.getByRole('heading',{name:'Caio · homologação',exact:true})).toBeVisible()
  await expect(a.form.getByLabel('Financeiro',{exact:true})).toBeChecked()
  const membership=await checked(f.admin.from('hub_members').select('role,extra_roles,role_revision,active').eq('workspace_id',f.workspace).eq('user_id',f.second.id).single());expect(membership).toMatchObject({role:'admin',extra_roles:[],role_revision:0,active:true})
  await b.form.getByRole('button',{name:'Salvar nome',exact:true}).click();await expect(b.form).toContainText('Outra sessão alterou a identificação')
  await b.form.getByRole('button',{name:'Revisar nome atual',exact:true}).click();await b.form.getByLabel('Nome no espaço',{exact:true}).fill('Caio · revisão')
  await b.form.getByRole('button',{name:'Salvar nome',exact:true}).click();await expect(b.form.getByRole('heading',{name:'Caio · revisão',exact:true})).toBeVisible()
  expect((await checked(f.owner.client.rpc('hub_registry_people',{w:f.workspace}))).find(p=>p.id===f.second.id).name).toBe('Caio · revisão')
  expect((await f.restricted.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Indevido',expected_revision:2})).error?.code).toBe('42501')
  await checked(f.admin.from('hub_members').insert({workspace_id:f.other,user_id:f.second.id,role:'admin'}))
  expect((await checked(f.second.client.rpc('hub_registry_people',{w:f.other}))).find(p=>p.id===f.second.id).name).not.toBe('Caio · revisão')
  expect((await f.owner.client.rpc('hub_set_member_label',{w:f.other,u:f.second.id,n:'Indevido',expected_revision:0})).error?.code).toBe('42501')
  const events=()=>checked(f.owner.client.from('hub_registry_events').select('id,actor_id,after_record').eq('workspace_id',f.workspace).eq('kind','member'))
  expect(await events()).toHaveLength(2)
  sql(`create function public.test_label_audit_failure() returns trigger language plpgsql as $$begin if new.workspace_id='${f.workspace}' and new.kind='member' then raise exception 'Falha fictícia';end if;return new;end$$;create trigger test_label_audit_failure before insert on public.hub_registry_events for each row execute function public.test_label_audit_failure();`)
  try{expect((await f.owner.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Não persistir',expected_revision:2})).error).toBeTruthy()}finally{sql('drop trigger test_label_audit_failure on public.hub_registry_events;drop function public.test_label_audit_failure()')}
  expect((await checked(f.owner.client.rpc('hub_member_labels',{w:f.workspace}))).find(p=>p.user_id===f.second.id)).toMatchObject({display_name:'Caio · revisão',revision:2});expect(await events()).toHaveLength(2)
  const race=await Promise.all([f.owner,f.second].map((user,i)=>checked(user.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Caio · concorrente '+i,expected_revision:2}))));expect(race.map(r=>r.status).sort()).toEqual(['conflict','saved']);expect(await events()).toHaveLength(3)
  await checked(f.second.client.rpc('hub_save_project_meeting',{w:f.workspace,p:f.proposal,m:randomUUID(),expected_revision:null,operation_id:randomUUID(),follow:false,body:{date:f.today,state:'Agendada',participants:'Sócios fictícios',agenda:'Rotina de contratos',summary:'',decisions:'',owner:'Responsável em texto antigo',next:'',due:'',callUrl:''}}))
  await a.page.getByRole('navigation').getByRole('button',{name:'Rastreabilidade',exact:true}).click();await expect(a.page.locator('.timeline')).toContainText('Caio · concorrente')
  await a.page.setViewportSize({width:390,height:844});await a.page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await a.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  fs.mkdirSync('.validation/member-label-captures',{recursive:true});await a.page.screenshot({path:'.validation/member-label-captures/historico-celular.png',fullPage:true})
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:0}))
  expect((await f.second.client.rpc('hub_set_member_label',{w:f.workspace,u:f.second.id,n:'Indevido',expected_revision:3})).error?.code).toBe('42501')
  const directory=await checked(f.owner.client.rpc('hub_registry_people',{w:f.workspace}));expect(directory.find(p=>p.id===f.second.id).active).toBe(false)
 }finally{for(const c of contexts)await c.close();await f.cleanup()}
})
