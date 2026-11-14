import {day,upsert,type Data,type Finance} from './domain.ts'

export function saveReceivable(data:Data,entry:Finance){
 const previous=data.finance.find(f=>f.id===entry.id)
 if(!entry.title.trim()||!Number.isFinite(entry.amount)||entry.amount<=0||!entry.due)return {error:'Informe descrição, valor positivo e vencimento.'} as const
 if(entry.state==='Realizado'&&(!entry.paid||entry.paid>day()))return {error:'Informe uma data de baixa até hoje.'} as const
 if(entry.origin){
  const proposal=data.proposals.find(p=>p.id===entry.origin?.proposalId)
  const project=data.projects.find(p=>p.id===entry.projectId)
  if(!proposal||proposal.status!=='Aceita'||proposal.leadId!==entry.leadId||!project||project.proposalId!==proposal.id||project.leadId!==entry.leadId)return {error:'O projeto precisa estar vinculado à proposta aceita.'} as const
  const expected=entry.origin.kind==='Implantação'?proposal.setup:proposal.monthly
  const period=entry.origin.period
  if(entry.kind!=='Receita'||entry.amount!==expected||(entry.origin.kind==='Mensalidade'?!/^\d{4}-(0[1-9]|1[0-2])$/.test(period):period!==''))return {error:'Revise o valor aprovado e a competência.'} as const
  if(data.finance.some(f=>f.id!==entry.id&&f.origin?.proposalId===proposal.id&&f.origin.kind===entry.origin?.kind&&f.origin.period===period))return {error:'Já existe uma previsão para esta implantação ou competência.'} as const
 }
 if(previous?.origin&&(entry.origin?.proposalId!==previous.origin.proposalId||entry.origin?.kind!==previous.origin.kind||entry.origin?.period!==previous.origin.period||entry.projectId!==previous.projectId||entry.leadId!==previous.leadId))return {error:'O vínculo do lançamento com a proposta é fixo.'} as const
 return {finance:upsert(data.finance,{...entry,title:entry.title.trim(),paid:entry.state==='Realizado'?entry.paid:''})} as const
}
