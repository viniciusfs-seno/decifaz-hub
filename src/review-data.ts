import {active,day,type Data} from './domain.ts'
import {proposalVersions} from './proposal-rules.ts'
import {handoffItems} from './handoff.ts'
import {deliveryChecks} from './delivery.ts'

export type ReviewItem={id:string;target:'lead'|'propostas'|'projetos'|'financeiro';title:string;detail:string;leadId:string;owner:string;due?:string;amount?:number}

export function weeklyReview(data:Data,today=day(),through=day(7)){
 const leads=data.leads.filter(l=>active(l.stage)&&(!l.next.trim()||(!l.due&&!l.noDueReason?.trim())||(l.due&&l.due<today))).map((l):ReviewItem=>({
  id:l.id,target:'lead',title:l.name,leadId:l.id,owner:l.owner,due:l.due,
  detail:!l.next.trim()?'Sem próxima ação':!l.due?'Próxima ação sem prazo':'Próxima ação vencida · '+l.next,
 }))
 const proposals=proposalVersions(data.proposals).filter(p=>['Enviada','Negociação'].includes(p.status)&&p.validity&&p.validity<=through).map((p):ReviewItem=>({
  id:p.id,target:'propostas',title:p.title,leadId:p.leadId,owner:data.leads.find(l=>l.id===p.leadId)?.owner??'',due:p.validity,
  detail:(p.validity<today?'Validade vencida':p.validity===today?'Vence hoje':'Vence nos próximos 7 dias')+' · v'+p.version,
 }))
 const projects=data.projects.filter(p=>p.status!=='Entregue').flatMap((p):ReviewItem[]=>{
  const reasons:string[]=[]
  if(!handoffItems.every(([key])=>p.handoff?.checks.includes(key))||!p.handoff?.reference.trim())reasons.push('Passagem para desenvolvimento incompleta')
  if(p.stage==='Homologação'&&(!deliveryChecks.every(([key])=>p.delivery?.checks.includes(key))||!p.delivery?.acceptedAt||!p.delivery?.reference.trim()))reasons.push('Homologação ou aceite pendente')
  if(p.due&&p.due<today)reasons.push('Prazo vencido')
  return reasons.length?[{id:p.id,target:'projetos',title:p.title,detail:reasons.join(' · '),leadId:p.leadId,owner:p.owner,due:p.due}]:[]
 })
 const receivables=data.finance.filter(f=>f.kind==='Receita'&&f.state==='Previsto'&&f.due&&f.due<today).map((f):ReviewItem=>{
  const project=data.projects.find(p=>p.id===f.projectId)
  const leadId=project?.leadId||f.leadId
  return {id:f.id,target:'financeiro',title:f.title,detail:'Recebimento em atraso',leadId,owner:project?.owner||data.leads.find(l=>l.id===leadId)?.owner||'',due:f.due,amount:f.amount}
 })
 return {leads,proposals,projects,receivables}
}
