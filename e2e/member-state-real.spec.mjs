import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
import {sql,session,authenticate,literal} from './helpers/local-db.mjs'

const endpoint='http://127.0.0.1:54321'
const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
async function fixture(){
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Somente banco/Auth/Edge locais fictícios')
 const settings={auth:{persistSession:false,autoRefreshToken:false}},key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings),users=[],contexts=[]
 const w=uuid(),other=uuid()
 await checked(service.from('hub_workspaces').insert([{id:w,name:'Equipe ativa fictícia'},{id:other,name:'Outro espaço ativo'}]))
 async function person(role,space=w){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(service.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id)
  if(role)await checked(service.from('hub_members').insert({workspace_id:space,user_id:user.id,role}))
  const client=createClient(endpoint,key,settings),{session}=await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,email,client,session}
 }
 const edge=async person=>{
  const r=await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+person.session.access_token,'Content-Type':'application/json'},body:'{}'})
  return {status:r.status,body:await r.json()}
 }
 const row=async(admin,person)=>(await checked(admin.client.rpc('hub_list_members',{w}))).find(m=>m.user_id===person.id)
 const change=async(admin,person,enabled,revision)=>(await checked(admin.client.rpc('hub_update_member_active',{w,u:person.id,enabled,expected_revision:revision})))
 async function open(browser,person){
  const context=await browser.newContext();contexts.push(context)
  const page=await context.newPage();page.setDefaultTimeout(15000)
  await page.addInitScript(value=>localStorage.setItem('sb-127-auth-token',JSON.stringify(value)),person.session)
  await page.goto('http://127.0.0.1:4181')
  await expect(page.getByRole('button',{name:'Sair',exact:true})).toBeVisible()
  return page
 }
 return {service,w,other,person,edge,row,change,open,cleanup:async()=>{for(const c of contexts)await c.close().catch(()=>{});for(const id of users)await service.auth.admin.deleteUser(id)}}
}

test('Estado: JWT anterior, todos os módulos/RPCs, outro espaço, convites antigos e reativação',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente pilha fictícia local.');test.setTimeout(120000)
 const f=await fixture(),{service,w,other}=f
 try{
  const owner=await f.person('admin'),target=await f.person(),common=await f.person('commercial'),foreign=await f.person('admin',other),newcomer=await f.person()
  const invite=await checked(owner.client.rpc('hub_create_invite',{w,e:target.email,r:['admin','commercial','operations','finance']}))
  expect(await checked(target.client.rpc('hub_accept_invite',{i:invite.id}))).toMatchObject({status:'accepted',outcome:'linked'})
  await checked(service.from('hub_members').insert({workspace_id:other,user_id:target.id,role:'commercial'}))
  const pending=uuid()
  await checked(service.from('hub_invites').insert({id:pending,workspace_id:w,recipient_email:target.email,roles:['finance'],created_by:owner.id}))
  const issued=await checked(target.client.rpc('hub_create_invite',{w,e:newcomer.email,r:['operations']}))
  const body={title:'Escopo fictício',scope:'Entregas',services:[],setup:50,monthly:10,terms:'Condição reservada',validity:'2026-12-01'}
  let lead,proposal
  for(const space of [w,other]){
   const l=uuid(),p=uuid();if(space===w){lead=l;proposal=p}
   await checked(service.from('hub_leads').insert({workspace_id:space,id:l,name:'Cliente fictício',stage:'Ganho'}))
   await checked(service.from('hub_triages').insert({workspace_id:space,lead_id:l,record:{},scores:[0,0,0,0,0,0,0],completed:false}))
   await checked(service.from('hub_meetings').insert({workspace_id:space,lead_id:l,meeting_on:'2026-11-01',state:'Agendada',record:{participants:'Equipe fictícia'}}))
   await checked(service.from('hub_interactions').insert({workspace_id:space,lead_id:l,author_id:owner.id,body:'Histórico fictício'}))
   await checked(service.from('hub_proposals').insert({workspace_id:space,id:p,lead_id:l,series_id:p,version:1,status:'Aceita',record:body}))
   await checked(service.from('hub_projects').insert({workspace_id:space,proposal_id:p,lead_id:l,approved:{...body,version:1}}))
   await checked(service.from('hub_activities').insert({workspace_id:space,lead_id:l,title:'Tarefa fictícia'}))
   const charge={workspace_id:space,proposal_id:p,kind:'Mensalidade',period:'2026-11-01'}
   await checked(service.from('hub_receivables').insert({...charge,amount:10,due_on:'2026-11-01'}))
   await checked(service.from('hub_receipts').insert({...charge,id:uuid(),amount:5,received_on:'2026-11-01'}))
   await checked(service.from('hub_expenses').insert({workspace_id:space,id:uuid(),title:'Despesa fictícia',amount:5,due_on:'2026-11-01'}))
  }
  const tables=['hub_leads','hub_triages','hub_meetings','hub_interactions','hub_activities','hub_proposals_visible','hub_projects_visible','hub_receivables','hub_receipts','hub_expenses','hub_finance_audit','hub_role_audit']
  for(const table of tables)expect((await checked(target.client.from(table).select('*').eq('workspace_id',w))).length,table+' active').toBeGreaterThan(0)
  for(const actor of [common,foreign])expect((await actor.client.rpc('hub_update_member_active',{w,u:target.id,enabled:false,expected_revision:0})).error?.code).toBe('42501')
  const roles=(await f.row(owner,target)).roles,token=target.session.access_token
  expect(await f.change(owner,target,false,0)).toMatchObject({status:'saved',active:false,revision:'1',roles})
  for(const table of tables)expect(await checked(target.client.from(table).select('*').eq('workspace_id',w)),table+' inactive').toEqual([])
  expect(await checked(target.client.from('hub_members').select('*').eq('workspace_id',w))).toEqual([])
  expect((await checked(target.client.from('hub_workspaces').select('id'))).map(x=>x.id)).toEqual([other])
  expect(await checked(target.client.from('hub_leads').select('id').eq('workspace_id',other))).toHaveLength(1)
  expect((await f.edge(target)).body.workspaces.map(x=>x.id)).toEqual([other])
  for(const module of ['commercial','projects','finance','admin'])for(const writing of [false,true])expect(await checked(target.client.rpc('hub_can',{w,module,writing}))).toBe(false)
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
  const charge={w,p:proposal,k:'Mensalidade',m:'2026-11-01',i:uuid()}
  const calls=[
   ['hub_dashboard',{p_workspace:w,p_today:today}],
   ['hub_save_triage',{p_workspace:w,p_lead:lead,p_record:{},p_scores:[0,0,0,0,0,0,0],p_completed:false,p_profile:{},p_name:'Intrusão',p_segment:'',p_city:'',p_qualify:false}],
   ['hub_save_meeting',{p_workspace:w,p_lead:lead,p_id:uuid(),p_date:today,p_state:'Agendada',p_record:{participants:'Equipe fictícia'},p_follow_due:null,p_advance:false}],
   ['hub_save_proposal',{w,l:lead,p:proposal,s:proposal,v:1,m:null,body,decision:null,occurred:null,evidence:null}],
   ['hub_open_project',{w,p:proposal}],['hub_open_support',{w,p:proposal,t:'Intrusão',o:'Fictício',d:today}],
   ['hub_accept_delivery',{w,p:proposal,c:['tests','scope','pending'],d:today,e:'Intrusão',t:'',o:'',due:null}],
   ['hub_forecast',{w,p:proposal,k:'Mensalidade',d:today}],['hub_receive',{...charge,d:today,a:2}],['hub_reverse_receipt',{...charge,reason:'Intrusão'}],
   ['hub_set_roles',{w,u:owner.id,r:['commercial']}],['hub_set_role',{w,u:owner.id,r:'commercial'}]
  ]
  for(const [name,args] of calls)expect(Boolean(await checked(target.client.rpc(name,args))),name).toBe(false)
  for(const [name,args] of [['hub_list_members',{w}],['hub_list_invites',{w}],['hub_create_invite',{w,e:newcomer.email,r:['admin']}],['hub_revoke_invite',{i:pending}],['hub_update_member_roles',{w,u:owner.id,r:['commercial'],expected_revision:0}],['hub_update_member_active',{w,u:target.id,enabled:true,expected_revision:1}]]){
   expect((await target.client.rpc(name,args)).error?.code,name).toBe('42501')
  }
  expect((await target.client.from('hub_members').update({active:true}).eq('workspace_id',w)).error?.code).toBe('42501')
  expect((await target.client.from('hub_leads').insert({workspace_id:w,name:'Intrusão'})).error?.code).toBe('42501')
  expect(await checked(target.client.from('hub_leads').update({name:'Intrusão'}).eq('workspace_id',w).select('id'))).toEqual([])
  for(const id of [invite.id,pending])expect(await checked(target.client.rpc('hub_accept_invite',{i:id}))).toMatchObject({status:'inactive_member'})
  expect(await checked(service.from('hub_invites').select('status,accepted_by').eq('id',pending).single())).toEqual({status:'pending',accepted_by:null})
  expect(await checked(newcomer.client.rpc('hub_accept_invite',{i:issued.id}))).toMatchObject({status:'issuer_unavailable'})
  expect(await checked(owner.client.rpc('hub_set_roles',{w,u:target.id,r:roles}))).toBe(true)
  expect(await f.row(owner,target)).toMatchObject({active:false,roles,revision:'1'})
  expect((await checked(service.auth.admin.getUserById(target.id))).user.email).toBe(target.email)
  expect(await f.change(owner,target,true,1)).toMatchObject({status:'saved',active:true,roles,revision:'2'})
  expect(target.session.access_token).toBe(token)
  expect((await f.edge(target)).body.workspaces).toHaveLength(2)
  for(const table of tables)expect((await checked(target.client.from(table).select('*').eq('workspace_id',w))).length,table+' restored').toBeGreaterThan(0)
  const events=await checked(owner.client.from('hub_role_audit').select('*').eq('workspace_id',w).eq('member_id',target.id).in('operation',['deactivated','reactivated']).order('after_revision'))
  expect(events.map(e=>({actor:e.actor_id,before:e.before_active,after:e.after_active,old:e.before_roles,new:e.after_roles,revision:e.after_revision}))).toEqual([
   {actor:owner.id,before:true,after:false,old:roles,new:roles,revision:1},{actor:owner.id,before:false,after:true,old:roles,new:roles,revision:2}
  ])
  expect(await checked(owner.client.from('hub_role_audit').select('id').eq('workspace_id',w).eq('member_id',target.id))).toHaveLength(3)
 }finally{await f.cleanup()}
})

test('Estado: duas sessões serializam papéis/estado e preservam último administrador ativo',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente PostgreSQL local.');test.setTimeout(90000)
 const f=await fixture(),sessions=[]
 try{
  const a=await f.person('admin'),b=await f.person('admin'),member=await f.person('commercial'),{w}=f
  async function overlap(firstActor,firstSql,secondActor,secondSql){
   const first=session(),second=session();sessions.push(first,second)
   first.child.stdin.write(`begin;${authenticate(firstActor)}${firstSql}\n\\echo STAGED\n`)
   await expect.poll(()=>first.output(),{timeout:15000}).toContain('STAGED')
   const application='state-'+uuid()
   second.child.stdin.end(`set application_name=${literal(application)};begin;${authenticate(secondActor)}${secondSql}commit;`)
   await expect.poll(()=>sql(`select count(*) from pg_stat_activity where application_name=${literal(application)} and wait_event_type='Lock';`),{timeout:15000}).toBe('1')
   first.child.stdin.end('commit;\n');await first.done;return await second.done
  }
  const state=(id,enabled,revision)=>`select public.hub_update_member_active('${w}','${id}',${enabled},${revision});`
  const roles=(id,r,revision)=>`select public.hub_update_member_roles('${w}','${id}',array['${r}'],${revision});`
  expect(await overlap(a.id,roles(member.id,'finance',0),b.id,state(member.id,false,0))).toContain('"status": "conflict"')
  expect(await f.row(a,member)).toMatchObject({roles:['finance'],active:true,revision:'1'})
  expect(await overlap(a.id,state(member.id,false,1),b.id,roles(member.id,'operations',1))).toContain('"status": "conflict"')
  expect(await f.row(a,member)).toMatchObject({roles:['finance'],active:false,revision:'2'})
  expect((await checked(a.client.from('hub_role_audit').select('after_revision').eq('workspace_id',w).eq('member_id',member.id).order('after_revision'))).map(e=>e.after_revision)).toEqual([0,1,2])
  expect(await overlap(a.id,roles(a.id,'commercial',0),b.id,state(b.id,false,0))).toContain('"status": "rejected"')
  expect(await checked(b.client.rpc('hub_set_roles',{w,u:a.id,r:['admin']}))).toBe(true)
  expect(await overlap(a.id,state(a.id,false,2),b.id,`select public.hub_set_role('${w}','${b.id}','commercial');`)).toMatch(/\bf\b/)
  expect(await f.row(b,a)).toMatchObject({active:false,roles:['admin']})
  expect(await f.row(b,b)).toMatchObject({active:true,roles:['admin'],revision:'0'})
  const events=await checked(b.client.from('hub_role_audit').select('operation').eq('workspace_id',w).eq('member_id',b.id))
  expect(events.map(e=>e.operation)).toEqual(['created'])
 }finally{
  for(const s of sessions)if(!s.child.stdin.writableEnded)s.child.stdin.end('rollback;\n')
  await Promise.allSettled(sessions.map(s=>s.done));await f.cleanup()
 }
})

test('Estado: confirmação, cancelamento, conflito entre telas e sessão aberta perde/recupera acesso',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente browser/Auth locais.');test.setTimeout(120000)
 const f=await fixture()
 try{
  const a=await f.person('admin'),b=await f.person('admin'),member=await f.person('commercial')
  const pa=await f.open(browser,a),pb=await f.open(browser,b),pm=await f.open(browser,member)
  for(const p of [pa,pb])await p.getByRole('button',{name:'Equipe',exact:true}).click()
  const fa=pa.getByRole('form',{name:'Papéis de '+member.email}),fb=pb.getByRole('form',{name:'Papéis de '+member.email})
  await expect(fa.getByText('Ativo',{exact:true})).toBeVisible()
  await fa.getByRole('button',{name:'Desativar integrante',exact:true}).click()
  await pa.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click()
  expect(await f.row(a,member)).toMatchObject({active:true,revision:'0'})
  await fa.getByRole('button',{name:'Desativar integrante',exact:true}).click()
  await pa.getByRole('dialog').getByRole('button',{name:'Confirmar desativação',exact:true}).click()
  await expect(fa.getByText('Desativado',{exact:true})).toBeVisible()
  await pm.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(pm.getByRole('heading',{name:'Meus convites',exact:true})).toBeVisible()
  await expect(pm.getByRole('button',{name:'Captação e CRM',exact:true})).toHaveCount(0)
  await expect(pm.getByRole('button',{name:'Sair',exact:true})).toBeVisible()
  await fb.getByRole('checkbox',{name:'Financeiro',exact:true}).check()
  await fb.getByRole('button',{name:'Salvar papéis',exact:true}).click()
  await expect(fb.getByRole('alert')).toContainText('Outro administrador alterou')
  await expect(fb.getByText('Estado atual: Desativado.',{exact:true})).toBeVisible()
  await expect(fb.getByRole('button',{name:'Salvar papéis',exact:true})).toBeDisabled()
  await fb.getByRole('button',{name:'Revisar a partir dos papéis atuais',exact:true}).click()
  await fb.getByRole('button',{name:'Reativar integrante',exact:true}).click()
  await pb.getByRole('dialog').getByRole('button',{name:'Confirmar reativação',exact:true}).click()
  await expect(fb.getByText('Ativo',{exact:true})).toBeVisible()
  await pm.evaluate(()=>window.dispatchEvent(new Event('focus')))
  await expect(pm.getByRole('button',{name:'Captação e CRM',exact:true})).toBeVisible()
  expect(await f.row(a,member)).toMatchObject({active:true,roles:['commercial'],revision:'2'})
  const own=pa.getByRole('form',{name:'Papéis de '+a.email})
  await own.getByRole('button',{name:'Desativar integrante',exact:true}).click()
  await pa.getByRole('dialog').getByRole('button',{name:'Confirmar desativação',exact:true}).click()
  await expect(pa.getByRole('heading',{name:'Meus convites',exact:true})).toBeVisible()
  await expect(pa.getByRole('button',{name:'Equipe',exact:true})).toHaveCount(0)
  expect((await f.edge(a)).status).toBe(403)
  await pb.getByRole('button',{name:'Atualizar equipe',exact:true}).click()
  await expect(pb.getByRole('form',{name:'Papéis de '+a.email}).getByText('Desativado',{exact:true})).toBeVisible()
  await pb.setViewportSize({width:390,height:844})
  await expect.poll(()=>pb.locator('.sidebar').evaluate(n=>n.getBoundingClientRect().right)).toBeLessThan(1)
  await pb.evaluate(()=>window.scrollTo(0,0))
  expect(await pb.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await pb.screenshot({path:test.info().outputPath('equipe-estados-mobile.png'),fullPage:true})
 }finally{await f.cleanup()}
})
