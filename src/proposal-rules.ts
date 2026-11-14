import {dateLabel,day,event,money,stages,upsert,type Data,type Proposal,type Stage} from './domain.ts'

export const proposalStatuses=['Rascunho','Enviada','Negociação','Aceita','Recusada','Expirada','Substituída']
export type ProposalDecision={status:string;date:string;note:string}
const transitions:Record<string,string[]>={Rascunho:['Enviada'],Enviada:['Negociação','Aceita','Recusada','Expirada'],Negociação:['Aceita','Recusada','Expirada']}
const stageByStatus:Partial<Record<string,Stage>>={Enviada:'Proposta enviada',Negociação:'Negociação',Aceita:'Ganho'}

export function proposalVersions(proposals:Proposal[]){
 const latest=new Map<string,Proposal>()
 for(const p of proposals){
  const key=p.seriesId||p.id
  if((latest.get(key)?.version??0)<p.version)latest.set(key,p)
 }
 return [...latest.values()]
}

export function proposalText(p:Proposal,lead:string){
 return [p.title+' · v'+p.version,'Estabelecimento: '+lead,'Validade: '+dateLabel(p.validity),p.services.length?'Soluções: '+p.services.join(', '):'','Escopo\n'+p.scope,'Implantação: '+money(p.setup),'Mensalidade: '+money(p.monthly),p.terms?'Condições\n'+p.terms:''].filter(Boolean).join('\n\n')
}

export function applyProposal(data:Data,p:Proposal,decision?:ProposalDecision):{data:Data;message:string}|{error:string}{
 const lead=data.leads.find(l=>l.id===p.leadId)
 if(!lead)return {error:'Estabelecimento indisponível.'}
 const existing=data.proposals.find(x=>x.id===p.id)
 const seriesId=p.seriesId||p.id
 const latest=proposalVersions(data.proposals).find(x=>(x.seriesId||x.id)===seriesId)
 let next=p
 let stage=lead.stage
 let history='Proposta salva: '+p.title+' · v'+p.version
 if(decision){
  if(!existing||latest?.id!==p.id||!transitions[existing.status]?.includes(decision.status)||!decision.note.trim()||!decision.date||decision.date>day()||(existing.sentAt&&decision.date<existing.sentAt))return {error:'Revise a transição e a data. A data deve estar entre o envio e hoje, quando houver envio registrado.'}
  if(decision.status==='Aceita'&&['Perdido','Arquivado'].includes(stage))return {error:'Reabra a oportunidade no CRM antes de registrar o aceite.'}
  next={...existing,status:decision.status,sentAt:decision.status==='Enviada'?decision.date:existing.sentAt,decisionAt:decision.date,decisionNote:decision.note,events:[...existing.events??[],decision]}
  const target=stageByStatus[decision.status]
  if(target&&stages.indexOf(stage)<stages.indexOf(target))stage=target
  history='Proposta '+decision.status.toLowerCase()+': '+p.title+' · v'+p.version+' · '+dateLabel(decision.date)+' · '+decision.note
 }else if(existing&&(existing.status!=='Rascunho'||latest?.id!==p.id)||!existing&&latest&&(latest.status==='Aceita'||p.version!==latest.version+1||latest.leadId!==p.leadId)){
  return {error:'Esta versão mudou. Abra a versão atual para continuar.'}
 }
 if(stage!==lead.stage)history+=' · '+lead.stage+' → '+stage
 const proposals=upsert(data.proposals.map(x=>!existing&&latest?.id===x.id&&['Rascunho','Enviada','Negociação'].includes(x.status)?{...x,status:'Substituída'}:x),next)
 return {data:{...data,proposals,leads:upsert(data.leads,{...lead,stage,history:[event(history,lead.owner),...lead.history]})},message:decision?'Andamento da proposta registrado.':'Rascunho salvo.'}
}
