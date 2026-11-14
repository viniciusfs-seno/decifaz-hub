import {useEffect,useState,type FormEvent} from 'react'
import {createClient,type Session} from '@supabase/supabase-js'
import {dateLabel,grade,stages,type Data,type Meeting} from './domain'
import {MeetingEditor,TriageEditor} from './commercial'
import {fullLead,fullTriage,leadColumns,loadMeetings,loadMetrics,saveMeeting,saveTriage,type PilotLead,type PilotMetrics,type TriageRow} from './pilot-journey'

const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const client=url&&key?.startsWith('sb_publishable_')?createClient(url,key):null

type Workspace={id:string;name:string}
type Lead=PilotLead
type Interaction={id:string;body:string;created_at:string}
type Task={id:string;title:string;status:string;due_on:string|null;owner:string}
const empty={name:'',segment:'',city:'',notes:''}
const statuses=['Pendente','Em andamento','Concluída','Cancelada']

export default function PilotApp(){
 const [session,setSession]=useState<Session|null>()
 const [error,setError]=useState('')
 const [email,setEmail]=useState('')
 const [sent,setSent]=useState(false)
 const [busy,setBusy]=useState(false)
 useEffect(()=>{
  if(!client)return
  const {data}=client.auth.onAuthStateChange((_event,next)=>setSession(next))
  return ()=>data.subscription.unsubscribe()
 },[])
 async function signIn(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  setBusy(true)
  setError('')
  const {error}=await client!.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname+(import.meta.env.VITE_HUB_MODE==='preview'?'?piloto=1':'')}})
  setSent(!error)
  if(error)setError('Não foi possível solicitar o link. Confira o endereço e tente novamente.')
  setBusy(false)
 }
 if(!client)return <main><p role="alert">Configure a URL e a chave publicável do Supabase para abrir o piloto.</p></main>
 if(session===undefined)return <main><p role="status">Carregando sessão…</p></main>
 if(session)return <SharedCrm key={session.user.id}/>
 return <main className="pilot"><h1>Decifaz Hub</h1><p>Entre com o e-mail autorizado para acessar o CRM compartilhado.</p>
  <form className="card panel pilot-fields" onSubmit={signIn}><label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><button className="button primary" disabled={busy}>Enviar link de acesso</button></form>
  {sent&&<p role="status">Confira seu e-mail para entrar.</p>}{error&&<p role="alert">{error}</p>}
 </main>
}

function SharedCrm(){
 const [spaces,setSpaces]=useState<Workspace[]>([])
 const [workspace,setWorkspace]=useState('')
 const [leads,setLeads]=useState<Lead[]>([])
 const [selected,setSelected]=useState('')
 const [triages,setTriages]=useState<TriageRow[]>([])
 const [meetings,setMeetings]=useState<Meeting[]>([])
 const [metrics,setMetrics]=useState<PilotMetrics|null>(null)
 const [editor,setEditor]=useState<'triage'|'meeting'|null>(null)
 const [meeting,setMeeting]=useState<Meeting>()
 const [notice,setNotice]=useState('')
 const [draft,setDraft]=useState(empty)
 const [interactions,setInteractions]=useState<Interaction[]>([])
 const [tasks,setTasks]=useState<Task[]>([])
 const [note,setNote]=useState('')
 const [task,setTask]=useState('')
 const [due,setDue]=useState('')
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 const [ready,setReady]=useState(false)
 const [loadedLead,setLoadedLead]=useState('')
 const [revision,reload]=useState(0)

 useEffect(()=>{
  let current=true
  void client!.functions.invoke<{workspaces:Workspace[]}>('hub-workspaces',{body:{}}).then(({data,error})=>{
   if(!current)return
   if(error||!data?.workspaces.length){setError(error?.context?.status===403?'Esta conta ainda não faz parte do espaço de trabalho.':'Não foi possível acessar o CRM compartilhado.');return}
   setSpaces(data.workspaces)
   setWorkspace(data.workspaces[0].id)
  })
  return ()=>{current=false}
 },[])
 useEffect(()=>{
  if(!workspace)return
  let current=true
  const leadsQuery=client!.from('hub_leads').select(leadColumns).eq('workspace_id',workspace).order('name').returns<Lead[]>()
  const triagesQuery=client!.from('hub_triages').select('lead_id,record,scores,completed').eq('workspace_id',workspace).returns<TriageRow[]>()
  void Promise.all([leadsQuery,triagesQuery,loadMetrics(client!,workspace)]).then(([leads,triages,dashboard])=>{
   if(!current)return
   if(leads.error||triages.error||dashboard.error||!dashboard.data){setReady(false);setError('Não foi possível carregar a jornada comercial. Confira seu acesso e atualize.');return}
   setLeads(leads.data)
   setTriages(triages.data)
   setMetrics(dashboard.data)
   setReady(true)
  })
  return ()=>{current=false}
 },[workspace,revision])
 useEffect(()=>{
  if(!workspace||!selected)return
  let current=true
  const history=client!.from('hub_interactions').select('id,body,created_at').eq('workspace_id',workspace).eq('lead_id',selected).order('created_at',{ascending:false})
  const activities=client!.from('hub_activities').select('id,title,status,due_on,owner').eq('workspace_id',workspace).eq('lead_id',selected).order('due_on')
  void Promise.all([history,activities,loadMeetings(client!,workspace,selected)]).then(([h,a,m])=>{
   if(!current)return
   if(h.error||a.error||m.error||!m.data){setError('Não foi possível carregar o histórico e as atividades.');return}
   setInteractions(h.data)
   setTasks(a.data)
   setMeetings(m.data)
   setLoadedLead(selected)
  })
  return ()=>{current=false}
 },[workspace,selected,revision])
 function select(lead?:Lead){
  setSelected(lead?.id??'')
  setDraft(lead?{name:lead.name,segment:lead.segment,city:lead.city,notes:lead.notes}:empty)
  setLoadedLead('')
  setNote('')
  setTask('')
  setDue('')
 }
 async function write(operation:()=>PromiseLike<{error:unknown;data:unknown}>,success?:()=>void){
  setBusy(true)
  setError('')
  setNotice('')
  try{
   const result=await operation()
   if(result.error||!result.data)throw new Error()
   success?.()
   reload(value=>value+1)
   setNotice('Registro salvo.')
   return true
  }catch{
   setError('Não foi possível salvar. Confira seu acesso e tente novamente.')
   return false
  }finally{
   setBusy(false)
  }
 }
 function saveLead(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  const values={...draft,name:draft.name.trim()}
  if(!values.name)return
  const table=client!.from('hub_leads')
  const query=selected?table.update(values).eq('workspace_id',workspace).eq('id',selected):table.insert({...values,workspace_id:workspace})
  void write(()=>query.select(leadColumns).returns<Lead[]>().single().then(result=>{
   if(result.data)select(result.data)
   return result
  }))
 }
 const currentLead=leads.find(lead=>lead.id===selected)
 const selectedTriage=triages.find(row=>row.lead_id===selected)
 const lead=currentLead?fullLead(currentLead):undefined
 const meetingContext:Data={version:1,leads:lead?[lead]:[],triages:selectedTriage?[fullTriage(selectedTriage)]:[],meetings,activities:[],proposals:[],projects:[],finance:[],team:[]}
 return <main className="pilot">
  <header className="page-heading"><div><h1>CRM compartilhado</h1><p>{spaces.find(space=>space.id===workspace)?.name??'Decifaz Hub'}</p></div><div className="actions"><button className="button" disabled={busy||!workspace} onClick={()=>{setError('');reload(value=>value+1)}}>Atualizar</button><button className="button" disabled={busy} onClick={()=>void client!.auth.signOut().then(({error})=>{if(error)setError('Não foi possível sair. Tente novamente.')})}>Sair</button></div></header>
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!ready&&!error&&<p role="status">Carregando o CRM…</p>}
  {ready&&<>
   {spaces.length>1&&<label>Espaço de trabalho<select disabled={busy} value={workspace} onChange={e=>{setReady(false);setError('');setLeads([]);setWorkspace(e.target.value);select()}}>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>}
   {metrics&&<PilotDashboard metrics={metrics}/>}
   <div className="dashboard-grid">
    <section className="card panel"><div className="panel-head"><h2>Estabelecimentos</h2><button className="button" disabled={busy} onClick={()=>select()}>Novo lead</button></div>
     {leads.length?<div className="list">{leads.map(lead=><button type="button" className="list-item" aria-pressed={selected===lead.id} key={lead.id} disabled={busy} onClick={()=>select(lead)}>{lead.name} · {lead.stage}{(() => {const row=triages.find(item=>item.lead_id===lead.id);const priority=row&&grade(fullTriage(row));return priority?' · Prioridade '+priority.label:''})()}</button>)}</div>:<p>Nenhum estabelecimento cadastrado.</p>}
    </section>
    <section className="card panel"><h2>{selected?'Editar estabelecimento':'Cadastrar estabelecimento'}</h2>
     <form className="pilot-fields" onSubmit={saveLead}>
      <label>Nome<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Segmento<input value={draft.segment} onChange={e=>setDraft({...draft,segment:e.target.value})}/></label>
      <label>Cidade<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}/></label>
      <label>Observações<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
      <button className="button primary" disabled={busy}>Salvar estabelecimento</button>
     </form>
    </section>
   </div>
   {lead&&<section className="card panel">
    <h2>Jornada comercial de {lead.name}</h2><p>{lead.stage}{lead.needs?' · '+lead.needs:''}</p>
    {lead.next&&<p>Próxima ação · {lead.next} · {dateLabel(lead.due)}</p>}
    <div className="actions">
     <button className="button" disabled={busy} onClick={()=>setEditor('triage')}>{selectedTriage?'Editar triagem':'Iniciar triagem'}</button>
     <button className="button" disabled={busy||loadedLead!==selected} onClick={()=>{setMeeting(undefined);setEditor('meeting')}}>Registrar reunião</button>
    </div>
    {loadedLead===selected&&meetings.map(item=><div key={item.id} className="list-item"><div><b>{dateLabel(item.date)} · {item.state}</b><p>{item.summary||item.participants}</p></div><button className="button" disabled={busy} onClick={()=>{setMeeting(item);setEditor('meeting')}}>Editar reunião</button></div>)}
   </section>}
   {selected&&loadedLead===selected&&<div className="dashboard-grid">
    <section className="card panel"><h2>Histórico</h2>
     <form className="pilot-fields" onSubmit={e=>{e.preventDefault();if(note.trim())void write(()=>client!.from('hub_interactions').insert({workspace_id:workspace,lead_id:selected,body:note.trim()}).select('id').single(),()=>setNote(''))}}>
      <label>Nova interação<textarea required value={note} onChange={e=>setNote(e.target.value)}/></label><button className="button" disabled={busy}>Registrar interação</button>
     </form>
     {interactions.length?<ul>{interactions.map(entry=><li key={entry.id}>{entry.body} · {dateLabel(entry.created_at)}</li>)}</ul>:<p>Sem interações registradas.</p>}
    </section>
    <section className="card panel"><h2>Atividades</h2>
     <form className="pilot-fields" onSubmit={e=>{e.preventDefault();if(task.trim())void write(()=>client!.from('hub_activities').insert({workspace_id:workspace,lead_id:selected,title:task.trim(),due_on:due||null}).select('id').single(),()=>{setTask('');setDue('')})}}>
      <label>Título<input required value={task} onChange={e=>setTask(e.target.value)}/></label><label>Prazo<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><button className="button" disabled={busy}>Criar atividade</button>
     </form>
     {tasks.length?<ul>{tasks.map(item=><li key={item.id}><label>{item.title}{item.owner?' · '+item.owner:''}{item.due_on?' · '+dateLabel(item.due_on):''}<select disabled={busy} value={item.status} onChange={e=>void write(()=>client!.from('hub_activities').update({status:e.target.value}).eq('workspace_id',workspace).eq('id',item.id).select('id').single())}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></li>)}</ul>:<p>Sem atividades registradas.</p>}
    </section>
   </div>}
   {lead&&editor==='triage'&&<TriageEditor lead={lead} triage={selectedTriage&&fullTriage(selectedTriage)} team={[]} close={()=>setEditor(null)}
    save={(triage,updatedLead)=>write(()=>saveTriage(client!,workspace,triage,updatedLead),()=>setDraft({...draft,name:updatedLead.name,segment:updatedLead.segment,city:updatedLead.city}))}/>}
   {lead&&editor==='meeting'&&<MeetingEditor data={meetingContext} item={meeting} leadId={lead.id} lockLead close={()=>setEditor(null)}
    save={(item,follow,advance)=>write(()=>saveMeeting(client!,workspace,item,follow,advance))}/>}
  </>}
 </main>
}

function PilotDashboard({metrics}: {metrics:PilotMetrics}) {
 const total=Object.values(metrics.funnel).reduce((sum,count)=>sum+count,0)
 const indicators=[['Estabelecimentos',total],['Reuniões agendadas',metrics.scheduled],['Diagnósticos realizados',metrics.diagnosed],
  ['Atividades pendentes',metrics.pending],['Atividades vencidas',metrics.overdue]] as const
 return <section className="card panel">
  <h2>Visão geral</h2>
  <div className="dashboard-grid">
   <dl>{indicators.map(([label,value])=><div className="row-between" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
   <div><h3>Prioridades</h3><p>A · {metrics.priorities.A??0}　B · {metrics.priorities.B??0}　C · {metrics.priorities.C??0}</p>
    <h3>Funil comercial</h3>{total===0?<p>Nenhuma oportunidade cadastrada.</p>:
     <ul>{stages.filter(stage=>metrics.funnel[stage]).map(stage=><li key={stage}>{stage} · {metrics.funnel[stage]}</li>)}</ul>}</div>
  </div>
 </section>
}

