import {createClient} from '@supabase/supabase-js'
import {randomUUID as uuid} from 'node:crypto'
export const checked=async op=>{const {data,error}=await op;if(error)throw error;if(data===false)throw Error('Operação recusada');return data}
export async function operationalFixture(env=process.env){
 const endpoint='http://127.0.0.1:54321'
 if(env.VITE_SUPABASE_URL!==endpoint)throw Error('Fixtures operacionais somente no Supabase local.')
 const options={auth:{persistSession:false,autoRefreshToken:false}}
 const admin=createClient(endpoint,env.HUB_TEST_ADMIN_KEY,options),workspace=uuid(),other=uuid(),users=[]
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
 const shift=n=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
 await checked(admin.from('hub_workspaces').insert([{id:workspace,name:'Decifaz · Prévia fictícia'},{id:other,name:'Outro espaço fictício'}]))
 async function account(role){
  const email=uuid()+'@example.invalid',password=uuid()
  const {user}=await checked(admin.auth.admin.createUser({email,password,email_confirm:true}));users.push(user.id)
  await checked(admin.from('hub_members').insert({workspace_id:workspace,user_id:user.id,role}))
  const client=createClient(endpoint,env.VITE_SUPABASE_PUBLISHABLE_KEY,options)
  const {session}=await checked(client.auth.signInWithPassword({email,password}))
  return {id:user.id,client,session,email,password}
 }
 const owner=await account('admin'),second=await account('admin'),restricted=await account('commercial')
 await checked(admin.from('hub_members').insert({workspace_id:other,user_id:restricted.id,role:'commercial'}))
 const lead=uuid(),prospect=uuid(),meetingLead=uuid(),proposal=uuid(),meeting=uuid()
 await checked(admin.from('hub_leads').insert([
  {workspace_id:workspace,id:lead,name:'Café Horizonte · fictício',segment:'Alimentação',city:'Fortaleza',stage:'Ganho',profile:{owner:'Marina · fictícia',needs:'Organizar pedidos e atendimento'}},
  {workspace_id:workspace,id:prospect,name:'Studio Aurora · fictício',segment:'Serviços',city:'Fortaleza',stage:'Qualificado',profile:{owner:'Caio · fictício',next:'Validar diagnóstico',due:today}},
  {workspace_id:workspace,id:meetingLead,name:'Mercado Sol · fictício',segment:'Varejo',city:'Eusébio',stage:'Reunião marcada',profile:{owner:'Marina · fictícia'}},
 ]))
 const body={title:'Pedidos digitais · Horizonte',scope:'Cardápio e fila de atendimento',services:['Cardápio digital'],setup:2400,monthly:180,terms:'Condição fictícia reservada',validity:shift(7),events:[],version:1}
 await checked(admin.from('hub_proposals').insert({workspace_id:workspace,id:proposal,lead_id:lead,series_id:proposal,version:1,status:'Aceita',record:body}))
 await checked(admin.from('hub_projects').insert({workspace_id:workspace,proposal_id:proposal,lead_id:lead,approved:body,owner:'Marina · fictícia',due_on:shift(3),status:'Em andamento',deliverables:'Cardápio, pedidos e treinamento'}))
 await checked(admin.from('hub_meetings').insert({workspace_id:workspace,id:meeting,lead_id:meetingLead,meeting_on:today,state:'Agendada',record:{participants:'Gestão · fictícia',answers:{},checked:[],summary:'Diagnóstico do atendimento',tools:'',objections:'',budget:'',next:'Consolidar necessidades',owner:'Marina · fictícia',due:shift(1)}}))
 await checked(admin.from('hub_activities').insert([
  {workspace_id:workspace,lead_id:prospect,support:false,title:'Enviar diagnóstico revisado',owner:'Caio · fictício',due_on:shift(-1)},
  {workspace_id:workspace,lead_id:prospect,support:false,title:'Confirmar prioridade da automação',owner:'Caio · fictício',due_on:today},
  {workspace_id:workspace,lead_id:lead,project_proposal_id:proposal,support:true,title:'Acompanhar implantação do cardápio',owner:'Marina · fictícia',due_on:shift(2)},
 ]))
 await checked(admin.from('hub_receivables').insert({workspace_id:workspace,proposal_id:proposal,kind:'Implantação',period:'0001-01-01',due_on:today,amount:2400}))
 await checked(admin.from('hub_receipts').insert({workspace_id:workspace,id:uuid(),proposal_id:proposal,kind:'Implantação',period:'0001-01-01',received_on:today,amount:800}))
 return {admin,owner,second,restricted,workspace,other,lead,prospect,meetingLead,proposal,meeting,today,cleanup:async()=>{
  await admin.from('hub_workspaces').delete().in('id',[workspace,other]);for(const id of users)await admin.auth.admin.deleteUser(id)
 }}
}
