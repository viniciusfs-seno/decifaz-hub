import {day,pending,type Activity,type Data} from './domain.ts'
import type {ReviewItem} from './review-data'

const actionKinds={lead:'Contato',propostas:'Proposta',projetos:'Entrega',financeiro:'Cobrança'} as const

export function reviewActionDraft(data:Data,item:ReviewItem):Activity{
 const projectId=item.target==='projetos'?item.id:item.target==='financeiro'?data.finance.find(f=>f.id===item.id)?.projectId??'':''
 return {
  id:'',leadId:item.leadId,projectId,title:'Acompanhar · '+item.title,
  description:item.detail,kind:actionKinds[item.target],owner:data.team.includes(item.owner)?item.owner:'',
  due:day(),priority:item.due&&item.due<day()?'Alta':'Normal',status:'Pendente',result:'',
  reviewSource:{target:item.target,id:item.id,title:item.title},
 }
}

export function pendingReviewAction(activities:Activity[],source:NonNullable<Activity['reviewSource']>){
 return activities.find(a=>a.reviewSource?.target===source.target&&a.reviewSource.id===source.id&&pending(a))
}
