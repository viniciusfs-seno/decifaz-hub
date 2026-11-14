import {useState} from 'react'
import {ArrowUpRight,CalendarDays,ChevronLeft,ChevronRight,FolderKanban,ListTodo,Wallet} from 'lucide-react'
import {agendaEntries,agendaKinds,weekDates,type AgendaEntry,type AgendaKind} from './agenda-data'
import {dateLabel,day,money,type Data} from './domain'
import {Empty,Page,Tag} from './ui'

const icons={activity:ListTodo,meeting:CalendarDays,projetos:FolderKanban,financeiro:Wallet}
const weekdays=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']

export function Agenda({data,open}:{data:Data;open:(entry:AgendaEntry)=>void}){
 const [offset,setOffset]=useState(0)
 const [kind,setKind]=useState('')
 const [owner,setOwner]=useState('')
 const [lead,setLead]=useState('')
 const [view,setView]=useState<'week'|'overdue'>('week')
 const today=day()
 const dates=weekDates(today,offset)
 const all=agendaEntries(data)
 const owners=[...new Set([...data.team,...all.map(e=>e.owner).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 const entries=all.filter(e=>(!kind||e.kind===kind)&&(!owner||(owner==='unassigned'?!e.owner:e.owner===owner))&&(!lead||(lead==='unlinked'?!e.leadId:e.leadId===lead)))
 const overdue=entries.filter(e=>e.date<today)
 const week=entries.filter(e=>dates.includes(e.date))
 const range=dateLabel(dates[0])+' a '+dateLabel(dates[6])
 const render=(e:AgendaEntry)=>{
  const Icon=icons[e.kind]
  const client=data.leads.find(l=>l.id===e.leadId)?.name
  return <div key={e.kind+':'+e.id}><button className="agenda-entry" onClick={()=>open(e)}>
   <span className={'tile '+(e.date<today?'rose':'mint')}><Icon size={17}/></span>
   <span className="agenda-entry-text"><small>{agendaKinds[e.kind]}{e.date<today?' · '+(e.kind==='meeting'?'Sem registro de realização':'Vencido'):''}</small><b>{e.title}</b><small>{[client,e.owner||'Sem responsável',e.detail].filter(Boolean).join(' · ')}</small></span>
   {e.amount!==undefined&&<strong>{money(e.amount)}</strong>}<ArrowUpRight className="muted" size={16}/>
  </button>{e.callUrl&&<a className="button compact" href={e.callUrl} target="_blank" rel="noopener noreferrer">Abrir chamada</a>}</div>
 }
 const group=(date:string,label:string,items:AgendaEntry[])=><section key={date} className="card panel agenda-day"><div className="panel-head"><div><h2>{label}</h2><p>{dateLabel(date)}</p></div>{date===today?<Tag tone="green">Hoje</Tag>:<Tag>{items.length} {items.length===1?'registro':'registros'}</Tag>}</div>{items.length?items.map(render):<p className="muted agenda-empty">Sem compromissos.</p>}</section>
 return <Page title="Agenda operacional" description="Veja o que está agendado, o que vence e quem precisa agir.">
 <div className="tabs"><button aria-pressed={view==='week'} onClick={()=>setView('week')}>Semana · {week.length}</button><button aria-pressed={view==='overdue'} onClick={()=>setView('overdue')}>Atrasados · {overdue.length}</button></div>
 <div className="toolbar">
 <select aria-label="Tipo de compromisso" value={kind} onChange={e=>setKind(e.target.value)}><option value="">Todos os tipos</option>{Object.keys(agendaKinds).map(key=><option key={key} value={key}>{agendaKinds[key as AgendaKind]}</option>)}</select>
 <select aria-label="Responsável" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option><option value="unassigned">Sem responsável</option>{owners.map(name=><option key={name}>{name}</option>)}</select>
 <select aria-label="Estabelecimento" value={lead} onChange={e=>setLead(e.target.value)}><option value="">Todos os estabelecimentos</option><option value="unlinked">Sem estabelecimento</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
 {(kind||owner||lead)&&<button className="button" onClick={()=>{setKind('');setOwner('');setLead('')}}>Limpar filtros</button>}
 </div>
 {view==='week'?<><div className="agenda-controls"><b aria-live="polite">{range}</b><div className="actions"><button className="button compact" aria-label="Semana anterior" onClick={()=>setOffset(offset-1)}><ChevronLeft size={17}/></button><button className="button compact" onClick={()=>setOffset(0)}>Semana atual</button><button className="button compact" aria-label="Próxima semana" onClick={()=>setOffset(offset+1)}><ChevronRight size={17}/></button></div></div><div className="agenda-days">{dates.map((d,i)=>group(d,weekdays[i],week.filter(e=>e.date===d)))}</div></>:overdue.length?<div className="agenda-days">{[...new Set(overdue.map(e=>e.date))].map(d=>group(d,'Pendências',overdue.filter(e=>e.date===d)))}</div>:<div className="card"><Empty title="Sem atrasos nesta visão" detail="A lista inclui compromissos pendentes de qualquer semana."/></div>}
 </Page>
}
