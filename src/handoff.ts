import {day,event,upsert,type Data,type Project} from './domain.ts'

import {deliveryError} from './delivery.ts'

export const handoffItems = [
 ['acceptance','Aceite ou contrato documentado'],
 ['scope','Escopo e versão revisados com o técnico'],
 ['materials','Materiais iniciais recebidos'],
 ['payment','Condição de pagamento acordada'],
 ['access','Responsáveis e regras de acesso definidos'],
] as const

export function availableProposals(data:Data){
 return data.proposals.filter(p=>p.status==='Aceita'&&data.leads.some(l=>l.id===p.leadId&&l.stage==='Ganho')&&!data.projects.some(project=>project.proposalId===p.id))
}

export function saveProjectRecord(data:Data,project:Project){
 const previous=data.projects.find(p=>p.id===project.id)
 const proposal=data.proposals.find(p=>p.id===project.proposalId)
 const lead=data.leads.find(l=>l.id===project.leadId)
 if(!lead||!data.team.includes(project.owner)||!project.title.trim()||!project.due)return {error:'Informe título, responsável técnico e prazo.'} as const
 if(previous&&(project.proposalId!==previous.proposalId||project.leadId!==previous.leadId))return {error:'A origem de um projeto existente é fixa.'} as const
 if(!previous&&!availableProposals(data).some(p=>p.id===project.proposalId&&p.leadId===project.leadId))return {error:'Selecione uma proposta aceita e disponível de uma oportunidade ganha.'} as const
 const ready=handoffItems.every(([key])=>project.handoff?.checks.includes(key))&&!!project.handoff?.reference.trim()
 const requiresHandoff=project.status==='Em andamento'||project.status==='Entregue'||project.stage!=='Descoberta'
 const legacyProgress=previous&&!previous.handoff&&previous.status!=='Planejado'
 const keepingLegacy=legacyProgress&&previous.status===project.status&&previous.stage===project.stage&&!ready
 if(requiresHandoff&&!ready&&!keepingLegacy)return {error:'Conclua o checklist e registre a referência do aceite antes de avançar a execução.'} as const
 const deliveryIssue=deliveryError(project,previous)
 if(deliveryIssue)return {error:deliveryIssue} as const
 const snapshot=previous?.approved??(proposal?{version:proposal.version,title:proposal.title,scope:proposal.scope,services:proposal.services,terms:proposal.terms,setup:proposal.setup,monthly:proposal.monthly,acceptance:proposal.decisionNote,acceptedAt:proposal.decisionAt}:undefined)
 const handoff=keepingLegacy?undefined:project.handoff?{...project.handoff,completedAt:ready?(previous?.handoff?.completedAt||day()):undefined}:undefined
 const delivery=project.delivery&&(project.delivery.checks.length||project.delivery.acceptedAt||project.delivery.reference.trim()||project.delivery.notes.trim())?project.delivery:undefined
 const saved={...project,delivery,title:project.title.trim(),approved:snapshot,handoff}
 const history=previous?'Projeto atualizado: '+saved.title:'Projeto aberto: '+saved.title+(snapshot?' · proposta v'+snapshot.version:'')
 const suffix=handoff?.completedAt&&!previous?.handoff?.completedAt?' · Passagem para desenvolvimento concluída':previous&&previous.status!==saved.status?' · '+previous.status+' → '+saved.status:''
 return {data:{...data,projects:upsert(data.projects,saved),leads:upsert(data.leads,{...lead,history:[event(history+suffix+(saved.delivery?.acceptedAt&&saved.delivery.acceptedAt!==previous?.delivery?.acceptedAt?' · Aceite da entrega registrado':'')+(saved.status==='Entregue'&&previous?.status!=='Entregue'?' · Entrega concluída':''),saved.owner),...lead.history]})}} as const
}
