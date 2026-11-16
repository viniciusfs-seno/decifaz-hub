import {can,hasRole,type Role} from './access'
import {Knowledge} from './secondary'
import {Team} from './team'
import {InviteInbox} from './invites'
import {CommercialCenter} from './commercial-center'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {createClient,type Session} from '@supabase/supabase-js'
import {BookOpen, CalendarDays, ClipboardList, FileCheck2, FolderKanban, LayoutDashboard, ListTodo, Menu, Moon, Sun, Users, Wallet} from 'lucide-react'
import {dateLabel,day,money,stages,type Data,type Meeting,type Proposal} from './domain'
import {CRM,MeetingEditor,TriageEditor} from './commercial'
import {ProposalEditor,Proposals} from './proposals'
import {financeMetrics} from './shared-finance-metrics'
import {loadFinance,SharedFinance} from './pilot-finance'
import {ProjectSupport,activityStatuses as statuses} from './project-support'
import {loadProjects,SharedProjects,SharedProjectEditor,type SharedProject} from './pilot-projects'
import {fullLead,fullTriage,leadColumns,loadMeetings,loadMetrics,loadProposals,saveProposal,saveMeeting,saveTriage,type PilotLead,type PilotMetrics,type TriageRow} from './pilot-journey'

const url=import.meta.env.VITE_SUPABASE_URL
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const client=url&&key?.startsWith('sb_publishable_')?createClient(url,key):null
const inviteMailClient=url&&key?.startsWith('sb_publishable_')?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'decifaz-invite-mail'}}):null
async function sendInviteLink(email:string,id:string){
 const {error}=await inviteMailClient!.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:new URL('/?convite='+id,location.origin).href}})
 if(error)throw Error('Envio indisponível')
}

type Workspace={id:string;name:string;role:Role;roles?:Role[]}
type Lead=PilotLead
type Interaction={id:string;body:string;created_at:string}
type Task={id:string;title:string;status:string;due_on:string|null;owner:string}
const empty={name:'',segment:'',city:'',notes:''}

export default function PilotApp(){
 const [session,setSession]=useState<Session|null>()
 const [error,setError]=useState('')
 const [email,setEmail]=useState('')
 const [sent,setSent]=useState(false)
 const [busy,setBusy]=useState(false)
 const [invited,setInvited]=useState(()=>new URLSearchParams(location.search).has('convite'))
 useEffect(()=>{
  if(!client)return
  const {data}=client.auth.onAuthStateChange((_event,next)=>setSession(next))
  return ()=>data.subscription.unsubscribe()
 },[])
 async function signIn(event:FormEvent<HTMLFormElement>){
  event.preventDefault()
  setBusy(true)
  setError('')
  const destination=new URL('/',location.origin)
  if(invited&&new URLSearchParams(location.search).has('convite'))destination.search=location.search
  const {error}=await client!.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:invited,emailRedirectTo:destination.href}})
  setSent(!error)
  if(error)setError('Não foi possível solicitar o link. Confira o endereço e tente novamente.')
  setBusy(false)
 }
 if(!client)return <main className="pilot-login"><h1>Decifaz Hub</h1><p role="alert">O acesso compartilhado está indisponível. Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente deste deploy e gere um novo build.</p></main>
 if(session===undefined)return <main><p role="status">Carregando sessão…</p></main>
 if(session)return <SharedCrm key={session.user.id}/>
 return <main className="pilot-login"><img className="brand-logo" src={import.meta.env.BASE_URL+'identidade/assinatura-horizontal-escuro-selo.svg'} alt="Decifaz"/><h1>Decifaz Hub</h1><p>Entre com o e-mail autorizado para acessar o CRM compartilhado.</p>
  <form className="card panel pilot-fields" onSubmit={signIn}><label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="invite-mail"><input type="checkbox" checked={invited} onChange={e=>setInvited(e.target.checked)}/>Recebi um convite</label><button className="button primary" disabled={busy}>Enviar link de acesso</button></form>
  {sent&&<p role="status">Confira seu e-mail para entrar.</p>}{error&&<p role="alert">{error}</p>}
 </main>
}

const sections=[['dashboard','Dashboard',LayoutDashboard],['agenda','Agenda operacional',CalendarDays],['central','Central comercial',ListTodo],['conhecimento','Base de conhecimento',BookOpen],['crm','Captação e CRM',Users],['triagem','Triagem comercial',ClipboardList],['propostas','Propostas comerciais',FileCheck2],['projetos','Projetos e entregas',FolderKanban],['financeiro','Financeiro',Wallet]] as const
type Section=typeof sections[number][0]|'equipe'|'convites'

function SharedCrm(){
 const [reportMonth,setReportMonth]=useState(day().slice(0,7))
 const [page,setPage]=useState<Section>(()=>new URLSearchParams(location.search).has('convite')?'convites':'dashboard')
 const [menu,setMenu]=useState(false)
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem('decifaz-theme')==='dark'}catch{return false}})
 const [showForm,setShowForm]=useState(false)
 useEffect(()=>{
  document.documentElement.dataset.theme=dark?'dark':'light'
  try{localStorage.setItem('decifaz-theme',dark?'dark':'light')}catch{/* tema em memória */}
 },[dark])
 function go(next:Section){
  setPage(next)
  setMenu(false)
  setShowForm(false)
  setProjectId('')
  window.scrollTo(0,0)
 }
 const [spaces,setSpaces]=useState<Workspace[]>([])
 const membershipRequest=useRef(0)
 async function refreshMemberships(preferred?:string){
  const request=++membershipRequest.current
  const {data,error}=await client!.functions.invoke<{workspaces:Workspace[]}>('hub-workspaces',{body:{}})
  if(request!==membershipRequest.current)return
  if(error?.context?.status===403){
   clearWorkspaceData();setSpaces([]);setWorkspace('');setPage('convites');setReady(true);setError('');setNotice('Nenhum espaço ativo disponível. Seu vínculo pode ter sido desativado; procure a Administração.');return
  }
  if(error||!data?.workspaces.length){setError('Não foi possível atualizar seu acesso. Tente novamente.');throw Error('Não foi possível atualizar seu acesso.')}
  setSpaces(previous=>data.workspaces.map(space=>{
   const current=previous.find(item=>item.id===space.id)
   return current&&current.name===space.name&&current.role===space.role&&JSON.stringify(current.roles)===JSON.stringify(space.roles)?current:space
  }))
  const next=data.workspaces.find(space=>space.id===(preferred??workspace))??data.workspaces[0]
  if(next.id!==workspace){clearWorkspaceData();setWorkspace(next.id);if(!preferred)setPage('dashboard')}
  if(preferred){setError('');setNotice('Acesso atualizado. Alterações de papéis existentes devem ser feitas pela Administração em Equipe.');const clean=new URL(location.href);clean.searchParams.delete('convite');history.replaceState(null,'',clean.href)}
 }
 const [workspace,setWorkspace]=useState('')
 const membership=spaces.find(space=>space.id===workspace)
 const role=membership?.roles??membership?.role
 const administrator=hasRole(role,'admin')
 const [moduleErrors,setModuleErrors]=useState<string[]>([])
 const [leads,setLeads]=useState<Lead[]>([])
 const [selected,setSelected]=useState('')
 const [triages,setTriages]=useState<TriageRow[]>([])
 const [finance,setFinance]=useState<Awaited<ReturnType<typeof loadFinance>>>()
 const [projects,setProjects]=useState<SharedProject[]>([])
 const [projectId,setProjectId]=useState('')
 const [proposals,setProposals]=useState<Proposal[]>([])
 const [proposalMeetings,setProposalMeetings]=useState<Meeting[]>([])
 const [proposalModal,setProposalModal]=useState<{id?:string;leadId?:string;meetingId?:string}>()
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
 function clearWorkspaceData(){
  setLeads([]);setTriages([]);setFinance(undefined);setProjects([]);setProposals([]);setProposalMeetings([]);setMeetings([]);setMetrics(null)
  setSelected('');setLoadedLead('');setInteractions([]);setTasks([]);setProjectId('');setProposalModal(undefined);setEditor(null);setMeeting(undefined);setShowForm(false)
 }
 useEffect(()=>{
  const refresh=()=>{void refreshMemberships().catch(()=>{/* erro visível; não encerrar Auth nem outros espaços */})}
  window.addEventListener('focus',refresh)
  const timer=window.setInterval(refresh,30000)
  return ()=>{window.removeEventListener('focus',refresh);window.clearInterval(timer);membershipRequest.current++}
 },[workspace])

 useEffect(()=>{
  let current=true
  void client!.functions.invoke<{workspaces:Workspace[]}>('hub-workspaces',{body:{}}).then(({data,error})=>{
   if(!current)return
   if(error?.context?.status===403){setSpaces([]);setWorkspace('');setPage('convites');setReady(true);return}
   if(error||!data?.workspaces.length){setError('Não foi possível acessar o CRM compartilhado.');return}
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
  setReady(false)
  setFinance(undefined)
  setModuleErrors([])
  void Promise.allSettled([leadsQuery,triagesQuery,loadMetrics(client!,workspace),loadProposals(client!,workspace),loadMeetings(client!,workspace),loadProjects(client!,workspace),can(role,'finance')?loadFinance(client!,workspace):Promise.resolve(undefined)]).then(results=>{
   if(!current)return
   const failures:string[]=[]
   function result<T>(index:number,label:string):T|undefined{
    const item=results[index]
    if(item.status==='rejected'){failures.push(label);return}
    if((item.value as {error?:unknown}|undefined)?.error){failures.push(label);return}
    return item.value as T
   }
   setLeads(result<{data:Lead[]}>(0,'CRM')?.data??[])
   setTriages(result<{data:TriageRow[]}>(1,'Triagem')?.data??[])
   setMetrics(result<{data:PilotMetrics}>(2,'Indicadores')?.data??null)
   setProposals(result<{data:Proposal[]}>(3,'Propostas')?.data??[])
   setProposalMeetings(result<{data:Meeting[]}>(4,'Reuniões')?.data??[])
   setProjects(result<{data:SharedProject[]}>(5,'Projetos')?.data??[])
   const financial=result<Awaited<ReturnType<typeof loadFinance>>>(6,'Financeiro')
   if(financial?.some(item=>item.error||!item.data))failures.push('Financeiro')
   else setFinance(financial)
   setModuleErrors(failures)
   setReady(true)
  })
  return ()=>{current=false}
 },[workspace,revision,role])
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
  setShowForm(true)
  setSelected(lead?.id??'')
  setDraft(lead?{name:lead.name,segment:lead.segment,city:lead.city,notes:lead.notes}:empty)
  if(lead?.id!==selected)setLoadedLead('')
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
 const commercialData:Data={version:1,leads:leads.map(fullLead),triages:triages.map(fullTriage),meetings:proposalMeetings,activities:[],proposals,projects:[],finance:[],team:[...new Set(leads.map(item=>item.profile.owner).filter((owner):owner is string=>Boolean(owner)))]}
 const meetingContext={...commercialData,leads:lead?[lead]:[],team:[]}
 const activeProject=projects.find(item=>item.proposal_id===projectId)
 const pageLabel=page==='convites'?'Meus convites':page==='equipe'?'Administração / Equipe':sections.find(([id])=>id===page)?.[1]
 const signOut=()=>void client!.auth.signOut().then(({error})=>{if(error)setError('Não foi possível sair. Tente novamente.')})
 return <div className="app">
  {menu&&<button className="mobile-scrim" aria-label="Fechar navegação" onClick={()=>setMenu(false)}/>}
  <aside className={'sidebar '+(menu?'open':'')}>
   <button className="brand" onClick={()=>go(workspace?'dashboard':'convites')}><img className="brand-logo" src={import.meta.env.BASE_URL+'identidade/assinatura-horizontal-escuro-selo.svg'} alt="Decifaz"/><small>Hub · Portal interno</small></button>
   <nav aria-label="Navegação principal">{workspace&&<div className="nav-group"><h2>Comercial</h2>{sections.filter(([id])=>id!=='financeiro'||can(role,'finance')).map(([id,label,Icon])=><button key={id} aria-current={page===id?'page':undefined} onClick={()=>go(id)}><Icon size={17}/><span>{label}</span></button>)}</div>}{administrator&&<div className="nav-group"><h2>Administração</h2><button aria-current={page==='equipe'?'page':undefined} onClick={()=>go('equipe')}><Users size={17}/><span>Equipe</span></button></div>}<div className="nav-group"><h2>Acesso</h2><button aria-current={page==='convites'?'page':undefined} onClick={()=>go('convites')}><Users size={17}/><span>Meus convites</span></button></div></nav>
  </aside>
  <div className="workspace"><header className="topbar">
   <div className="crumb"><button className="icon mobile-menu" aria-label="Abrir navegação" onClick={()=>setMenu(!menu)}><Menu size={21}/></button><span>Decifaz Hub</span><span className="slash">/</span><b>{pageLabel}</b></div>
   <div className="header-actions"><button className="icon theme" onClick={()=>setDark(!dark)} aria-label={dark?'Ativar tema claro':'Ativar tema escuro'}>{dark?<Sun size={19}/>:<Moon size={18}/>}</button><button className="button compact" disabled={busy} onClick={signOut}>Sair</button></div>
  </header>
  <main className="pilot">
   <div className="row-between"><p>{spaces.find(space=>space.id===workspace)?.name??'Decifaz Hub'}</p><button className="button compact" disabled={busy||!workspace} onClick={()=>{setError('');reload(value=>value+1)}}>Atualizar</button></div>
  {error&&<p role="alert">{error}</p>}
  {moduleErrors.map(label=><p role="alert" key={label}>{label}: não foi possível carregar. Os demais módulos continuam disponíveis.</p>)}
  {notice&&<p role="status">{notice}</p>}
  {!ready&&!error&&<p role="status">Carregando o CRM…</p>}
  {page==='convites'&&<InviteInbox client={client!} onAccepted={refreshMemberships}/>}
  {ready&&workspace&&<>
   {page==='equipe'&&(administrator?<Team key={workspace} client={client!} workspace={workspace} onSaved={refreshMemberships} sendInviteLink={sendInviteLink}/>:<p role="alert">Seu papel não permite gerir a equipe deste espaço.</p>)}
   {spaces.length>1&&<label>Espaço de trabalho<select disabled={busy} value={workspace} onChange={e=>{setReady(false);setError('');setLeads([]);setProjectId('');setWorkspace(e.target.value);select()}}>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>}
   {page==='dashboard'&&metrics&&<PilotDashboard metrics={metrics} finance={finance} proposals={proposals} month={reportMonth} setMonth={setReportMonth} openFinance={()=>go('financeiro')} leads={commercialData.leads} projects={projects}/>}
   {page==='central'&&<CommercialCenter key={workspace} client={client!} workspace={workspace} revision={revision}
    leads={commercialData.leads} meetings={proposalMeetings}
    openLead={id=>{const item=leads.find(lead=>lead.id===id);if(item){go('crm');select(item)}}}
    openProject={id=>{go('projetos');setProjectId(id)}}/>}
   {page==='conhecimento'&&<Knowledge download={false} go={()=>go('central')}/>}
   {page==='financeiro'&&!can(role,'finance')&&<p role="status">Seu papel não permite acesso ao Financeiro.</p>}
   {page==='financeiro'&&can(role,'finance')&&finance&&<SharedFinance key={workspace} client={client!} workspace={workspace} projects={projects} forecasts={finance[0].data??[]} receipts={finance[1].data??[]} expenses={finance[2].data??[]} month={reportMonth} setMonth={setReportMonth} audit={finance[3].data??[]} busy={busy} write={write}/>}
   {page==='agenda'&&<ProjectSupport readOnly={!can(role,'projects',true)} key={workspace} client={client!} workspace={workspace} revision={revision} busy={busy} write={write} projectName={id=>projects.find(item=>item.proposal_id===id)?.approved.title??'Projeto'}/>}
   {page==='projetos'&&<SharedProjects projects={projects} leads={commercialData.leads} open={setProjectId}/>}
   {page==='propostas'&&<Proposals data={commercialData} add={()=>setProposalModal({})} open={id=>setProposalModal({id})}/>}
   {(page==='crm'||page==='triagem')&&<CRM key={page} data={commercialData} triage={page==='triagem'} open={id=>select(leads.find(item=>item.id===id))} add={()=>select()}
    start={id=>{select(leads.find(item=>item.id===id));setEditor('triage')}}/>}
   {(page==='crm'||page==='triagem')&&showForm&&<>
    <section className="card panel"><h2>{selected?'Editar estabelecimento':'Cadastrar estabelecimento'}</h2>
     <fieldset disabled={!can(role,'commercial',true)}><form className="pilot-fields" onSubmit={saveLead}>
      <label>Nome<input required value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
      <label>Segmento<input value={draft.segment} onChange={e=>setDraft({...draft,segment:e.target.value})}/></label>
      <label>Cidade<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})}/></label>
      <label>Observações<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label>
      <button className="button primary" disabled={busy}>Salvar estabelecimento</button>
     </form></fieldset>
    </section>
   {lead&&<section className="card panel">
    <h2>Jornada comercial de {lead.name}</h2><p>{lead.stage}{lead.needs?' · '+lead.needs:''}</p>
    {lead.next&&<p>Próxima ação · {lead.next} · {dateLabel(lead.due)}</p>}
    <div className="actions">
     <button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setEditor('triage')}>{selectedTriage?'Editar triagem':'Iniciar triagem'}</button>
     <button className="button" disabled={busy||!can(role,'commercial',true)||loadedLead!==selected} onClick={()=>{setMeeting(undefined);setEditor('meeting')}}>Registrar reunião</button>
     <button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setProposalModal({leadId:lead.id})}>Nova proposta</button>
    </div>
    {loadedLead===selected&&meetings.map(item=><div key={item.id} className="list-item"><div><b>{dateLabel(item.date)} · {item.state}</b><p>{item.summary||item.participants}</p></div><button className="button" disabled={busy} onClick={()=>{setMeeting(item);setEditor('meeting')}}>Editar reunião</button>{item.state==='Realizada'&&<button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setProposalModal({leadId:lead.id,meetingId:item.id})}>Criar proposta</button>}</div>)}
    {proposals.filter(item=>item.leadId===lead.id).map(item=><button key={item.id} className="text-button" onClick={()=>setProposalModal({id:item.id})}>{item.title} · v{item.version} · {item.status}</button>)}
   </section>}
   {selected&&loadedLead===selected&&<div className="dashboard-grid">
    <section className="card panel"><h2>Histórico</h2><fieldset disabled={!can(role,'commercial',true)}>
     <form className="pilot-fields" onSubmit={e=>{e.preventDefault();if(note.trim())void write(()=>client!.from('hub_interactions').insert({workspace_id:workspace,lead_id:selected,body:note.trim()}).select('id').single(),()=>setNote(''))}}>
      <label>Nova interação<textarea required value={note} onChange={e=>setNote(e.target.value)}/></label><button className="button" disabled={busy}>Registrar interação</button>
     </form>
     </fieldset>{interactions.length?<ul>{interactions.map(entry=><li key={entry.id}>{entry.body} · {dateLabel(entry.created_at)}</li>)}</ul>:<p>Sem interações registradas.</p>}
    </section>
    <section className="card panel"><h2>Atividades</h2><fieldset disabled={!can(role,'commercial',true)}>
     <form className="pilot-fields" onSubmit={e=>{e.preventDefault();if(task.trim())void write(()=>client!.from('hub_activities').insert({workspace_id:workspace,lead_id:selected,title:task.trim(),due_on:due||null}).select('id').single(),()=>{setTask('');setDue('')})}}>
      <label>Título<input required value={task} onChange={e=>setTask(e.target.value)}/></label><label>Prazo<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label><button className="button" disabled={busy}>Criar atividade</button>
     </form>
     {tasks.length?<ul>{tasks.map(item=><li key={item.id}><label>{item.title}{item.owner?' · '+item.owner:''}{item.due_on?' · '+dateLabel(item.due_on):''}<select disabled={busy} value={item.status} onChange={e=>void write(()=>client!.from('hub_activities').update({status:e.target.value}).eq('workspace_id',workspace).eq('id',item.id).select('id').single())}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></li>)}</ul>:<p>Sem atividades registradas.</p>}</fieldset>
    </section>
   </div>}
   </>}
   {can(role,'commercial',true)&&lead&&editor==='triage'&&<TriageEditor lead={lead} triage={selectedTriage&&fullTriage(selectedTriage)} team={[]} close={()=>setEditor(null)}
    save={(triage,updatedLead)=>write(()=>saveTriage(client!,workspace,triage,updatedLead),()=>setDraft({...draft,name:updatedLead.name,segment:updatedLead.segment,city:updatedLead.city}))}/>}
   {can(role,'commercial',true)&&lead&&editor==='meeting'&&<MeetingEditor data={meetingContext} item={meeting} leadId={lead.id} lockLead close={()=>setEditor(null)}
    save={(item,follow,advance)=>write(()=>saveMeeting(client!,workspace,item,follow,advance))}/>}
   {proposalModal&&<ProposalEditor readOnly={!can(role,'commercial',true)} financial={can(role,'finance')} canSetPrices={administrator} canAccept={administrator} key={proposalModal.id??proposalModal.meetingId??'new'} data={commercialData}
    item={proposals.find(item=>item.id===proposalModal.id)} leadId={proposalModal.leadId} meetingId={proposalModal.meetingId}
    open={id=>setProposalModal({id})} close={()=>setProposalModal(undefined)}
    project={can(role,'projects',true)?item=>{
     const show=()=>{setProposalModal(undefined);go('projetos');setProjectId(item.id)}
     if(projects.some(project=>project.proposal_id===item.id))show()
     else void write(()=>client!.rpc('hub_open_project',{w:workspace,p:item.id}),show)
    }:undefined} projectExists={id=>projects.some(project=>project.proposal_id===id)}
    save={(item,decision)=>write(()=>saveProposal(client!,workspace,item,decision,administrator))}/>}
   {activeProject&&page==='projetos'&&<SharedProjectEditor readOnly={!can(role,'projects',true)} key={activeProject.proposal_id} item={activeProject}
    close={()=>setProjectId('')} accept={values=>write(()=>client!.rpc('hub_accept_delivery',{
     w:workspace,p:activeProject.proposal_id,c:values.checks,d:values.date,e:values.reference,t:values.title,o:values.owner,due:values.due,
    }))} save={values=>write(()=>client!.from('hub_projects').update(values)
     .eq('workspace_id',workspace).eq('proposal_id',activeProject.proposal_id).select('proposal_id').single())}>
    <ProjectSupport readOnly={!can(role,'projects',true)} client={client!} workspace={workspace} project={activeProject.proposal_id} revision={revision} busy={busy} write={write} projectName={()=>activeProject.approved.title}/>
   </SharedProjectEditor>}
  </>}
 </main></div></div>
}

function PilotDashboard({metrics,finance,leads,projects,proposals,month,setMonth,openFinance}: {
 metrics:PilotMetrics;finance?:Awaited<ReturnType<typeof loadFinance>>;leads:Data['leads'];projects:SharedProject[];proposals:Proposal[];month:string;setMonth:(month:string)=>void;openFinance:()=>void
}) {
 const noNext=leads.filter(lead=>!lead.next.trim()&&!['Ganho','Perdido','Arquivado'].includes(lead.stage)).length
 const lateProjects=projects.filter(project=>project.due_on&&project.due_on<day()&&project.status!=='Entregue').length
 const today=day()
 const decisions=proposals.filter(item=>item.decisionAt?.startsWith(month)&&['Aceita','Recusada'].includes(item.status))
 const wins=decisions.filter(item=>item.status==='Aceita').length
 const billing=finance&&financeMetrics(finance[0].data??[],finance[1].data??[],finance[2].data??[],today,month)
 const overdue=billing?.overdue
 const total=Object.values(metrics.funnel).reduce((sum,count)=>sum+count,0)
 const indicators=[[Users,'Estabelecimentos',total],[CalendarDays,'Reuniões agendadas',metrics.scheduled],
  [ClipboardList,'Diagnósticos realizados',metrics.diagnosed],[ListTodo,'Atividades pendentes',metrics.pending],
  [ListTodo,'Atividades vencidas',metrics.overdue],[Users,'Oportunidades sem próxima ação',noNext],[FolderKanban,'Projetos com prazo vencido',lateProjects]] as const
 return <section>
  <div className="page-heading"><div><h1>Dashboard</h1><p>Visão geral do espaço compartilhado</p></div></div>
  <div className="kpis">{indicators.map(([Icon,label,value])=><article className="metric card" key={label}>
   <div className="metric-top"><span className="tile"><Icon size={19}/></span></div><h2>{label}</h2><strong>{value}</strong>
  </article>)}</div>
  <section className="card panel"><label>Mês de análise <input type="month" value={month} onChange={event=>{if(event.target.value)setMonth(event.target.value)}}/></label>
   <p>Conversão de propostas decididas no mês · {decisions.length?new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1}).format(wins/decisions.length):'Sem decisões'} ({wins} aceitas de {decisions.length})</p>
  </section>
  {billing&&<section className="card panel"><h2>Financeiro do mês selecionado</h2><button className="button" onClick={openFinance}>Abrir financeiro neste mês</button><dl className="dashboard-grid">
   <div><dt>Receita prevista</dt><dd>{money(billing.forecast/100)}</dd></div>
   <div><dt>Receita recebida</dt><dd>{money(billing.received/100)}</dd></div>
   <div><dt>Despesas previstas</dt><dd>{money(billing.expenses/100)}</dd></div>
   <div><dt>Despesas pagas</dt><dd>{money(billing.paidExpenses/100)}</dd></div>
   <div><dt>Saldo atrasado no mês</dt><dd>{money((overdue??0)/100)}</dd></div>
  </dl></section>}
  <div className="dashboard-grid">
   <div className="card panel"><h3>Prioridades</h3><p>A · {metrics.priorities.A??0}　B · {metrics.priorities.B??0}　C · {metrics.priorities.C??0}</p></div>
   <div className="card panel"><h3>Funil comercial</h3>{total===0?<p>Nenhuma oportunidade cadastrada.</p>:
     <ul>{stages.filter(stage=>metrics.funnel[stage]).map(stage=><li key={stage}>{stage} · {metrics.funnel[stage]}</li>)}</ul>}</div>
  </div>
 </section>
}

