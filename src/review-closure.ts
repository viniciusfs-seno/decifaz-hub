import {dateLabel,day,norm,pending,type Activity,type Data,type ReviewClosure} from './domain.ts'
import {weekDates} from './agenda-data.ts'

export function closeReview(data:Data,notes:string,actionIds:string[],today=day()):ReviewClosure|{error:string}{
 const week=weekDates(today,0)[0]
 if(data.reviewClosures?.some(record=>record.week===week))return {error:'Esta semana já foi fechada.'}
 if(!notes.trim())return {error:'Registre as decisões da revisão.'}
 const selected=new Set(actionIds)
 const actions=data.activities.filter(action=>action.reviewSource&&selected.has(action.id))
 if(actions.length!==selected.size)return {error:'Revise as atividades selecionadas.'}
 if(actions.some(action=>!action.owner.trim()||!action.due))return {error:'Preencha o responsável e o prazo nas atividades selecionadas.'}
 return {week,closedOn:today,notes:notes.trim(),actions:actions.map(snapshot)}
}

function snapshot({id,title,owner,due,status}:Activity){
 return {id,title,owner,due,status}
}

export function previousReviewActions(data:Data,today=day()){
 const week=weekDates(today,0)[0]
 const closure=data.reviewClosures?.reduce<ReviewClosure|undefined>((latest,record)=>
  record.week<week&&(!latest||record.week>latest.week)?record:latest,undefined)
 const ids=new Set(closure?.actions.map(action=>action.id))
 const actions=data.activities.filter(action=>ids.has(action.id)&&pending(action))
  .sort((a,b)=>Number(b.due<today)-Number(a.due<today)||a.due.localeCompare(b.due))
 return {closure,actions}
}

export function reviewClosureText(record:ReviewClosure){
 const end=weekDates(record.week,0)[6]
 const actions=record.actions.map(action=>
  '• '+action.title+' — '+action.owner+' · Prazo '+dateLabel(action.due)+' · '+action.status)
 return [
  'Decifaz Hub | Fechamento da revisão semanal',
  dateLabel(record.week)+' a '+dateLabel(end)+' · Fechada em '+dateLabel(record.closedOn),
  '',
  'Decisões e acordos',
  record.notes,
  '',
  'Compromissos no fechamento',
  ...(actions.length?actions:['Sem atividades vinculadas.']),
 ].join('\n')
}

export function filterReviewClosures(records:ReviewClosure[],filters:{from:string;to:string;owner:string;query:string}){
 const query=norm(filters.query.trim())
 return records.filter(record=>
  (!filters.from||weekDates(record.week,0)[6]>=filters.from)
  &&(!filters.to||record.week<=filters.to)
  &&(!filters.owner||record.actions.some(action=>action.owner===filters.owner))
  &&norm(record.notes).includes(query))
}
