import {useEffect,useState,type FormEvent} from 'react'
import {createClient,type Session} from '@supabase/supabase-js'
import {dateLabel} from './domain'

const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const client=url&&key?.startsWith('sb_publishable_')?createClient(url,key):null

type Workspace={id:string;name:string}
type Lead={id:string;name:string;segment:string;city:string;notes:string}
type Interaction={id:string;body:string;created_at:string}
type Task={id:string;title:string;status:string;due_on:string|null}
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
  const {error}=await client!.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:location.origin+location.pathname}})
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
  void client!.from('hub_leads').select('id,name,segment,city,notes').eq('workspace_id',workspace).order('name').then(({data,error})=>{
   if(!current)return
   if(error){setError('Não foi possível carregar os estabelecimentos.');return}
   setLeads(data)
   setReady(true)
  })
  return ()=>{current=false}
 },[workspace,revision])
 useEffect(()=>{
  if(!workspace||!selected)return
  let current=true
  const history=client!.from('hub_interactions').select('id,body,created_at').eq('workspace_id',workspace).eq('lead_id',selected).order('created_at',{ascending:false})
  const activities=client!.from('hub_activities').select('id,title,status,due_on').eq('workspace_id',workspace).eq('lead_id',selected).order('due_on')
  void Promise.all([history,activities]).then(([h,a])=>{
   if(!current)return
   if(h.error||a.error){setError('Não foi possível carregar o histórico e as atividades.');return}
   setInteractions(h.data)
   setTasks(a.data)
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
  try{
   const result=await operation()
   if(result.error||!result.data)throw new Error()
   success?.()
   reload(value=>value+1)
  }catch{
   setError('Não foi possível salvar. Confira seu acesso e tente novamente.')
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
  void write(()=>query.select('id,name,segment,city,notes').single().then(result=>{
   if(result.data)select(result.data)
   return result
  }))
 }
 return <main className="pilot">
  <header className="page-heading"><div><h1>CRM compartilhado</h1><p>{spaces.find(space=>space.id===workspace)?.name??'Decifaz Hub'}</p></div><button className="button" onClick={()=>void client!.auth.signOut().then(({error})=>{if(error)setError('Não foi possível sair. Tente novamente.')})}>Sair</button></header>
  {error&&<p role="alert">{error}</p>}
  {!ready&&!error&&<p role="status">Carregando o CRM…</p>}
  {ready&&<>
   {spaces.length>1&&<label>Espaço de trabalho<select disabled={busy} value={workspace} onChange={e=>{setReady(false);setError('');setLeads([]);setWorkspace(e.target.value);select()}}>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>}
   <div className="dashboard-grid">
    <section className="card panel"><div className="panel-head"><h2>Estabelecimentos</h2><button className="button" disabled={busy} onClick={()=>{setError('');reload(value=>value+1)}}>Atualizar</button><button className="button" disabled={busy} onClick={()=>select()}>Novo lead</button></div>
     {leads.length?<div className="list">{leads.map(lead=><button type="button" className="list-item" aria-pressed={selected===lead.id} key={lead.id} disabled={busy} onClick={()=>select(lead)}>{lead.name}</button>)}</div>:<p>Nenhum estabelecimento cadastrado.</p>}
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
     {tasks.length?<ul>{tasks.map(item=><li key={item.id}><label>{item.title}{item.due_on?' · '+dateLabel(item.due_on):''}<select disabled={busy} value={item.status} onChange={e=>void write(()=>client!.from('hub_activities').update({status:e.target.value}).eq('workspace_id',workspace).eq('id',item.id).select('id').single())}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></li>)}</ul>:<p>Sem atividades registradas.</p>}
    </section>
   </div>}
  </>}
 </main>
}
