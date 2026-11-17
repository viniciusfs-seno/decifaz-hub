import {ManagementHistory} from './management-history'
import {SharedCrmList} from './shared-crm-list'
import {allRows} from './load-all'
import {LeadDetails} from './lead-details'
import {Priority} from './ui'
import './shared-workspace.css'
import {ViewStateProvider} from './view-state'
import {can,hasRole,type Role} from './access'
import {SharedCatalog,loadCatalog,type Solution} from './shared-catalog'
import {ClientPresentation} from './client-presentation'
import {ManagementIndicators} from './management-indicators'
import {WeeklyClosure} from './weekly-closure'
import {Knowledge} from './secondary'
import {Team} from './team'
import {InviteInbox} from './invites'
import {CommercialCenter} from './commercial-center'
import {OperationalDashboard} from './operational-dashboard'
import {OperationalAgenda} from './operational-agenda'
import {OperationalReview} from './operational-review'
import {businessDay,workEntries,type SharedActivity,type WorkEntry,type WorkFilter} from './shared-operational'
import {useEffect,useRef,useState,type FormEvent} from 'react'
import {createClient,type Session} from '@supabase/supabase-js'
import {BookOpen, CalendarDays, ClipboardList, FileCheck2, FolderKanban, LayoutDashboard, ListTodo, Menu, Moon, Sun, Users, Wallet} from 'lucide-react'
import {dateLabel,day,money,stages,type Data,type Meeting,type Proposal} from './domain'
import {MeetingEditor,TriageEditor} from './commercial'
import {ProposalEditor,Proposals} from './proposals'
import {loadFinance,SharedFinance} from './pilot-finance'
import {ProjectSupport,activityStatuses as statuses} from './project-support'
import {loadProjects,SharedProjects,SharedProjectEditor,type SharedProject} from './pilot-projects'
import {fullLead,fullTriage,leadColumns,loadMeetings,loadProposals,saveProposal,saveMeeting,saveTriage,type PilotLead,type TriageRow} from './pilot-journey'

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

const navigation=[
 ['Visão Geral',[['dashboard','Dashboard',LayoutDashboard],['revisao','Revisão semanal',ClipboardList]]],
 ['Comercial',[['central','Central comercial',ListTodo],['crm','Captação e CRM',Users],['triagem','Triagem comercial',ClipboardList],['reunioes','Reuniões e diagnósticos',CalendarDays],['propostas','Propostas comerciais',FileCheck2]]],
 ['Operação',[['agenda','Agenda operacional',CalendarDays],['projetos','Projetos e entregas',FolderKanban]]],
 ['Gestão',[['indicadores','Indicadores',LayoutDashboard],['financeiro','Financeiro',Wallet]]],
 ['Conhecimento',[['conhecimento','Base de conhecimento',BookOpen],['catalogo','Catálogo de soluções',BookOpen]]],
 ['Administração',[['equipe','Equipe',Users]]],
] as const
const sections=navigation.flatMap(([,items])=>[...items])
type Section=typeof sections[number][0]|'equipe'|'convites'

function SharedCrm(){
 const [reportMonth,setReportMonth]=useState(businessDay().slice(0,7))
 const [agendaFilter,setAgendaFilter]=useState<WorkFilter>({})
 const [allActivities,setAllActivities]=useState<SharedActivity[]>([])
 const [loadingData,setLoadingData]=useState(false)
 const loadedWorkspace=useRef('')
 const [page,setPage]=useState<Section>(()=>new URLSearchParams(location.search).has('convite')?'convites':'dashboard')
 const [returnPage,setReturnPage]=useState<Section>('crm')
 const [agendaRequest,setAgendaRequest]=useState(0)
 const [menu,setMenu]=useState(false)
 useEffect(()=>{
  if(!menu)return
  const previous=document.activeElement as HTMLElement|null
  document.querySelector<HTMLElement>('#navegacao-portal nav button')?.focus()
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenu(false)}
  document.addEventListener('keydown',close)
  return ()=>{document.removeEventListener('keydown',close);previous?.focus()}
 },[menu])
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
 const [catalog,setCatalog]=useState<Solution[]>([])
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
  setLeads([]);setTriages([]);setFinance(undefined);setProjects([]);setProposals([]);setProposalMeetings([]);setMeetings([]);setAllActivities([]);setCatalog([]);loadedWorkspace.current=''
  setSelected('');setLoadedLead('');setInteractions([]);setTasks([]);setProjectId('');setProposalModal(undefined);setEditor(null);setMeeting(undefined);setShowForm(false)
 }
 useEffect(()=>{
  const refresh=()=>{void refreshMemberships().then(()=>reload(v=>v+1)).catch(()=>{/* erro visível; não encerrar Auth nem outros espaços */})}
  window.addEventListener('focus',refresh)
  const timer=window.setInterval(refresh,15000)
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
  if(loadedWorkspace.current!==workspace)setReady(false)
  setLoadingData(true)
  if(!can(role,'finance'))setFinance(undefined)
  const activitiesQuery=client!.from('hub_activities').select('id,lead_id,project_proposal_id,title,owner,due_on,status,support,review_kind,review_id').eq('workspace_id',workspace).order('due_on').returns<SharedActivity[]>()
  void Promise.allSettled([allRows(leadsQuery.order('id')),allRows(triagesQuery.order('lead_id')),loadProposals(client!,workspace),loadMeetings(client!,workspace),loadProjects(client!,workspace),can(role,'finance')?loadFinance(client!,workspace):Promise.resolve(undefined),allRows(activitiesQuery.order('id')),loadCatalog(client!,workspace)]).then(results=>{
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
   setProposals(result<{data:Proposal[]}>(2,'Propostas')?.data??[])
   setProposalMeetings(result<{data:Meeting[]}>(3,'Reuniões')?.data??[])
   setProjects(result<{data:SharedProject[]}>(4,'Projetos')?.data??[])
   setAllActivities(result<{data:SharedActivity[]}>(6,'Agenda')?.data??[])
   const financial=result<Awaited<ReturnType<typeof loadFinance>>>(5,'Financeiro')
   if(financial?.some(item=>item.error||!item.data))failures.push('Financeiro')
   setFinance(financial?.some(item=>item.error||!item.data)?undefined:financial)
   setCatalog(result<{data:Solution[]}>(7,'Catálogo')?.data??[])
   setModuleErrors(failures)
   setReady(true)
   loadedWorkspace.current=workspace;setLoadingData(false)
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
 const currentLead=leads.find(lead=>lead.id===selected)
 const selectedTriage=triages.find(row=>row.lead_id===selected)
 const lead=currentLead?fullLead(currentLead):undefined
 const commercialData:Data={version:1,leads:leads.map(fullLead),triages:triages.map(fullTriage),meetings:proposalMeetings,activities:[],proposals,projects:[],finance:[],team:[...new Set(leads.map(item=>item.profile.owner).filter((owner):owner is string=>Boolean(owner)))]}
 const meetingContext={...commercialData,leads:lead?[lead]:[],team:[]}
 const activeProject=projects.find(item=>item.proposal_id===projectId)
 const entries=workEntries(commercialData.leads,allActivities,proposalMeetings,projects)
 function openLead(id:string){const item=leads.find(l=>l.id===id);if(item){setReturnPage(page);go('crm');select(item)}}
 function openProject(id:string){setReturnPage(page);go('projetos');setProjectId(id)}
 function openEntry(entry:WorkEntry){if(entry.projectId)openProject(entry.projectId);else openLead(entry.leadId)}
 function openAgenda(filter:WorkFilter){go('agenda');setAgendaFilter(filter);setAgendaRequest(n=>n+1)}
 const pageLabel=page==='convites'?'Meus convites':page==='equipe'?'Administração / Equipe':sections.find(([id])=>id===page)?.[1]
 const signOut=()=>void client!.auth.signOut().then(({error})=>{if(error)setError('Não foi possível sair. Tente novamente.')})
 return <div className="app shared-app">
  {menu&&<button className="mobile-scrim" aria-label="Fechar navegação" onClick={()=>setMenu(false)}/>}
  <a className="skip-link" href="#conteudo">Ir para o conteúdo</a>
  <aside id="navegacao-portal" className={'sidebar '+(menu?'open':'')}>
   <button className="brand" onClick={()=>go(workspace?'dashboard':'convites')}><img className="brand-logo" src={import.meta.env.BASE_URL+'identidade/assinatura-horizontal-escuro-selo.svg'} alt="Decifaz"/><small>Portal de trabalho</small></button>
   <nav aria-label="Navegação principal">{workspace&&navigation.map(([label,links])=>{const visible=links.filter(([id])=>(id!=='financeiro'||can(role,'finance'))&&(id!=='equipe'||administrator));return visible.length?<div className="nav-group" key={label}><h2>{label}</h2>{visible.map(([id,title,Icon])=><button key={id} aria-current={page===id?'page':undefined} onClick={()=>go(id)}><Icon size={17}/><span>{title}</span></button>)}</div>:null})}<div className="nav-group"><h2>Acesso</h2><button aria-current={page==='convites'?'page':undefined} onClick={()=>go('convites')}><Users size={17}/><span>Meus convites</span></button></div></nav>
  </aside>
  <div className="workspace" inert={menu}><header className="topbar">
   <div className="crumb"><button className="icon mobile-menu" aria-label="Abrir navegação" aria-controls="navegacao-portal" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={21}/></button><button className="text-button home-link" onClick={()=>go(workspace?'dashboard':'convites')}>Decifaz Hub</button><span className="slash">/</span><b>{pageLabel}</b></div>
   <div className="header-actions">{spaces.length>1&&<label className="space-switcher"><span>Espaço de trabalho</span><select disabled={busy} value={workspace} onChange={e=>{setReady(false);setError('');clearWorkspaceData();setWorkspace(e.target.value);setPage('dashboard')}}>{spaces.map(space=><option key={space.id} value={space.id}>{space.name}</option>)}</select></label>}<button className="icon theme" onClick={()=>setDark(!dark)} aria-label={dark?'Ativar tema claro':'Ativar tema escuro'}>{dark?<Sun size={19}/>:<Moon size={18}/>}</button><button className="button compact" disabled={busy} onClick={signOut}>Sair</button></div>
  </header>
  <ViewStateProvider key={workspace}><main className="pilot" id="conteudo" tabIndex={-1}>
   <div className="workspace-strip row-between"><p><span className="live-dot" aria-hidden="true"/> {spaces.find(space=>space.id===workspace)?.name??'Decifaz Hub'}</p><div className="actions">{loadingData&&ready&&<small role="status">Atualizando dados…</small>}<button className="button compact" disabled={busy||!workspace} onClick={()=>{setError('');void refreshMemberships().then(()=>reload(v=>v+1)).catch(()=>{})}}>Atualizar</button></div></div>
  {error&&<p role="alert">{error}</p>}
  {moduleErrors.map(label=><p role="alert" key={label}>{label}: não foi possível carregar. Os demais módulos continuam disponíveis.</p>)}
  {notice&&<p role="status">{notice}</p>}
  {!ready&&!error&&<p role="status">Carregando o CRM…</p>}
  {page==='convites'&&<InviteInbox client={client!} onAccepted={refreshMemberships}/>}
  {ready&&workspace&&<>
   {page==='equipe'&&(administrator?<Team key={workspace} client={client!} workspace={workspace} onSaved={refreshMemberships} sendInviteLink={sendInviteLink}/>:<p role="alert">Seu papel não permite gerir a equipe deste espaço.</p>)}

   {page==='dashboard'&&<OperationalDashboard key={workspace} data={commercialData} entries={entries} projects={projects} errors={moduleErrors} finance={finance} financial={can(role,'finance')} month={reportMonth} setMonth={setReportMonth} openLead={openLead} openProject={openProject} openEntry={openEntry} openAgenda={openAgenda} openFinance={()=>go('financeiro')} addLead={()=>{setReturnPage('dashboard');go('crm');select()}}/>}
   {page==='revisao'&&<WeeklyClosure revision={revision} client={client!} workspace={workspace} admin={administrator} leads={commercialData.leads} tasks={allActivities} onSaved={()=>reload(v=>v+1)} openLead={openLead}/>}
   {page==='indicadores'&&<ManagementIndicators history={filter=><ManagementHistory client={client!} workspace={workspace} filter={filter}/>} data={commercialData} projects={projects} tasks={allActivities} forecasts={finance?.[0].data??[]} receipts={finance?.[1].data??[]} financial={can(role,'finance')&&!!finance} openLead={openLead} openProject={openProject}/>}
   {page==='revisao'&&<OperationalReview data={commercialData} projects={projects} activities={allActivities} busy={busy} allowed={kind=>can(role,kind==='project'?'projects':'commercial',true)} openLead={openLead} openProject={openProject} openProposal={id=>setProposalModal({id})} save={(origin,title,owner,due)=>write(()=>client!.rpc('hub_review_action',{w:workspace,k:origin.kind,s:origin.id,t:title,o:owner,d:due}))}/>}
   {page==='central'&&<CommercialCenter key={workspace} client={client!} workspace={workspace} revision={revision}
    leads={commercialData.leads} meetings={proposalMeetings}
    openLead={openLead} openProject={openProject}/>}
   {page==='catalogo'&&<SharedCatalog items={catalog} admin={administrator} save={async draft=>{const r=await client!.rpc('hub_save_solution',{w:workspace,i:draft.id??null,n:draft.name,c:draft.category,d:draft.description,items:draft.scope_items?.filter(s=>s.trim()),enabled:draft.active,expected_revision:draft.revision??null});if(r.error)return;reload(v=>v+1);return r.data}}/>}
   {page==='conhecimento'&&<Knowledge download={false} go={()=>go('reunioes')}/>}
   {page==='financeiro'&&!can(role,'finance')&&<p role="status">Seu papel não permite acesso ao Financeiro.</p>}
   {page==='financeiro'&&can(role,'finance')&&finance&&<SharedFinance key={workspace} client={client!} workspace={workspace} projects={projects} forecasts={finance[0].data??[]} receipts={finance[1].data??[]} expenses={finance[2].data??[]} month={reportMonth} setMonth={setReportMonth} audit={finance[3].data??[]} busy={busy} write={write}/>}
   {(page==='agenda'||page==='reunioes')&&<OperationalAgenda key={workspace+page} request={agendaRequest} entries={entries} leads={commercialData.leads} initial={page==='reunioes'?{kind:'meeting',state:'all'}:agendaFilter} title={page==='reunioes'?'Reuniões e diagnósticos':'Agenda operacional'} open={openEntry} busy={busy} canChange={entry=>can(role,entry.projectId?'projects':'commercial',true)} change={(entry,status)=>void write(()=>client!.from('hub_activities').update({status}).eq('workspace_id',workspace).eq('id',entry.id).select('id').single())}/>}
   {page==='projetos'&&<SharedProjects projects={projects} leads={commercialData.leads} open={id=>{setReturnPage('projetos');setProjectId(id)}}/>}
   {page==='propostas'&&<Proposals data={commercialData} add={()=>setProposalModal({})} open={id=>setProposalModal({id})}/>}
   {(page==='crm'||page==='triagem')&&!showForm&&<SharedCrmList key={workspace+page} client={client!} workspace={workspace} revision={revision} data={commercialData} triage={page==='triagem'} open={item=>{setReturnPage(page);setLeads(rows=>[...rows.filter(l=>l.id!==item.id),item]);select(item)}} add={()=>{setReturnPage(page);select()}} start={item=>{setReturnPage(page);setLeads(rows=>[...rows.filter(l=>l.id!==item.id),item]);select(item);setEditor('triage')}}/>}
   {(page==='crm'||page==='triagem')&&showForm&&<>
    <div className="dossier-context"><button className="button" onClick={()=>{setShowForm(false);setSelected('');setEditor(null);go(returnPage)}}>← Voltar {returnPage==='agenda'?'à agenda':returnPage==='indicadores'?'aos indicadores':returnPage==='central'?'à Central comercial':returnPage==='reunioes'?'às reuniões':returnPage==='triagem'?'à triagem':returnPage==='dashboard'?'ao Dashboard':'à lista'}</button><span>{lead?.name??'Novo estabelecimento'} · {lead?.stage??'Cadastro'}</span></div>
    <details className="card panel op-basics" open={!selected}><summary><h2>{selected?'Editar dados do estabelecimento':'Cadastrar estabelecimento'}</h2></summary>
     <LeadDetails key={workspace+':'+selected} lead={currentLead} solutions={catalog} allowed={can(role,'commercial',true)} save={async(body,expected)=>{const r=await client!.rpc('hub_save_lead',{w:workspace,l:selected||null,expected_revision:expected,body});if(r.error)return;return r.data}} onSaved={item=>{setNotice('Ficha salva.');setLeads(rows=>[...rows.filter(l=>l.id!==item.id),item]);select(item);reload(v=>v+1)}}/>
    </details>
   {lead&&<section className="card panel">
    <div className="op-dossier-head"><div><span className="op-eyebrow">FICHA DO ESTABELECIMENTO</span><h2>Jornada comercial de {lead.name}</h2><p>{lead.segment||'Segmento não informado'} · {lead.city||'Cidade não informada'}</p></div><div className="actions"><span className="tag">{lead.stage}</span><Priority triage={selectedTriage&&fullTriage(selectedTriage)}/></div></div>
    <div className="op-journey" aria-label="Etapas da jornada">{[['Cadastro',true],['Triagem',!!selectedTriage?.completed],['Reunião',meetings.some(m=>m.state==='Realizada')],['Proposta',proposals.some(p=>p.leadId===lead.id)],['Projeto',projects.some(p=>p.lead_id===lead.id)],['Pós-venda',allActivities.some(a=>a.lead_id===lead.id&&a.support)]].map(([label,done])=><span key={String(label)} data-done={done}>{done?'✓':'○'} {label}</span>)}</div>
    <dl className="lead-contact-summary"><div><dt>Contato no estabelecimento</dt><dd>{lead.contact||'Não informado'}{lead.contactInfo?' · '+lead.contactInfo:''}</dd></div><div><dt>Canais</dt><dd>{[lead.whatsapp,lead.instagram,lead.website,lead.other].filter(Boolean).join(' · ')||'Não informados'}</dd></div><div><dt>Localização</dt><dd>{[lead.address,lead.region,lead.city].filter(Boolean).join(' · ')||'Não informada'}</dd></div><div><dt>Origem e verificação</dt><dd>{[lead.origin,lead.verification].filter(Boolean).join(' · ')||'Não informadas'}</dd></div></dl>
    {lead.needs&&<p>{lead.needs}</p>}
    {lead.next&&<p>Próxima ação · {lead.next} · {dateLabel(lead.due)}</p>}
    <div className="actions">
     <button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setEditor('triage')}>{selectedTriage?'Editar triagem':'Iniciar triagem'}</button>
     <button className="button" disabled={busy||!can(role,'commercial',true)||loadedLead!==selected} onClick={()=>{setMeeting(undefined);setEditor('meeting')}}>Registrar reunião</button>
     <button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setProposalModal({leadId:lead.id})}>Nova proposta</button>
    </div>
    <div className="op-dossier-links">{proposals.filter(p=>p.leadId===lead.id).map(p=><button className="card" key={p.id} onClick={()=>setProposalModal({id:p.id})}><small>Proposta · versão {p.version}</small><b>{p.title}</b><span>{p.status}</span></button>)}{projects.filter(p=>p.lead_id===lead.id).map(p=><button className="card" key={p.proposal_id} onClick={()=>openProject(p.proposal_id)}><small>Projeto · {p.status}</small><b>{p.approved.title}</b><span>{p.owner||'Sem responsável'} · {dateLabel(p.due_on??'')}</span><span>{allActivities.filter(a=>a.project_proposal_id===p.proposal_id&&a.support).length} chamados de pós-venda</span></button>)}</div>
    {loadedLead===selected&&meetings.map(item=><div key={item.id} className="list-item"><div><b>{dateLabel(item.date)} · {item.state}</b><p>{item.summary||item.participants}</p></div><button className="button" disabled={busy} onClick={()=>{setMeeting(item);setEditor('meeting')}}>Editar reunião</button>{item.state==='Realizada'&&<button className="button" disabled={busy||!can(role,'commercial',true)} onClick={()=>setProposalModal({leadId:lead.id,meetingId:item.id})}>Criar proposta</button>}</div>)}
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
   {can(role,'commercial',true)&&lead&&editor==='triage'&&<TriageEditor solutionOptions={catalog.filter(s=>s.active).map(s=>s.name)} lead={lead} triage={selectedTriage&&fullTriage(selectedTriage)} team={[]} close={()=>setEditor(null)}
    save={(triage,updatedLead)=>write(()=>saveTriage(client!,workspace,triage,updatedLead),()=>setDraft({...draft,name:updatedLead.name,segment:updatedLead.segment,city:updatedLead.city}))}/>}
   {can(role,'commercial',true)&&lead&&editor==='meeting'&&<MeetingEditor solutionOptions={catalog.filter(s=>s.active).map(s=>s.name)} presentation={<ClientPresentation lead={lead} meeting={meeting} solutions={catalog} proposals={proposals} financial={can(role,'finance')}/>} data={meetingContext} item={meeting} leadId={lead.id} lockLead close={()=>setEditor(null)}
    save={(item,follow,advance)=>write(()=>saveMeeting(client!,workspace,item,follow,advance))}/>}
   {proposalModal&&<ProposalEditor catalog={catalog} readOnly={!can(role,'commercial',true)} financial={can(role,'finance')} canSetPrices={administrator} canAccept={administrator} key={proposalModal.id??proposalModal.meetingId??'new'} data={commercialData}
    item={proposals.find(item=>item.id===proposalModal.id)} leadId={proposalModal.leadId} meetingId={proposalModal.meetingId}
    open={id=>setProposalModal({id})} close={()=>setProposalModal(undefined)}
    project={can(role,'projects',true)?item=>{
     const show=()=>{setReturnPage(page);setProposalModal(undefined);go('projetos');setProjectId(item.id)}
     if(projects.some(project=>project.proposal_id===item.id))show()
     else void write(()=>client!.rpc('hub_open_project',{w:workspace,p:item.id}),show)
    }:undefined} projectExists={id=>projects.some(project=>project.proposal_id===id)}
    save={(item,decision)=>write(()=>saveProposal(client!,workspace,item,decision,administrator))}/>}
   {activeProject&&page==='projetos'&&<SharedProjectEditor readOnly={!can(role,'projects',true)} key={activeProject.proposal_id} item={activeProject}
    close={()=>{setProjectId('');if(returnPage!=='projetos')go(returnPage)}} accept={values=>write(()=>client!.rpc('hub_accept_delivery',{
     w:workspace,p:activeProject.proposal_id,c:values.checks,d:values.date,e:values.reference,t:values.title,o:values.owner,due:values.due,
    }))} save={values=>write(()=>client!.from('hub_projects').update(values)
     .eq('workspace_id',workspace).eq('proposal_id',activeProject.proposal_id).select('proposal_id').single())}>
    <ProjectSupport readOnly={!can(role,'projects',true)} client={client!} workspace={workspace} project={activeProject.proposal_id} revision={revision} busy={busy} write={write} projectName={()=>activeProject.approved.title}/>
   </SharedProjectEditor>}
  </>}
 </main></ViewStateProvider></div></div>
}
