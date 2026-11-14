import {day,pending,type Activity} from './domain.ts'
import {weekDates} from './agenda-data.ts'

export function withCompletion(activity:Activity,previous?:Activity,today=day()):Activity{
 return {...activity,completedOn:activity.status==='Concluída'
  ? previous?.status==='Concluída'?previous.completedOn:today
  : undefined}
}

export function summarizeReview(activities:Activity[],today=day()){
 const week=weekDates(today,0)
 const next=weekDates(today,1)
 const actions=activities.filter(a=>a.reviewSource)
 const open=actions.filter(pending).sort((a,b)=>a.due.localeCompare(b.due))
 return {
  week,next,
  completed:actions.filter(a=>a.status==='Concluída'&&a.completedOn&&week.includes(a.completedOn)).sort((a,b)=>b.completedOn!.localeCompare(a.completedOn!)),
  overdue:open.filter(a=>a.due&&a.due<today),
  upcoming:open.filter(a=>next.includes(a.due)),
  undated:actions.filter(a=>a.status==='Concluída'&&!a.completedOn).length,
 }
}
