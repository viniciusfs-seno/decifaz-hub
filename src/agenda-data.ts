import {meetingLink} from './meeting-link.ts'
import {pending,type Data} from './domain.ts'

export const agendaKinds={activity:'Atividade',meeting:'Reunião',projetos:'Prazo de projeto',financeiro:'Recebimento'} as const
export type AgendaKind=keyof typeof agendaKinds
export type AgendaEntry={id:string;kind:AgendaKind;title:string;date:string;leadId:string;owner:string;detail:string;amount?:number;callUrl?:string}

export function weekDates(today:string,offset:number){
 const monday=new Date(today+'T00:00:00Z')
 monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7+offset*7)
 return Array.from({length:7},(_,i)=>{
  const date=new Date(monday)
  date.setUTCDate(date.getUTCDate()+i)
  return date.toISOString().slice(0,10)
 })
}

export function agendaEntries(data:Data):AgendaEntry[]{
 const entries:AgendaEntry[]=[
  ...data.activities.filter(pending).map(a=>({id:a.id,kind:'activity' as const,title:a.title,date:a.due,leadId:a.leadId,owner:a.owner,detail:a.kind})),
  ...data.meetings.filter(m=>m.state==='Agendada').map(m=>({id:m.id,kind:'meeting' as const,title:'Reunião comercial',date:m.date,leadId:m.leadId,owner:m.owner,detail:m.participants,callUrl:meetingLink(m.callUrl)??undefined})),
  ...data.projects.filter(p=>p.status!=='Entregue').map(p=>({id:p.id,kind:'projetos' as const,title:p.title,date:p.due,leadId:p.leadId,owner:p.owner,detail:p.status+' · '+p.stage})),
  ...data.finance.filter(f=>f.state==='Previsto'&&f.kind==='Receita').map(f=>{
   const project=data.projects.find(p=>p.id===f.projectId)
   const leadId=project?.leadId||f.leadId
   return {id:f.id,kind:'financeiro' as const,title:f.title,date:f.due,leadId,owner:project?.owner||data.leads.find(l=>l.id===leadId)?.owner||'',detail:project?'Responsável do projeto':leadId?'Responsável do CRM':'',amount:f.amount}
  }),
 ]
 return entries.filter(e=>e.date).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,'pt-BR'))
}
