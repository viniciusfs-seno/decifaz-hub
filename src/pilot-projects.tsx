import {useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,money,type Lead,type Proposal} from './domain'
import {Dialog,Empty,Field,Form,Page,Tag} from './ui'

const statuses=['Planejado','Em andamento','Em homologação','Entregue'] as const
export type SharedProject={
 proposal_id:string; lead_id:string; owner:string; due_on:string|null;
 status:typeof statuses[number]; deliverables:string;
 approved:Pick<Proposal,'title'|'version'|'scope'|'services'|'setup'|'monthly'|'terms'|'decisionAt'|'decisionNote'>
}
export type ProjectUpdate=Pick<SharedProject,'owner'|'due_on'|'status'|'deliverables'>

export function loadProjects(client:SupabaseClient,workspace:string){
 return client.from('hub_projects').select('proposal_id,lead_id,owner,due_on,status,deliverables,approved')
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

export function SharedProjectEditor({item,close,save}:{item:SharedProject;close:()=>void;save:(values:ProjectUpdate)=>Promise<boolean>}){
 const [draft,setDraft]=useState<ProjectUpdate>({owner:item.owner,due_on:item.due_on,status:item.status,deliverables:item.deliverables})
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const {approved}=item
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
    <Field label="Situação" options={[...statuses]} required value={draft.status} on={status=>setDraft({...draft,status:status as ProjectUpdate['status']})}/>
   </div>
   <Field label="Entregáveis operacionais" type="area" value={draft.deliverables} on={deliverables=>setDraft({...draft,deliverables})}/>
  </Form>
 </Dialog>
}
