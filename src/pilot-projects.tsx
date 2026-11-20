import {allRows} from './load-all'
import {Disclosure,RecordSummary,RecordTabs} from './portal-patterns'
import {useViewState} from './view-state'
import {useState,type ReactNode} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,day,money,type Lead,type Proposal} from './domain'
import {deliveryChecks} from './delivery'
import {Dialog,Empty,Field,Form,Page,Tag} from './ui'

const statuses=['Planejado','Em andamento','Em homologação','Entregue'] as const
export type SharedProject={
 proposal_id:string; lead_id:string; owner:string; due_on:string|null;
 delivery:{checks:string[];acceptedAt:string;reference:string}|null;
 status:typeof statuses[number]; deliverables:string;
 approved:Pick<Proposal,'title'|'version'|'scope'|'services'|'setup'|'monthly'|'terms'|'decisionAt'|'decisionNote'>
}
export type ProjectUpdate=Pick<SharedProject,'owner'|'due_on'|'status'|'deliverables'>

export function loadProjects(client:SupabaseClient,workspace:string){
 return allRows(client.from('hub_projects_visible').select('proposal_id,lead_id,owner,due_on,status,deliverables,approved,delivery')
  .eq('workspace_id',workspace).order('due_on').order('proposal_id').returns<SharedProject[]>())
}

export function SharedProjects({projects,leads,open}:{projects:SharedProject[];leads:Lead[];open:(id:string)=>void}){
 const [query,setQuery]=useViewState('projects-query',''),[owner,setOwner]=useViewState('projects-owner',''),[late,setLate]=useViewState('projects-late',false)
 const rows=projects.filter(p=>(!owner||p.owner===owner)&&(!late||!!p.due_on&&p.due_on<day()&&p.status!=='Entregue')&&(p.approved.title+' '+(leads.find(l=>l.id===p.lead_id)?.name??'')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
 return <Page title="Projetos e entregas" description="Acompanhe os projetos abertos a partir de propostas aceitas.">
  <div className="toolbar op-filters"><label>Buscar projeto ou estabelecimento<input value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Responsável do projeto<select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos</option>{[...new Set(projects.map(p=>p.owner).filter(Boolean))].sort().map(o=><option key={o}>{o}</option>)}</select></label><label className="checkline"><input type="checkbox" checked={late} onChange={e=>setLate(e.target.checked)}/>Somente projetos vencidos</label></div>
  <p className="view-summary" role="status"><span><b>{rows.length}</b> projetos neste recorte</span><span>Prazo e responsável do projeto · abra a ficha para entregas e suporte</span></p>
  {rows.length?<div className="card table-wrap"><table><thead><tr><th>Projeto</th><th>Estabelecimento</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
  <tbody>{rows.map(item=><tr key={item.proposal_id}>
   <td><button className="text-button lead-name" onClick={()=>open(item.proposal_id)}>{item.approved.title}</button></td>
   <td>{leads.find(lead=>lead.id===item.lead_id)?.name}</td><td>{item.owner||'—'}</td><td><Tag tone={item.due_on&&item.due_on<day()&&item.status!=='Entregue'?'rose':'neutral'}>{dateLabel(item.due_on??'')}{item.due_on&&item.due_on<day()&&item.status!=='Entregue'?' · Vencido':''}</Tag></td><td><Tag>{item.status}</Tag></td>
  </tr>)}</tbody></table></div>:<Empty title={projects.length?"Nenhum projeto neste recorte":"Nenhum projeto aberto"} detail={projects.length?"Ajuste a busca, o responsável ou o filtro de vencidos.":"Abra um projeto pela versão aceita de uma proposta comercial."}/>}
 </Page>
}

export function SharedProjectEditor({item,close,save,accept,support,meetings,history,initialSection='resumo',readOnly=false}:{item:SharedProject;close:()=>void;save:(values:ProjectUpdate)=>Promise<boolean>;accept:(values:DeliveryAcceptance)=>Promise<boolean>;support?:ReactNode;meetings?:ReactNode;history?:ReactNode;initialSection?:string;readOnly?:boolean}){
 const [draft,setDraft]=useState<ProjectUpdate>({owner:item.owner,due_on:item.due_on,status:item.status,deliverables:item.deliverables})
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const {approved}=item
 const [checks,setChecks]=useState<string[]>([])
 const [date,setDate]=useState(day())
 const [reference,setReference]=useState('')
 const [follow,setFollow]=useState(false)
 const [title,setTitle]=useState('Acompanhamento pós-venda')
 const [owner,setOwner]=useState(item.owner)
 const [due,setDue]=useState(day())
 async function confirm(){
  if(saving)return
  if(checks.length!==deliveryChecks.length||!date||date>day()||!reference.trim()||(follow&&(!title.trim()||!owner.trim()||!due))){
   setError('Confira o checklist, a data e a evidência do aceite. Se houver acompanhamento, informe título, responsável e prazo.')
   return
  }
  setSaving(true)
  setError('')
  try{
   if(await accept({checks,date,reference,title:follow?title:'',owner,due:follow?due:null}))close()
   else setError('Não foi possível registrar o aceite. Atualize o projeto e tente novamente.')
  }finally{setSaving(false)}
 }
 async function submit(){
  if(saving)return
  setSaving(true)
  try{
   if(await save({...draft,owner:draft.owner.trim()}))close()
   else setError('Não foi possível salvar o projeto. Atualize a lista e tente novamente.')
  }finally{setSaving(false)}
 }
 return <Dialog title={approved.title} subtitle={'Proposta aprovada · v'+approved.version} onClose={close} wide>
  <RecordSummary items={[{label:'Situação',value:item.status},{label:'Responsável',value:item.owner},{label:'Prazo',value:dateLabel(item.due_on??'')}]}/>
  <RecordTabs initial={initialSection} sections={[
  {id:'resumo',label:'Resumo',content:<fieldset disabled={readOnly} className="registry-fields"><Form onClose={close} onSave={()=>void submit()} label={saving?'Salvando…':'Salvar projeto'} error={error}>
   <h3>Organização do projeto</h3>
   <div className="fields">
    <Field label="Responsável" value={draft.owner} on={owner=>setDraft({...draft,owner})}/>
    <Field label="Prazo" type="date" value={draft.due_on??''} on={due=>setDraft({...draft,due_on:due||null})}/>
    <Field label="Situação" options={statuses.filter(status=>status!=='Entregue'||item.status==='Entregue'||item.delivery)} required value={draft.status} on={status=>setDraft({...draft,status:status as ProjectUpdate['status']})}/>
   </div>
   <Field label="Entregáveis operacionais" type="area" value={draft.deliverables} on={deliverables=>setDraft({...draft,deliverables})}/>
   <Disclosure title="Escopo e condições aprovadas" description={'Proposta · versão '+approved.version}>
   <p className="details-line">{approved.scope}</p>
   {approved.services.length>0&&<p>{approved.services.join(' · ')}</p>}
   {approved.setup!==undefined&&<p>Implantação {money(approved.setup)} · Mensalidade {money(approved.monthly)}</p>}
   {approved.terms&&<p className="details-line">{approved.terms}</p>}
   </Disclosure>
  </Form></fieldset>},
  {id:'entrega',label:'Entrega e aceite',content:<fieldset disabled={readOnly} className="registry-fields"><section className="dialog-body"><h3>Homologação e aceite</h3>
   {item.delivery?<p>Entrega aceita em {dateLabel(item.delivery.acceptedAt)} · {item.delivery.reference}</p>:<>
    {deliveryChecks.map(([id,label])=><label key={id} className="checkline">
     <input type="checkbox" checked={checks.includes(id)} onChange={e=>setChecks(e.target.checked?[...checks,id]:checks.filter(check=>check!==id))}/>{label}
    </label>)}
    <div className="fields"><Field label="Data do aceite" type="date" value={date} on={setDate}/>
     <Field label="Evidência do aceite" value={reference} on={setReference}/></div>
    <label className="checkline"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>Criar atividade de pós-venda</label>
    {follow&&<div className="fields"><Field label="Atividade" value={title} on={setTitle}/>
     <Field label="Responsável pela atividade" value={owner} on={setOwner}/><Field label="Prazo da atividade" type="date" value={due} on={setDue}/></div>}
    <button className="button primary" type="button" disabled={saving} onClick={()=>void confirm()}>Confirmar aceite da entrega</button>
   </>}
  {error&&<p role="alert">{error}</p>}</section></fieldset>},
  {id:'reunioes',label:'Reuniões',content:meetings},
  {id:'suporte',label:'Atividades e suporte',content:support},
  {id:'historico',label:'Histórico',content:history},
  ]}/>
 </Dialog>
}

export type DeliveryAcceptance={checks:string[];date:string;reference:string;title:string;owner:string;due:string|null}
