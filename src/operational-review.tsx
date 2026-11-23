import {WorkflowForm} from './workflow-form'
import {useState} from 'react'
import {dateLabel,type Data} from './domain'
import type {SharedProject} from './pilot-projects'
import {businessDay,isPending,type SharedActivity} from './shared-operational'
import {Dialog,Empty,Page,Tag} from './ui'

type Origin={kind:'lead'|'meeting'|'proposal'|'project';id:string;lead:string;title:string;detail:string;owner:string;due:string;project?:string}
export function OperationalReview({data,projects,activities,busy,allowed,save,openLead,openProject,openProposal}:{data:Data;projects:SharedProject[];activities:SharedActivity[];busy:boolean;allowed:(kind:string)=>boolean;save:(origin:Origin,title:string,owner:string,due:string)=>Promise<boolean>;openLead:(id:string)=>void;openProject:(id:string)=>void;openProposal:(id:string)=>void}){
 const [kind,setKind]=useState('all'),[draft,setDraft]=useState<{origin:Origin;title:string;owner:string;due:string}>()
 const today=businessDay()
 const rows:Origin[]=[
  ...data.leads.filter(l=>isPending(l.stage)&&l.stage!=='Ganho').map(l=>({kind:'lead' as const,id:l.id,lead:l.id,title:l.name,detail:l.stage,owner:l.owner,due:l.due})),
  ...data.meetings.filter(m=>isPending(m.state)).map(m=>({kind:'meeting' as const,id:m.id,lead:m.leadId,title:m.summary||m.participants||'Reunião',detail:m.state,owner:m.owner,due:m.date})),
  ...data.proposals.filter(p=>!['Aceita','Recusada','Cancelada','Substituída'].includes(p.status)).map(p=>({kind:'proposal' as const,id:p.id,lead:p.leadId,title:p.title,detail:p.status,owner:data.leads.find(l=>l.id===p.leadId)?.owner??'',due:p.validity})),
  ...projects.filter(p=>isPending(p.status)).map(p=>({kind:'project' as const,id:p.proposal_id,lead:p.lead_id,project:p.proposal_id,title:p.approved.title,detail:p.status,owner:p.owner,due:p.due_on??''})),
 ]
 const labels={lead:'Comercial',meeting:'Reuniões',proposal:'Propostas',project:'Projetos'}
 return <Page title="Revisão semanal" description="Revise as origens, combine responsável e prazo e transforme decisões em atividades compartilhadas.">
  <div className="op-periods">{[['all','Todas as frentes'],...Object.entries(labels)].map(([value,label])=><button className="button compact" key={value} aria-pressed={kind===value} onClick={()=>setKind(value)}>{label}</button>)}</div>
  <p className="muted">{dateLabel(today)} · Fortaleza. Uma ação pendente por origem é reutilizada entre sessões; concluí-la permite planejar a próxima.</p>
  <div className="op-review-grid">{rows.filter(r=>kind==='all'||r.kind===kind).map(r=>{const action=activities.find(a=>a.review_kind===r.kind&&a.review_id===r.id&&isPending(a.status));return <article className="card panel" key={r.kind+r.id}><small>{labels[r.kind]} · {r.detail}</small><h2>{r.title}</h2><p>{data.leads.find(l=>l.id===r.lead)?.name} · {r.owner||'Sem responsável'}</p><Tag tone={r.due&&r.due<today?'rose':'neutral'}>{r.due?dateLabel(r.due):'Sem prazo'}</Tag>{action&&<p role="status">Ação em aberto: <b>{action.title}</b> · {action.owner} · {dateLabel(action.due_on??'')}</p>}<div className="actions"><button className="button compact" onClick={()=>r.project?openProject(r.project):r.kind==='proposal'?openProposal(r.id):openLead(r.lead)}>Reabrir origem</button><button className="button compact primary" disabled={busy||!allowed(r.kind)||!!action} onClick={()=>setDraft({origin:r,title:'Revisar '+r.title,owner:r.owner,due:today})}>{action?'Ação já planejada':'Planejar ação'}</button></div></article>})}</div>
  {!rows.filter(r=>kind==='all'||r.kind===kind).length&&<Empty title="Nada para revisar nesta frente" detail="Os registros persistidos do espaço aparecem aqui conforme a jornada avança."/>}
  {draft&&<Dialog title="Planejar ação da revisão" subtitle={draft.origin.title} onClose={()=>setDraft(undefined)}><WorkflowForm className="dialog-body pilot-fields" onSubmit={async e=>{e.preventDefault();if(await save(draft.origin,draft.title,draft.owner,draft.due))setDraft(undefined)}}><label>Ação vinculada<input required maxLength={500} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Responsável pela ação<input required maxLength={200} value={draft.owner} onChange={e=>setDraft({...draft,owner:e.target.value})}/></label><label>Prazo da ação<input type="date" required value={draft.due} onChange={e=>setDraft({...draft,due:e.target.value})}/></label><p className="muted">Se outra sessão já criou uma ação pendente para esta origem, ela será preservada.</p><button className="button primary" disabled={busy||!draft.title.trim()||!draft.owner.trim()}>Salvar ação da revisão</button></WorkflowForm></Dialog>}
 </Page>
}
