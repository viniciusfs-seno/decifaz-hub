import {norm,type Lead,type Meeting} from './domain.ts'
import type {SharedProject} from './pilot-projects.tsx'

export type SharedActivity={id:string;lead_id:string;project_proposal_id:string|null;title:string;owner:string;due_on:string|null;status:string;support?:boolean;review_kind?:string;review_id?:string}
export type WorkKind='activity'|'meeting'|'project'|'contact'|'support'|'bill'|'contract'
export type WorkEntry={key:string;id:string;kind:WorkKind;title:string;leadId:string;projectId?:string;owner:string;date:string;status:string;detail:string}
export const workKinds:Record<WorkKind,string>={activity:'Atividade',meeting:'Reunião',project:'Entrega de projeto',contact:'Próximo contato',support:'Chamado de pós-venda',bill:'Obrigação da Decifaz',contract:'Aviso de contrato'}
export const businessDay=(now=new Date())=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(now)
export const isPending=(status:string)=>!['Paga','Suspensa','Concluída','Cancelada','Realizada','Entregue','Perdido','Arquivado'].includes(status)
export function workEntries(leads:Lead[],tasks:SharedActivity[],meetings:Meeting[],projects:SharedProject[]):WorkEntry[]{
 const rows:WorkEntry[]=[
  ...tasks.map(t=>({key:'activity-'+t.id,id:t.id,kind:t.support?'support' as const:'activity' as const,title:t.title,leadId:t.lead_id,projectId:t.project_proposal_id??undefined,owner:t.owner,date:t.due_on??'',status:t.status,detail:t.support?'Suporte':t.project_proposal_id?'Pós-venda':'Comercial'})),
  ...meetings.map(m=>({key:'meeting-'+m.id,id:m.id,kind:'meeting' as const,title:'Reunião · '+m.participants,leadId:m.leadId,projectId:m.projectId,owner:m.owner??'',date:m.date,status:m.state,detail:m.summary||'Diagnóstico comercial'})),
  ...projects.map(p=>({key:'project-'+p.proposal_id,id:p.proposal_id,kind:'project' as const,title:p.approved.title,leadId:p.lead_id,projectId:p.proposal_id,owner:p.owner,date:p.due_on??'',status:p.status,detail:'Prazo de entrega'})),
  ...leads.filter(l=>l.next&&isPending(l.stage)&&l.stage!=='Ganho'&&!tasks.some(t=>t.lead_id===l.id&&isPending(t.status)&&norm(t.title)===norm(l.next)&&(t.due_on??'')===l.due)).map(l=>({key:'contact-'+l.id,id:l.id,kind:'contact' as const,title:l.next,leadId:l.id,owner:l.owner,date:l.due,status:'Próximo contato',detail:l.stage})),
 ]
 return rows.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a.title.localeCompare(b.title,'pt-BR'))
}
export type WorkFilter={period?:'all'|'overdue'|'today'|'week'|'undated';kind?:WorkKind|'';owner?:string;query?:string;state?:'pending'|'all'}
export function filterWork(rows:WorkEntry[],filter:WorkFilter,today:string){
 const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+6)
 const through=end.toISOString().slice(0,10)
 return rows.filter(row=>(filter.state==='all'||isPending(row.status))&&(!filter.kind||row.kind===filter.kind)&&(!filter.owner||row.owner===filter.owner)&&(!filter.query||norm(row.title+' '+row.detail).includes(norm(filter.query)))&&(
  !filter.period||filter.period==='all'||filter.period==='overdue'&&row.date&&row.date<today||filter.period==='today'&&row.date===today||filter.period==='week'&&row.date>=today&&row.date<=through||filter.period==='undated'&&!row.date
 ))
}
