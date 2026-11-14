import {useState} from 'react'
import {dateLabel,day,pending,type Activity,type Lead} from './domain'
import {Empty,Page,Tag} from './ui'

export function SupportView({activities,leads,open,initialOverdue=false}:{initialOverdue?:boolean;activities:Activity[];leads:Lead[];open:(id:string)=>void}){
 const [period,setPeriod]=useState('30')
 const [view,setView]=useState(initialOverdue?1:0)
 const today=day()
 const calls=activities.filter(activity=>activity.kind==='Suporte')
 const inProgress=calls.filter(pending)
 const resolved=calls.filter(activity=>activity.status==='Concluída'&&(!period||(activity.completedOn&&activity.completedOn>=day(1-Number(period))&&activity.completedOn<=today)))
 const groups=[inProgress,inProgress.filter(activity=>activity.due<today),resolved]
 const rows=[...groups[view]].sort((a,b)=>view===2?(b.completedOn??'').localeCompare(a.completedOn??''):a.due.localeCompare(b.due))
 return <Page title="Suporte" description="Acompanhe os chamados em aberto, os prazos vencidos e as resoluções.">
  <div className="kpis support-kpis">{['Abertos','Vencidos','Resolvidos'].map((label,index)=><button key={label} type="button" className="metric card" aria-pressed={view===index} onClick={()=>setView(index)}><span className="metric-label">{label}</span><strong>{groups[index].length}</strong></button>)}</div>
  <section className="card panel">
   <div className="panel-head"><h2>{['Chamados abertos','Chamados vencidos','Chamados resolvidos'][view]}</h2>
   <label className="field"><span>Período de resolução</span><select value={period} onChange={e=>{setPeriod(e.target.value);setView(2)}}><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="">Todo o histórico</option></select></label></div>
   {rows.length?<div className="list">{rows.map(activity=><button type="button" className="list-item" key={activity.id} onClick={()=>open(activity.id)}><span><b>{activity.title}</b><small>{[leads.find(lead=>lead.id===activity.leadId)?.name,activity.owner,dateLabel(view===2?activity.completedOn??'':activity.due)].filter(Boolean).join(' · ')}</small></span><Tag tone={view===2?'green':activity.due<today?'rose':'neutral'}>{view!==2&&activity.due<today?'Vencido':activity.status}</Tag></button>)}</div>:<Empty title="Nenhum chamado nesta visão"/>}
  </section>
 </Page>
}
