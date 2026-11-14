import {SupportView} from './support-view'
import {createRoot} from 'react-dom/client'
import {useEffect,useRef,useState} from 'react'
import {ArrowRight,BookOpen,BriefcaseBusiness,CalendarDays,ChartNoAxesCombined,ChevronDown,ClipboardList,Download,FileCheck2,FolderKanban,LayoutDashboard,ListTodo,Menu,Moon,PanelTop,Search,Settings,Sun,Users,Wallet,X} from 'lucide-react'
import {dateLabel,day,event,norm,stages,upsert,type Activity,type Data,type Lead,type Meeting,type Triage} from './domain'
import {browserRepository,exportData,seed} from './repository'
import {ActivityEditor,ActivityList,CRM,LeadEditor,MeetingEditor,MeetingList,TriageEditor} from './commercial'
import {Dashboard} from './dashboard'
import {Agenda} from './agenda'
import {withCompletion} from './review-summary'
import {WeeklyReview} from './weekly-review'
import {pendingReviewAction,reviewActionDraft} from './review-actions'
import type {ReviewItem} from './review-data'
import {Catalog,Knowledge,SecondaryEditor,SecondaryList,type SecondaryKind} from './secondary'
import {Dialog,Page,Priority,Tag} from './ui'
import {ProposalEditor,Proposals} from './proposals'
import {applyProposal,type ProposalDecision} from './proposal-rules'
import {saveReceivable} from './receivables'
import {ReceivableEditor} from './receivable-editor'
import type {Finance,Proposal,Project} from './domain'
import {ProjectEditor} from './projects'
import {saveProjectRecord} from './handoff'
import {StaleDataError,storageKey} from './backup-storage'
import {BackupPanel} from './backup-panel'
import './style.css'

const groups=[
 ['Visão geral',[['dashboard','Dashboard',LayoutDashboard],['agenda','Agenda operacional',CalendarDays],['revisao','Revisão semanal',ClipboardList]]],
 ['Comercial',[['crm','Captação e CRM',Users],['triagem','Triagem comercial',ClipboardList],['reunioes','Reuniões e diagnósticos',CalendarDays],['atividades','Atividades',ListTodo],['propostas','Propostas comerciais',FileCheck2]]],
 ['Operação',[['projetos','Projetos e entregas',FolderKanban],['suporte','Suporte',ListTodo],['catalogo','Catálogo de soluções',PanelTop]]],
 ['Gestão',[['financeiro','Financeiro',Wallet],['indicadores','Indicadores e relatórios',ChartNoAxesCombined]]],
 ['Conhecimento',[['manuais','Manuais e procedimentos',BookOpen],['scripts','Scripts comerciais',BriefcaseBusiness],['modelos','Modelos e checklists',ClipboardList]]],
 ['Administração',[['equipe','Equipe e responsabilidades',Users],['configuracoes','Configurações',Settings]]],
] as const
const nav=groups.flatMap(([,links])=>[...links])
const route=()=>{const hash=location.hash.slice(1).split('?')[0];return nav.some(([p])=>p===hash)?hash:'dashboard'}
type Modal={type:string;id?:string;leadId?:string;meetingId?:string;projectId?:string;postSale?:boolean;draft?:Activity}
function App(){
 const [load]=useState(()=>{
  let raw:string|null=null
  try{
   raw=browserRepository.read()
   const stored=browserRepository.load(raw)
   return {data:stored?.data??seed(),undo:stored?.undo,raw,error:''}
  }catch{return {data:seed(),undo:undefined,raw,error:'Os dados locais não puderam ser lidos. Restaure um backup válido para recuperar o acesso.'}}
 })
 const [data,setData]=useState(load.data)
 const [undoCopy,setUndoCopy]=useState(load.undo)
 const [loadError,setLoadError]=useState(load.error)
 const [stale,setStale]=useState(false)
 const raw=useRef(load.raw)
 const [page,setPage]=useState(route)
 const [modal,setModal]=useState<Modal>()
 const [focus,setFocus]=useState('')
 const [search,setSearch]=useState('')
 const [menu,setMenu]=useState(false)
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem('decifaz-theme')==='dark'}catch{return false}})
 const [notice,setNotice]=useState<{text:string;error?:boolean}>()
 const [staff,setStaff]=useState('')
 const [note,setNote]=useState('')
 useEffect(()=>{const sync=()=>{setPage(route());setFocus('');setModal(undefined);window.scrollTo(0,0)};window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[])
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('decifaz-theme',dark?'dark':'light')}catch{/* tema ainda funciona em memória */}},[dark])
 useEffect(()=>{if(notice&&!notice.error){const timer=setTimeout(()=>setNotice(undefined),4000);return()=>clearTimeout(timer)}},[notice])
 const go=(p:string)=>{setFocus('');setModal(undefined);setMenu(false);setSearch('');if(p!==page)location.hash=p;else window.scrollTo(0,0)}
 const open=(id:string)=>{setNote('');setSearch('');setFocus(id)}
 const close=()=>setModal(undefined)
 const editing=(type:string,id?:string,leadId?:string,meetingId?:string,projectId?:string,postSale?:boolean)=>setModal({type,id,leadId,meetingId,projectId,postSale})
 useEffect(()=>{
  function detect(event:StorageEvent){
   if(event.storageArea===localStorage&&(event.key===storageKey||event.key===null)&&browserRepository.read()!==raw.current)setStale(true)
  }
  window.addEventListener('storage',detect)
  return ()=>window.removeEventListener('storage',detect)
 },[])
 function applyBackup(operation:'restore'|'undo',next?:Data){
  try{
   const saved=operation==='restore'&&next?browserRepository.restore(raw.current,next,data):browserRepository.undo(raw.current)
   raw.current=saved.raw
   setData(saved.data);setUndoCopy(saved.undo);setLoadError('');setFocus('');setModal(undefined);setSearch('')
   setNotice({text:operation==='undo'?'Restauração desfeita.':'Backup restaurado.'})
   return true
  }catch(error){if(error instanceof StaleDataError)setStale(true);return false}
 }
 const commit=(next:Data,message:string)=>{
  if(stale){setNotice({text:'Recarregue a página para obter os dados da outra aba.',error:true});return false}
  if(loadError){setNotice({text:loadError,error:true});return false}
  try{raw.current=browserRepository.save(raw.current,next).raw;setData(next);setNotice({text:message});return true}
  catch(error){if(error instanceof StaleDataError)setStale(true);setNotice({text:'Não foi possível salvar neste navegador. As mudanças continuam no formulário.',error:true});return false}
 }
 const addHistory=(leads:Lead[],id:string,message:string,actor?:string)=>leads.map(l=>l.id===id?{...l,history:[event(message,actor||l.owner),...l.history]}:l)
 function saveLead(l:Lead,reason:string){
  const old=data.leads.find(x=>x.id===l.id)
  const message=old?old.stage!==l.stage?old.stage+' → '+l.stage+' · '+reason:'Ficha atualizada':'Estabelecimento cadastrado'+(reason?' · '+l.stage+' · '+reason:'')
  if(!commit({...data,leads:upsert(data.leads,{...l,history:[event(message,l.owner),...l.history]})},'Lead salvo.'))return false
  open(l.id);return true
 }
 function saveTriage(t:Triage,l:Lead){
  const old=data.leads.find(x=>x.id===l.id)!
  const score=t.completed?'Triagem concluída':'Rascunho de triagem salvo'
  const history=[event(score+(old.stage!==l.stage?' · '+old.stage+' → '+l.stage:''),t.owner||l.owner),...old.history]
  return commit({...data,triages:[t,...data.triages.filter(x=>x.leadId!==l.id)],leads:upsert(data.leads,{...l,history})},score+'.')
 }
 function createReviewAction(item:ReviewItem){
  const draft=reviewActionDraft(data,item)
  const existing=draft.reviewSource&&pendingReviewAction(data.activities,draft.reviewSource)
  if(existing)editing('activity',existing.id)
  else setModal({type:'activity',draft})
 }
 function saveActivity(a:Activity){
  const duplicate=a.reviewSource&&pendingReviewAction(data.activities.filter(item=>item.id!==a.id),a.reviewSource)
  if(duplicate&&a.status!=='Concluída'&&a.status!=='Cancelada'){
   setNotice({text:'Já existe uma atividade aberta para esta pendência.',error:true})
   return false
  }
  const old=data.activities.find(x=>x.id===a.id)
  const text=(a.status==='Concluída'?'Atividade concluída: ':old?'Atividade atualizada: ':'Atividade criada: ')+a.title
  return commit({...data,activities:upsert(data.activities,withCompletion(a,old)),leads:addHistory(data.leads,a.leadId,text,a.owner)},'Atividade salva.')
 }
 function saveMeeting(m:Meeting,follow:boolean,update:boolean){
  const l=data.leads.find(l=>l.id===m.leadId)!
  const stage=m.state==='Realizada'?'Diagnóstico realizado':'Reunião marcada'
  const advance=update&&stages.indexOf(l.stage)<stages.indexOf(stage)
  let leads=upsert(data.leads,{...l,stage:advance?stage:l.stage,needs:m.state==='Realizada'?m.summary:l.needs,...(m.state!=='Cancelada'&&m.next.trim()&&m.due?{next:m.next,due:m.due}:{}),history:[event('Reunião '+m.state.toLowerCase()+' · '+dateLabel(m.date)+(advance?' · '+l.stage+' → '+stage:''),m.owner||l.owner),...l.history]})
  const followId='follow-'+m.id
  const existing=data.activities.find(a=>a.id===followId)
  const activities=follow?upsert(data.activities,{id:followId,leadId:m.leadId,projectId:'',title:m.next,description:'Acompanhamento da reunião de '+dateLabel(m.date),kind:'Follow-up',owner:m.owner,due:m.due,priority:'Normal',status:existing?.status??'Pendente',result:existing?.result??''}):data.activities
  if(follow)leads=addHistory(leads,m.leadId,(existing?'Acompanhamento atualizado: ':'Acompanhamento criado: ')+m.next,m.owner)
  return commit({...data,leads,activities,meetings:upsert(data.meetings,m)},'Reunião salva.')
 }
 function saveProposal(p:Proposal,decision?:ProposalDecision){
  const result=applyProposal(data,p,decision)
  if('error'in result){setNotice({text:result.error,error:true});return false}
  return commit(result.data,result.message)
 }
 function saveProject(project:Project){
  const result=saveProjectRecord(data,project)
  if('error'in result)return result.error
  if(!commit(result.data,'Projeto salvo.'))return 'Não foi possível salvar o projeto neste navegador.'
 }
 function saveFinance(entry:Finance){
  const result=saveReceivable(data,entry)
  if('error'in result)return result.error
  const previous=data.finance.find(f=>f.id===entry.id)
  const action=entry.state==='Realizado'&&previous?.state!=='Realizado'?'Baixa registrada':previous?.state==='Realizado'&&entry.state==='Previsto'?'Baixa revertida':entry.origin&&!previous?'Previsão de recebimento criada':'Lançamento salvo'
  if(!commit({...data,finance:result.finance,leads:addHistory(data.leads,entry.leadId,action+': '+entry.title)},action+'.'))return 'Não foi possível salvar neste navegador.'
 }
 const selected=data.leads.find(l=>l.id===focus)
 const bound=data.leads.find(l=>l.id===modal?.leadId)
 const triage=data.triages.find(t=>t.leadId===focus)
 const pageLabel=nav.find(([p])=>p===page)?.[1]??'Dashboard'
 const matches=data.leads.filter(l=>norm(l.name+' '+l.city).includes(norm(search.trim()))).slice(0,6)
 const scoped=<>
 {selected&&<Dialog title={selected.name} subtitle={selected.segment+' · '+selected.city} onClose={()=>setFocus('')} wide><div className="dialog-body">
 <div className="actions"><Tag>{selected.stage}</Tag><Priority triage={triage}/>{selected.demo&&<Tag tone="amber">Registro fictício</Tag>}</div>
 <div className="lead-summary"><div><span>Responsável</span><b>{selected.owner}</b></div><div><span>Próxima ação</span><b>{selected.next||'—'}</b></div><div><span>Prazo</span><b>{selected.due?dateLabel(selected.due):selected.noDueReason||'—'}</b></div><div><span>Verificação</span><b>{selected.verification}</b></div></div>
 {[['Localização',[selected.address,selected.region].filter(Boolean).join(' · ')],['Canais',[selected.instagram,selected.website,selected.whatsapp,selected.other].filter(Boolean).join(' · ')],['Responsável no estabelecimento',[selected.contact,selected.contactInfo].filter(Boolean).join(' · ')],['Origem',selected.origin],['Necessidades',selected.needs],['Observações',selected.notes],['Soluções',selected.services.join(', ')],['Abordagem sugerida',triage?.approach]].map(([label,value])=>value?<p className="details-line" key={label}><b>{label}</b> {value}</p>:null)}
 <div className="actions detail-actions"><button className="button primary" onClick={()=>editing('triage',undefined,selected.id)}>{triage?'Abrir triagem':'Iniciar triagem'}</button><button className="button" onClick={()=>editing('lead',selected.id)}>Editar ficha e etapa</button><button className="button" onClick={()=>editing('activity',undefined,selected.id)}>Criar atividade</button><button className="button" onClick={()=>editing('meeting',undefined,selected.id)}>Registrar reunião</button><button className="button" onClick={()=>editing('propostas',undefined,selected.id)}>Nova proposta</button></div>
 <h3>Registros vinculados</h3><div className="linked">{[...data.activities.filter(x=>x.leadId===selected.id).map(x=>({id:x.id,text:'Atividade · '+x.title,type:'activity'})),...data.meetings.filter(x=>x.leadId===selected.id).map(x=>({id:x.id,text:'Reunião · '+dateLabel(x.date)+' · '+x.state,type:'meeting'})),...data.proposals.filter(x=>x.leadId===selected.id).map(x=>({id:x.id,text:'Proposta · '+x.title+' · v'+x.version,type:'propostas'})),...data.projects.filter(x=>x.leadId===selected.id).map(x=>({id:x.id,text:'Projeto · '+x.title,type:'projetos'})),...data.finance.filter(x=>x.leadId===selected.id).map(x=>({id:x.id,text:'Financeiro · '+x.title,type:'financeiro'}))].map(v=><button className="text-button" key={v.type+v.id} onClick={()=>editing(v.type,v.id,selected.id)}>{v.text}<ArrowRight size={15}/></button>)}</div>
 <h3>Histórico de interações</h3><form className="note-form" onSubmit={e=>{e.preventDefault();if(note.trim()&&commit({...data,leads:addHistory(data.leads,selected.id,note.trim())},'Interação registrada.'))setNote('')}}><input aria-label="Nova interação" placeholder="Registrar retorno, contato ou evidência..." value={note} onChange={e=>setNote(e.target.value)} required/><button className="button" disabled={!note.trim()}>Registrar</button></form><ol className="timeline">{selected.history.map((h,i)=><li key={h.at+i}><b>{h.text}</b><small>{new Date(h.at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} · {h.actor}</small></li>)}</ol>
 </div></Dialog>}
 </>
 const secondary=modal?.type==='financeiro'
 const billingProject=modal?.type==='previsao'?data.projects.find(p=>p.id===modal.projectId):undefined
 const billingProposal=data.proposals.find(p=>p.id===billingProject?.proposalId&&p.status==='Aceita')
 const item=data.finance.find(x=>x.id===modal?.id)
 return <div className="app">
 {menu&&<button className="mobile-scrim" aria-label="Fechar navegação" onClick={()=>setMenu(false)}/>}
 <aside className={'sidebar '+(menu?'open':'')}><button className="brand" onClick={()=>go('dashboard')}><img className="brand-logo" src={import.meta.env.BASE_URL+'identidade/assinatura-horizontal-escuro-selo.svg'} alt="Decifaz"/><small>Hub · Portal interno</small></button><nav aria-label="Navegação principal">{groups.map(([group,links])=><div className="nav-group" key={group}><h2>{group}</h2>{links.map(([p,label,Icon])=><button key={p} aria-current={page===p?'page':undefined} onClick={()=>go(p)}><Icon size={17}/><span>{label}</span></button>)}</div>)}</nav><div className="sidebar-footer"><button onClick={()=>go('equipe')}><img className="avatar brand-avatar" src={import.meta.env.BASE_URL+'identidade/simbolo-selo.svg'} alt=""/><span><b>Equipe Decifaz</b><small>Ambiente local</small></span><ChevronDown size={15}/></button></div></aside>
 <div className="workspace"><header className="topbar"><div className="crumb"><button className="icon mobile-menu" aria-label="Abrir navegação" onClick={()=>setMenu(!menu)}><Menu size={21}/></button><span>Decifaz Hub</span><span className="slash">/</span><b>{pageLabel}</b></div><div className="header-actions"><div className="global-search"><label className="search"><Search size={17}/><input aria-label="Busca global de leads" placeholder="Buscar lead..." value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')setSearch('');if(e.key==='Enter'&&search.trim()&&matches[0])open(matches[0].id)}}/>{search&&<button className="icon" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={15}/></button>}</label>{search.trim()&&<div className="search-results card">{matches.length?matches.map(l=><button key={l.id} onClick={()=>open(l.id)}>{l.name}<ArrowRight size={14}/></button>):<p>Nenhum lead encontrado.</p>}</div>}</div><button className="icon theme" onClick={()=>setDark(!dark)} aria-label={dark?'Ativar tema claro':'Ativar tema escuro'}>{dark?<Sun size={19}/>:<Moon size={18}/>}</button></div></header>
 <main><div className="demo-notice"><Tag tone="amber">Demonstração</Tag><span>Dados fictícios · Alterações salvas neste navegador</span></div>{stale&&<div className="callout" role="alert"><p>Os dados mudaram em outra aba. Recarregue para continuar. Formulários ainda abertos podem ter alterações não salvas.</p><button className="button" onClick={()=>location.reload()}>Recarregar dados</button></div>}{loadError&&<div className="error" role="alert">{loadError}</div>}
 {page==='revisao'&&<WeeklyReview data={data} open={item=>editing(item.target,item.id)} createAction={createReviewAction} openActivity={id=>editing('activity',id)} saveClosure={next=>commit(next,'Fechamento semanal registrado.') }/>}
 {page==='agenda'&&<Agenda data={data} open={entry=>editing(entry.kind,entry.id)}/>}
 {(page==='dashboard'||page==='indicadores')&&<Dashboard key={page} data={data} open={open} go={go} add={()=>editing('lead')} reports={page==='indicadores'}/>}
 {(page==='crm'||page==='triagem')&&<CRM key={page} data={data} open={open} add={()=>editing('lead')} triage={page==='triagem'} start={id=>editing('triage',undefined,id)}/>}
 {page==='suporte'&&<SupportView key={location.hash} initialOverdue={location.hash==='#suporte?vencidos'} activities={data.activities} leads={data.leads} open={id=>editing('activity',id)}/>}
 {page==='atividades'&&<ActivityList data={data} add={()=>editing('activity')} edit={id=>editing('activity',id)} done={id=>{const a=data.activities.find(a=>a.id===id);if(a)saveActivity({...a,status:'Concluída'})}}/>}
 {page==='reunioes'&&<MeetingList data={data} add={()=>editing('meeting')} edit={id=>editing('meeting',id)} propose={(id,leadId)=>editing('propostas',undefined,leadId,id)}/>}
 {(page==='projetos'||page==='financeiro')&&<SecondaryList key={page} kind={page} data={data} add={()=>editing(page)} edit={id=>editing(page,id)}/>}
 {page==='propostas'&&<Proposals data={data} add={()=>editing('propostas')} open={id=>editing('propostas',id)}/>}
 {page==='catalogo'&&<Catalog leadCount={s=>data.leads.filter(l=>l.services.includes(s)).length}/>}
 {(['manuais','scripts','modelos']).includes(page)&&<Knowledge key={page} category={page==='scripts'?'Scripts':page==='modelos'?'Modelos':''} go={go}/>}
 {page==='equipe'&&<Page title="Equipe e responsabilidades" description="Cadastre responsáveis para distribuir o trabalho durante a demonstração."><div className="card panel"><h2>Responsáveis locais</h2><p className="muted">Estes nomes são rótulos usados nos registros. Os papéis e acessos de produção serão definidos com a equipe.</p><div className="team-list">{data.team.map(name=><div key={name}><span className="avatar">{name[0]}</span><b>{name}</b><Tag>{data.leads.filter(l=>l.owner===name).length} leads</Tag></div>)}</div><form className="note-form" onSubmit={e=>{e.preventDefault();const name=staff.trim();if(!name)return;if(data.team.some(x=>norm(x)===norm(name))){setNotice({text:'Esse responsável já existe.',error:true});return}if(commit({...data,team:[...data.team,name]},'Responsável cadastrado.'))setStaff('')}}><input aria-label="Nome do responsável" required value={staff} onChange={e=>setStaff(e.target.value)} placeholder="Nome do responsável"/><button className="button primary">Adicionar</button></form></div></Page>}
 {page==='configuracoes'&&<Page title="Configurações" description="Preferências de exibição e portabilidade da demonstração."><div className="card panel settings"><h2>Dados da demonstração</h2><p>Os registros ficam no armazenamento local do navegador. Outros dispositivos têm cópias independentes. Use apenas dados fictícios até a implantação de autenticação e permissões.</p><div className="actions"><button className="button primary" onClick={()=>exportData(data)}><Download size={17}/> Exportar JSON</button><BackupPanel current={data} undoCopy={undoCopy} stale={stale} restore={next=>applyBackup('restore',next)} undo={()=>applyBackup('undo')}/><button className="button" onClick={()=>setDark(!dark)}>{dark?'Usar tema claro':'Usar tema escuro'}</button></div></div></Page>}
 </main></div>
 {!modal&&scoped}
 {modal?.type==='lead'&&<LeadEditor data={data} lead={data.leads.find(l=>l.id===modal.id)} onSave={saveLead} close={close}/>}
 {modal?.type==='triage'&&bound&&<TriageEditor lead={bound} triage={data.triages.find(t=>t.leadId===bound.id)} team={data.team} save={saveTriage} close={close}/>}
 {modal?.type==='activity'&&<ActivityEditor data={data} item={data.activities.find(x=>x.id===modal.id)} leadId={modal.leadId} projectId={modal.projectId} postSale={modal.postSale} draft={modal.draft} save={saveActivity} close={close}/>}
 {modal?.type==='meeting'&&<MeetingEditor data={data} item={data.meetings.find(x=>x.id===modal.id)} leadId={modal.leadId} save={saveMeeting} close={close}/>}
 {modal?.type==='propostas'&&<ProposalEditor key={modal.id??modal.meetingId??'new'} data={data} item={data.proposals.find(p=>p.id===modal.id)} leadId={modal.leadId} meetingId={modal.meetingId} save={saveProposal} close={close} open={id=>editing('propostas',id)} project={p=>{const existing=data.projects.find(v=>v.proposalId===p.id);editing('projetos',existing?.id,p.leadId,p.id)}}/>}
 {modal?.type==='projetos'&&<ProjectEditor key={modal.id??modal.meetingId??'new-project'} data={data} item={data.projects.find(p=>p.id===modal.id)} proposalId={modal.meetingId} close={close} save={saveProject} openProposal={id=>editing('propostas',id)} addActivity={(p,postSale)=>editing('activity',undefined,p.leadId,undefined,p.id,postSale)} openSupport={p=>setModal({type:'activity',draft:{id:'',leadId:p.leadId,projectId:p.id,owner:p.owner,title:'',kind:'Suporte',due:day(),priority:'Normal',status:'Pendente',description:'',result:''}})} openActivity={id=>editing('activity',id)} addForecast={p=>editing('previsao',undefined,p.leadId,undefined,p.id)} openFinance={id=>editing('financeiro',id)}/>}
 {billingProject&&billingProposal&&<ReceivableEditor project={billingProject} proposal={billingProposal} save={saveFinance} close={close}/>}
 {secondary&&<SecondaryEditor kind="financeiro" data={data} item={item} leadId={modal?.leadId} save={saveFinance} close={close}/>}
 {notice&&<div className={'toast '+(notice.error?'failure':'')} role={notice.error?'alert':'status'}>{notice.text}<button className="icon" aria-label="Dispensar mensagem" onClick={()=>setNotice(undefined)}><X size={16}/></button></div>}
 </div>
}

const root=createRoot(document.getElementById('root')!)
const vercelHost=location.hostname.endsWith('.vercel.app')
if(vercelHost||import.meta.env.VITE_HUB_MODE==='shared'){
 void import('./pilot-app').then(({default:PilotApp})=>root.render(<PilotApp/>)).catch(()=>root.render(<main><p role="alert">Não foi possível abrir o piloto compartilhado. Recarregue a página para tentar novamente.</p></main>))
}else{
 root.render(<App/>)
}
