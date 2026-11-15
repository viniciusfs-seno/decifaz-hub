import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'

test('matriz real: tabelas, RPCs, Edge, JSON financeiro, membros legados e isolamento',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local.')
 test.setTimeout(120000)
 const endpoint='http://127.0.0.1:54321'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Somente Supabase local')
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const admin=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,options)
 const key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const checked=async op=>{const {data,error}=await op;if(error)throw error;return data}
 const w=uuid(),other=uuid(),l=uuid(),p=uuid(),users=[]
 const body={title:'Projeto por papel',scope:'Escopo fictício',services:[],validity:'2026-12-01',setup:150,monthly:25,terms:'Condição financeira reservada',events:[]}
 await checked(admin.from('hub_workspaces').insert([{id:w,name:'Papéis fictícios'},{id:other,name:'Outro espaço'}]))
 try{
  for(const role of ['admin','commercial','operations','finance','outsider']){
   const email=uuid()+'@example.invalid',password=uuid()
   const {user}=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}))
   users.push(user.id)
   if(role!=='outsider')await checked(admin.from('hub_members').insert({workspace_id:w,user_id:user.id,role}))
   const client=createClient(endpoint,key,options)
   const {session}=await checked(client.auth.signInWithPassword({email,password}))
   users[users.length-1]={id:user.id,role,client,session}
  }
  await checked(admin.from('hub_leads').insert({workspace_id:w,id:l,name:'Conta fictícia',stage:'Ganho'}))
  await checked(admin.from('hub_proposals').insert({workspace_id:w,id:p,lead_id:l,series_id:p,version:1,status:'Aceita',record:body}))
  await checked(admin.from('hub_projects').insert({workspace_id:w,proposal_id:p,lead_id:l,approved:{...body,version:1},deliverables:'Entrega'}))
  await checked(admin.from('hub_expenses').insert({workspace_id:w,id:uuid(),title:'Despesa fictícia',due_on:'2026-11-01',amount:10}))
  await checked(admin.from('hub_triages').insert({workspace_id:w,lead_id:l,record:{},scores:[null,null,null,null,null,null,null],completed:false}))
  const meeting=uuid()
  await checked(admin.from('hub_meetings').insert({workspace_id:w,lead_id:l,id:meeting,meeting_on:'2026-11-01',state:'Agendada',record:{participants:'Equipe fictícia'}}))
  // Populate every protected table in a second space so isolation cannot pass
  // merely because the target space has no records.
  const foreignLead=uuid(),foreignProposal=uuid()
  await checked(admin.from('hub_leads').insert({workspace_id:other,id:foreignLead,name:'Outro cliente'}))
  await checked(admin.from('hub_triages').insert({workspace_id:other,lead_id:foreignLead,record:{},scores:[null,null,null,null,null,null,null],completed:false}))
  await checked(admin.from('hub_meetings').insert({workspace_id:other,lead_id:foreignLead,meeting_on:'2026-11-01',state:'Agendada',record:{participants:'Outro time'}}))
  await checked(admin.from('hub_interactions').insert({workspace_id:other,lead_id:foreignLead,author_id:users[0].id,body:'Histórico externo'}))
  await checked(admin.from('hub_proposals').insert({workspace_id:other,id:foreignProposal,lead_id:foreignLead,series_id:foreignProposal,version:1,status:'Aceita',record:body}))
  await checked(admin.from('hub_projects').insert({workspace_id:other,proposal_id:foreignProposal,lead_id:foreignLead,approved:{...body,version:1},deliverables:'Outra entrega'}))
  await checked(admin.from('hub_activities').insert({workspace_id:other,lead_id:foreignLead,title:'Atividade externa',project_proposal_id:foreignProposal}))
  const foreignCharge={workspace_id:other,proposal_id:foreignProposal,kind:'Mensalidade',period:'2026-11-01'}
  await checked(admin.from('hub_receivables').insert({...foreignCharge,due_on:'2026-11-15',amount:25}))
  await checked(admin.from('hub_receipts').insert({...foreignCharge,id:uuid(),received_on:'2026-11-01',amount:5}))
  await checked(admin.from('hub_expenses').insert({workspace_id:other,id:uuid(),title:'Despesa externa',due_on:'2026-11-01',amount:10}))
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
  const outsiderId=users.find(user=>user.role==='outsider').id
  expect((await admin.from('hub_members').insert({workspace_id:w,user_id:outsiderId})).error?.code).toBe('23502')
  expect((await admin.from('hub_members').insert({workspace_id:w,user_id:outsiderId,role:null})).error?.code).toBe('23502')
  for(const {role,client,session,id} of users){
   const member=role!=='outsider',finance=['admin','finance'].includes(role),commercial=['admin','commercial'].includes(role),operations=['admin','operations'].includes(role)
   expect((await checked(client.from('hub_members').select('role').eq('workspace_id',w))).map(r=>r.role)).toEqual(member?[role]:[])
   for(const table of ['hub_leads','hub_triages','hub_meetings','hub_interactions','hub_activities','hub_proposals_visible','hub_projects_visible','hub_receivables','hub_receipts','hub_expenses','hub_finance_audit']){
    const rows=await checked(client.from(table).select('*').eq('workspace_id',other))
    expect(rows,table+' isolation '+role).toEqual([])
   }
   const quotes=await checked(client.from('hub_proposals_visible').select('*').eq('workspace_id',w))
   const projects=await checked(client.from('hub_projects_visible').select('*').eq('workspace_id',w))
   expect((await checked(client.from('hub_proposals_visible').select('id').eq('workspace_id',w).eq('record->>setup','150'))).length).toBe(finance?1:0)
   expect(quotes).toHaveLength(member?1:0)
   expect(projects).toHaveLength(member?1:0)
   if(member){
    for(const record of [quotes[0].record,projects[0].approved]){
     expect(record.setup).toBe(finance?150:undefined)
     expect(record.monthly).toBe(finance?25:undefined)
     expect(record.terms).toBe(finance?body.terms:undefined)
    }
   }
   for(const [table,column] of [['hub_proposals','record'],['hub_projects','approved']]){
    expect((await client.from(table).select(column).eq('workspace_id',w)).error?.code).toBe('42501')
   }
   expect((await checked(client.from('hub_expenses').select('*').eq('workspace_id',w))).length).toBe(finance?1:0)
   const inserted=await client.from('hub_leads').insert({workspace_id:w,name:'Novo '+role}).select('id')
   expect(!inserted.error).toBe(commercial)
   const changed=await checked(client.from('hub_projects').update({owner:role}).eq('workspace_id',w).eq('proposal_id',p).select('proposal_id'))
   expect(changed.length).toBe(operations?1:0)
   expect((await checked(client.from('hub_triages').update({record:{owner:role}}).eq('workspace_id',w).eq('lead_id',l).select('lead_id'))).length).toBe(commercial?1:0)
   expect((await checked(client.from('hub_meetings').update({record:{participants:role}}).eq('workspace_id',w).eq('id',meeting).select('id'))).length).toBe(commercial?1:0)
   expect(!(await client.from('hub_interactions').insert({workspace_id:w,lead_id:l,body:'Interação '+role})).error).toBe(commercial)
   expect(!(await client.from('hub_activities').insert({workspace_id:w,lead_id:l,title:'Atividade '+role})).error).toBe(commercial)
   // Linked activities are created through RPCs so their lead/project link is
   // derived on the server, even for administrators.
   expect((await client.from('hub_activities').insert({workspace_id:w,lead_id:l,project_proposal_id:p,title:'Pós-venda '+role})).error?.code).toBe('42501')
   expect(await checked(client.rpc('hub_save_triage',{p_workspace:w,p_lead:l,p_record:{},p_scores:[0,0,0,0,0,0,0],p_completed:false,p_profile:{},p_name:'Conta fictícia',p_segment:'',p_city:'',p_qualify:false}))).toBe(commercial)
   expect(await checked(client.rpc('hub_save_meeting',{p_workspace:w,p_lead:l,p_id:uuid(),p_date:today,p_state:'Agendada',p_record:{participants:'Equipe fictícia'},p_follow_due:null,p_advance:false}))).toBe(commercial)
   expect(Boolean(await checked(client.rpc('hub_dashboard',{p_workspace:w,p_today:today})))).toBe(member)
   expect(await checked(client.rpc('hub_open_support',{w,p,t:'Chamado '+role,o:'Equipe fictícia',d:'2026-11-20'}))).toBe(operations)
   expect((await checked(client.from('hub_activities').update({status:'Em andamento'}).eq('workspace_id',w).eq('project_proposal_id',p).select('id'))).length>0).toBe(operations)
   expect(await checked(client.rpc('hub_forecast',{w,p,k:'Mensalidade',d:'2026-'+(role==='admin'?'10':'11')+'-15'}))).toBe(finance)
   const receipt=uuid(),period=role==='admin'?'2026-10-01':'2026-11-01'
   const receiptArgs={w,p,k:'Mensalidade',m:period,i:receipt}
   expect(await checked(client.rpc('hub_receive',{...receiptArgs,d:today,a:5}))).toBe(finance)
   expect(await checked(client.rpc('hub_reverse_receipt',{...receiptArgs,reason:'Correção fictícia'}))).toBe(finance)
   if(!operations)expect(await checked(client.rpc('hub_accept_delivery',{w,p,c:['tests','scope','pending'],d:today,e:'Aceite fictício',t:'',o:'',due:null}))).toBe(false)
   expect(await checked(client.rpc('hub_open_project',{w,p}))).toBe(operations)
   expect(await checked(client.rpc('hub_open_project',{w:other,p:foreignProposal}))).toBe(false)
   expect(await checked(client.rpc('hub_forecast',{w:other,p:foreignProposal,k:'Mensalidade',d:'2026-12-15'}))).toBe(false)
   expect(await checked(client.rpc('hub_open_support',{w:other,p:foreignProposal,t:'Intrusão',o:'Equipe',d:today}))).toBe(false)
   expect(await checked(client.rpc('hub_set_role',{w,u:id,r:role==='admin'?'admin':'admin'}))).toBe(role==='admin')
   expect(await checked(client.rpc('hub_set_role',{w:other,u:id,r:'admin'}))).toBe(false)
   const response=await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'})
   expect(response.status).toBe(member?200:403)
   if(member)expect((await response.json()).workspaces).toEqual([{id:w,name:'Papéis fictícios',role,roles:[role]}])
  }
  const sales=users.find(u=>u.role==='commercial')
  const ops=users.find(u=>u.role==='operations')
  expect(await checked(ops.client.rpc('hub_accept_delivery',{w,p,c:['tests','scope','pending'],d:today,e:'Aceite fictício',t:'Retorno',o:'Equipe',due:today}))).toBe(true)
  expect(await checked(users[0].client.rpc('hub_set_role',{w,u:users[0].id,r:'commercial'}))).toBe(false)
  const draft=uuid()
  const args={w,l,p:draft,s:draft,v:1,m:null,body:{title:'Proposta comercial',scope:'Escopo',services:[],validity:'2026-12-01'},decision:null,occurred:null,evidence:null}
  expect(await checked(sales.client.rpc('hub_save_proposal',{...args,body:{...args.body,setup:999,monthly:50,terms:'Preço'}}))).toBe(false)
  expect(await checked(sales.client.rpc('hub_save_proposal',args))).toBe(true)
  expect(await checked(sales.client.rpc('hub_save_proposal',{...args,w:other}))).toBe(false)
  await checked(admin.from('hub_proposals').update({record:{...args.body,setup:150,monthly:25,terms:'Condição reservada',events:[]}}).eq('workspace_id',w).eq('id',draft))
  expect(await checked(sales.client.rpc('hub_save_proposal',args))).toBe(true)
  const revision=uuid()
  expect(await checked(sales.client.rpc('hub_save_proposal',{...args,p:revision,v:2}))).toBe(true)
  expect((await checked(admin.from('hub_proposals').select('record').eq('workspace_id',w).eq('id',revision).single())).record).toMatchObject({setup:150,monthly:25,terms:'Condição reservada'})
  const anonymous=createClient(endpoint,key,options)
  expect((await anonymous.from('hub_proposals_visible').select('*')).error?.code).toBe('42501')
  expect((await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key}})).status).toBe(401)
  await page.addInitScript(session=>localStorage.setItem('sb-127-auth-token',JSON.stringify(session)),sales.session)
  await page.goto('/')
  await expect(page.getByRole('heading',{name:'Dashboard',exact:true})).toBeVisible()
  await expect(page.getByRole('button',{name:'Financeiro',exact:true})).toHaveCount(0)
  await page.getByRole('button',{name:'Projetos e entregas',exact:true}).click()
  await page.getByRole('button',{name:'Projeto por papel',exact:true}).click()
  await expect(page.getByRole('button',{name:'Salvar projeto',exact:true})).toBeDisabled()
  await expect(page.getByText(/Implantação.*150/)).toHaveCount(0)
  await page.getByRole('button',{name:'Fechar',exact:true}).click()
  await page.getByRole('button',{name:'Propostas comerciais',exact:true}).click()
  await page.getByRole('button',{name:'Proposta comercial',exact:true}).click()
  await expect(page.getByLabel('Implantação (R$)')).toHaveCount(0)
  await page.getByLabel('Escopo e entregáveis').fill('Escopo comercial revisado')
  await page.getByRole('button',{name:'Salvar rascunho',exact:true}).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await checked(admin.from('hub_proposals').select('record').eq('workspace_id',w).eq('id',revision).single())).record).toMatchObject({scope:'Escopo comercial revisado',setup:150,monthly:25,terms:'Condição reservada'})
  const assign=users[0].client
  expect(await checked(assign.rpc('hub_set_roles',{w,u:sales.id,r:[]}))).toBe(false)
  expect(await checked(assign.rpc('hub_set_roles',{w,u:sales.id,r:['commercial','unknown']}))).toBe(false)
  expect(await checked(assign.rpc('hub_set_roles',{w,u:sales.id,r:['operations','finance','commercial','finance']}))).toBe(true)
  expect(await checked(sales.client.rpc('hub_can',{w,module:'projects',writing:true}))).toBe(true)
  expect(await checked(sales.client.rpc('hub_can',{w,module:'finance',writing:true}))).toBe(true)
  expect(await checked(sales.client.rpc('hub_can',{w,module:'admin',writing:true}))).toBe(false)
  expect(await checked(sales.client.rpc('hub_set_roles',{w,u:sales.id,r:['admin']}))).toBe(false)
  const combined=await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+sales.session.access_token,'Content-Type':'application/json'},body:'{}'})
  expect((await combined.json()).workspaces[0].roles).toEqual(['commercial','finance','operations'])
  const decision={...args,p:revision,v:2,body:null,occurred:today,evidence:'Confirmação fictícia'}
  expect(await checked(sales.client.rpc('hub_save_proposal',{...decision,decision:'Enviada'}))).toBe(true)
  expect(await checked(sales.client.rpc('hub_save_proposal',{...decision,decision:'Aceita'}))).toBe(false)
  await checked(admin.from('hub_leads').update({stage:'Negociação'}).eq('workspace_id',w).eq('id',l))
  expect((await sales.client.from('hub_leads').insert({workspace_id:w,id:uuid(),name:'Ganho direto',stage:'Ganho'})).error?.code).toBe('42501')
  expect((await sales.client.from('hub_leads').update({stage:'Ganho'}).eq('workspace_id',w).eq('id',l)).error?.code).toBe('42501')
  expect(await checked(assign.rpc('hub_save_proposal',{...decision,decision:'Aceita'}))).toBe(true)
  expect((await checked(sales.client.from('hub_leads').select('stage').eq('workspace_id',w).eq('id',l).single())).stage).toBe('Ganho')
 }finally{
  // Keep business fixtures in the disposable local stack; remove auth accounts.
  for(const user of users)await admin.auth.admin.deleteUser(typeof user==='string'?user:user.id)
 }
})
