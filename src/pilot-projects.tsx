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
 return client.from('hub_projects').select('proposal_id,lead_id,owner,due_on,status,deliverables,approved,delivery')
  .eq('workspace_id',workspace).order('due_on').order('proposal_id').returns<SharedProject[]>()
}

export function SharedProjects({projects,leads,open}:{projects:SharedProject[];leads:Lead[];open:(id:string)=>void}){
 return <Page title="Projetos e entregas" description="Acompanhe os projetos abertos a partir de propostas aceitas.">
  {projects.length?<div className="card table-wrap"><table><thead><tr><th>Projeto</th><th>Estabelecimento</th><th>Responsável</th><th>Prazo</th><th>Situação</th></tr></thead>
  <tbody>{projects.map(item=><tr key={item.proposal_id}>
   <td><button className="text-button lead-name" onClick={()=>open(item.proposal_id)}>{item.approved.title}</button></td>
   <td>{leads.find(lead=>lead.id===item.lead_id)?.name}</td><td>{item.owner||'—'}</td><td>{dateLabel(item.due_on??'')}</td><td><Tag>{item.status}</Tag></td>
  </tr>)}</tbody></table></div>:<Empty title="Nenhum projeto aberto" detail="Abra um projeto pela versão aceita de uma proposta comercial."/>}
 </Page>
}

export function SharedProjectEditor({item,close,save,accept,children}:{item:SharedProject;close:()=>void;save:(values:ProjectUpdate)=>Promise<boolean>;accept:(values:DeliveryAcceptance)=>Promise<boolean>;children?:ReactNode}){
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
  <Form onClose={close} onSave={()=>void submit()} label={saving?'Salvando…':'Salvar projeto'} error={error}>
   <h3>Escopo aprovado</h3><p className="details-line">{approved.scope}</p>
   {approved.services.length>0&&<p>{approved.services.join(' · ')}</p>}
   <p>Implantação {money(approved.setup)} · Mensalidade {money(approved.monthly)}</p>
   {approved.terms&&<p className="details-line">{approved.terms}</p>}
   <div className="fields">
    <Field label="Responsável" value={draft.owner} on={owner=>setDraft({...draft,owner})}/>
    <Field label="Prazo" type="date" value={draft.due_on??''} on={due=>setDraft({...draft,due_on:due||null})}/>
    <Field label="Situação" options={statuses.filter(status=>status!=='Entregue'||item.status==='Entregue'||item.delivery)} required value={draft.status} on={status=>setDraft({...draft,status:status as ProjectUpdate['status']})}/>
   </div>
   <Field label="Entregáveis operacionais" type="area" value={draft.deliverables} on={deliverables=>setDraft({...draft,deliverables})}/>
  </Form>
  <section className="dialog-body"><h3>Homologação e aceite</h3>
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
  </section>
  {children}
 </Dialog>
}

export type DeliveryAcceptance={checks:string[];date:string;reference:string;title:string;owner:string;due:string|null}
