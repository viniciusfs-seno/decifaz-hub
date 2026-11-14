import {Activity,ArrowDownRight,ArrowRight,ArrowUpRight,CalendarDays,ChartNoAxesCombined,ClipboardCheck,Clock3,FileText,FolderKanban,GitBranch,ListTodo,Target,Users,Wallet} from 'lucide-react'
import {active,dateLabel,day,grade,metrics,money,overdue,pending,stages,type Data} from './domain'
import {Dialog,Empty,Page,Priority,Tag} from './ui'
import {useState} from 'react'
import {previousRange,reportScope} from './report-scope'
import {reportRecords,type ReportMetric} from './report-records'
import {downloadReport} from './report-export'
const colors=['#3a4a6f','#53658a','#6c7da0','#8f9ab3','#b6bfd4','#d9d9d9']
export function Dashboard({data,open,go,add,reports=false}:{data:Data;open:(id:string)=>void;go:(p:string)=>void;add:()=>void;reports?:boolean}){
 const [period,setPeriod]=useState('Todos os períodos')
 const [start,setStart]=useState('')
 const [end,setEnd]=useState('')
 const custom=period==='Intervalo personalizado'
 const invalidRange=custom&&!!start&&!!end&&start>end
 const [owner,setOwner]=useState('')
 const [segment,setSegment]=useState('')
 const [region,setRegion]=useState('')
 const [origin,setOrigin]=useState('')
 const [detail,setDetail]=useState<{key:ReportMetric;label:string}>()
 const filtersValue={
  from:custom?start:period==='Todos os períodos'?'':day(period==='Últimos 30 dias'?-29:-6),
  to:custom?end:period==='Todos os períodos'?'':day(),
  owner,segment,region,origin,
 }
 const scope=reportScope(data,filtersValue)
 const range=reports?previousRange(filtersValue.from,filtersValue.to):null
 const previous=range?metrics(reportScope(data,{...filtersValue,...range})):null
 const records=detail?reportRecords(scope)[detail.key]:[]
 const leads=scope.leads
 const m=metrics(scope)
 const tasks=scope.activities.filter(pending).sort((a,b)=>a.due.localeCompare(b.due))
 const leadName=(id:string)=>leads.find(l=>l.id===id)?.name??'Sem estabelecimento'
 const cards=[
  [Users,'Leads cadastrados',m.leads,'Total no CRM','crm','mint','leads'],
  [Target,'Leads prioritários',m.priority,'Oportunidades com prioridade A','triagem','gold','priority'],
  [CalendarDays,'Reuniões agendadas',m.meetings,'Agenda comercial','reunioes','blue','meetings'],
  [ListTodo,'Atividades pendentes',m.pending,m.overdue+' em atraso','atividades','rose','pending']
 ] as const
 const groups=[['Pesquisa',stages.slice(0,2)],['Qualificação',stages.slice(2,4)],['Contato',stages.slice(4,5)],['Reunião e diagnóstico',stages.slice(5,7)],['Proposta e negociação',stages.slice(7,9)],['Ganho',stages.slice(9,10)]] as const
 const counts=groups.map(([_,ss])=>leads.filter(l=>ss.includes(l.stage)).length)
 const priorities=['A','B','C','Sem classificação'].map((label,i)=>({label,count:leads.filter(l=>(grade(scope.triages.find(t=>t.leadId===l.id))?.label??'Sem classificação')===label).length,color:[colors[0],'#ff6a13','#8f9ab3','#e4e8f2'][i]}))
 let position=0
 const gradient=priorities.filter(p=>p.count).map(p=>{const start=position;position+=p.count/leads.length*100;return p.color+' '+start+'% '+position+'%'})
 const weeks=Array.from({length:6},(_,i)=>{const start=day(-41+i*7),end=day(-35+i*7);return {start,count:leads.filter(l=>l.created>=start&&l.created<=end).length}})
 const today=new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric'})
 const filters=<div className="toolbar dashboard-filters">{([[owner,setOwner,data.team,'Responsável'],[segment,setSegment,[...new Set(data.leads.map(l=>l.segment))],'Segmento'],[region,setRegion,[...new Set(data.leads.map(l=>l.region).filter(Boolean))],'Região'],[origin,setOrigin,[...new Set(data.leads.map(l=>l.origin).filter(Boolean))],'Origem']] as const).map(([value,set,options,label])=><select key={label} value={value} aria-label={label} onChange={e=>set(e.target.value)}><option value="">{label}: todos</option>{options.map(o=><option key={o}>{o}</option>)}</select>)}</div>
 return <Page title={reports?'Indicadores e relatórios':'Visão geral'} description={reports?'Acompanhe a evolução do comercial e os resultados da operação.':'Acompanhe o comercial e as próximas ações da Decifaz.'} actions={<><select aria-label="Período de cadastro" value={period} onChange={e=>setPeriod(e.target.value)}><option>Todos os períodos</option><option>Últimos 7 dias</option><option>Últimos 30 dias</option>{reports&&<option>Intervalo personalizado</option>}</select><button className="button primary" onClick={add}>＋ Novo lead</button></>}>
 <div className="section-line"><h2>Indicadores comerciais</h2><small><CalendarDays size={15}/> {today}</small></div>
 {reports&&<>
  {filters}
  {custom&&<div className="toolbar dashboard-filters">
   <label>Data inicial <input type="date" value={start} max={end||undefined} onChange={e=>setStart(e.target.value)}/></label>
   <label>Data final <input type="date" value={end} min={start||undefined} onChange={e=>setEnd(e.target.value)}/></label>
  </div>}
  {invalidRange&&<p role="alert">A data final deve ser igual ou posterior à inicial.</p>}
  <div className="toolbar dashboard-filters">
   <small>O período considera a data de cadastro da oportunidade e inclui os registros vinculados.</small>
   <button type="button" className="button" disabled={invalidRange} onClick={()=>downloadReport(scope)}>Exportar indicadores CSV</button>
  </div>
 </>}
 {!invalidRange&&<>
 <div className="kpis">{cards.map(([Icon,label,value,detail,to,color,key])=><button key={label} className="metric card" onClick={()=>reports?setDetail({key,label}):go(to)}><div className="metric-top"><span className={'tile '+color}><Icon size={19}/></span><ArrowUpRight size={17}/></div><span className="metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></button>)}</div>
 {!reports&&<section className="card panel dashboard-support">
  <div><h2>Suporte vencido</h2><p>{data.activities.filter(activity=>activity.kind==='Suporte'&&overdue(activity)).length} chamados com prazo vencido.</p></div>
  <button type="button" className="button" onClick={()=>go('suporte?vencidos')}>Ver chamados vencidos <ArrowRight size={16}/></button>
 </section>}
 {reports&&<section className="card panel">
  <h2>Comparação entre períodos</h2>
  {previous&&range?<><p>Período anterior de mesma duração: {dateLabel(range.from)} a {dateLabel(range.to)}. A comparação agrupa as oportunidades pela data de cadastro e considera a situação atual de cada grupo.</p>
   <div className="table-wrap"><table><thead><tr><th>Indicador</th><th>Período selecionado</th><th>Período anterior</th></tr></thead>
   <tbody><tr><th>Novos leads</th><td>{m.leads}</td><td>{previous.leads}</td></tr>
   <tr><th>Propostas enviadas vinculadas</th><td>{m.proposals}</td><td>{previous.proposals}</td></tr>
   <tr><th>Conversão</th><td>{m.conversion===null?'—':m.conversion+'%'}</td><td>{previous.conversion===null?'—':previous.conversion+'%'}</td></tr></tbody></table></div>
  </>:<p>Selecione um período com data inicial e final para comparar.</p>}
 </section>}

 <div className="dashboard-grid"><section className="card panel"><div className="panel-head"><div><h2>Funil comercial</h2><p>Oportunidades por etapa atual</p></div><button className="text-button" onClick={()=>go('crm')}>Ver CRM <ArrowRight size={15}/></button></div><div className="funnel">{groups.map(([label],i)=><div className="funnel-row" key={label}><span>{label}</span><div className="track"><i style={{width:counts[i]/Math.max(1,...counts)*100+'%',background:colors[i]}}/></div><strong>{counts[i]}</strong></div>)}</div><div className="panel-bottom"><GitBranch size={15}/>{leads.filter(l=>active(l.stage)).length} oportunidades ativas</div></section>
 <section className="card panel"><div className="panel-head"><div><h2>Prioridades</h2><p>Distribuição da triagem comercial</p></div><span className="subtle"><Target size={18}/></span></div><div className="priority-body"><div className="donut" role="img" aria-label={priorities.map(p=>p.label+' '+p.count).join(', ')} style={{background:gradient.length?'conic-gradient('+gradient.join(',')+')':undefined}}><div><strong>{leads.length}</strong><span>leads</span></div></div><div className="legend">{priorities.map(p=><div key={p.label}><i style={{background:p.color}}/><span>{p.label==='Sem classificação'?p.label:'Prioridade '+p.label}</span><b>{p.count}</b></div>)}</div></div></section></div>
 <div className="dashboard-grid"><section className="card panel"><div className="panel-head"><div><h2>Oportunidades recentes</h2><p>Últimos estabelecimentos cadastrados</p></div><button className="text-button" onClick={()=>go('crm')}>Ver todas <ArrowRight size={15}/></button></div><div className="list">{leads.slice(0,4).map(l=><button key={l.id} className="list-item" onClick={()=>open(l.id)}><span className="initial">{l.name.split(' ').slice(0,2).map(s=>s[0]).join('')}</span><span><b>{l.name}</b><small>{l.segment} · {l.city}</small></span><Priority triage={scope.triages.find(t=>t.leadId===l.id)}/></button>)}{!leads.length&&<Empty/>}</div></section>
 <section className="card panel"><div className="panel-head"><div><h2>Próximas atividades</h2><p>Vencidas e próximos compromissos</p></div><button className="text-button" onClick={()=>go('agenda')} aria-label="Abrir agenda operacional"><ArrowUpRight size={18}/></button></div><div className="list">{tasks.slice(0,4).map(a=><button key={a.id} className="list-item" onClick={()=>go('atividades')}><span className={'tile '+(a.due<day()?'rose':'mint')}><Clock3 size={17}/></span><span><b>{a.title}</b><small>{leadName(a.leadId)} · {dateLabel(a.due)}</small></span>{a.due<day()&&<Tag tone="rose">Vencida</Tag>}</button>)}{!tasks.length&&<Empty title="Sem atividades pendentes"/>}</div></section></div>
 <div className="dashboard-grid"><section className="card panel"><div className="panel-head"><div><h2>Evolução das oportunidades</h2><p>Novos cadastros por semana · últimas 6 semanas</p></div><ChartNoAxesCombined size={19}/></div><div className="weeks">{weeks.map(w=><div key={w.start}><b>{w.count}</b><i style={{height:Math.max(3,w.count/Math.max(1,...weeks.map(v=>v.count))*85)+'px'}}/><small>{dateLabel(w.start).slice(0,5)}</small></div>)}</div></section><section className="card panel"><div className="panel-head"><div><h2>Agenda comercial</h2><p>Reuniões com data registrada</p></div><button className="text-button" onClick={()=>go('agenda')}>Ver agenda <ArrowRight size={17}/></button></div><div className="list">{scope.meetings.filter(v=>v.state==='Agendada').sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(v=><button className="list-item" key={v.id} onClick={()=>open(v.leadId)}><span className="tile blue"><CalendarDays size={16}/></span><span><b>{leadName(v.leadId)}</b><small>{dateLabel(v.date)} · {v.participants}</small></span></button>)}{m.meetings===0&&<Empty title="Sem reuniões agendadas"/>}</div></section></div>
 <section className="card panel"><div className="panel-head"><div><h2>Resultados comerciais e operacionais</h2><p>Conversão calculada sobre {m.won+leads.filter(l=>l.stage==='Perdido').length} oportunidades decididas (ganhas ou perdidas).</p></div></div><div className="summary-grid">{[[Activity,'Em qualificação','qualifying',m.qualifying],[FileText,'Propostas enviadas','proposals',m.proposals],[GitBranch,'Em negociação','negotiations',m.negotiations],[ClipboardCheck,'Clientes conquistados','won',m.won],[Target,'Taxa de conversão','conversion',m.conversion===null?'—':m.conversion+'%'],[FolderKanban,'Projetos em andamento','projects',m.projects],[Wallet,'Receita prevista','expected',scope.finance.some(f=>f.kind==='Receita'&&f.state==='Previsto')?money(m.expected):'—'],[ArrowDownRight,'Receita realizada','received',scope.finance.some(f=>f.kind==='Receita'&&f.state==='Realizado')?money(m.received):'—']].map(([Icon,label,key,value])=>{const I=Icon as typeof Activity;return <div key={String(label)}><I size={17}/><span>{reports?<button type="button" className="text-button" onClick={()=>setDetail({key:key as ReportMetric,label:String(label)})}>{String(label)}</button>:String(label)}</span><b>{String(value)}</b></div>})}</div></section>
 {reports&&<button type="button" className="button" onClick={()=>setDetail({key:'overdue',label:'Atividades em atraso'})}>Ver atividades em atraso ({m.overdue})</button>}
 {detail&&<Dialog title={detail.label} subtitle={records.length+' registros no recorte'} onClose={()=>setDetail(undefined)}>
  {records.length?<ul className="report-records">{records.map(row=><li key={row.id}>
   {row.leadId?<button type="button" className="text-button" onClick={()=>{setDetail(undefined);open(row.leadId)}}>{row.title}</button>:<strong>{row.title}</strong>}
   <small>{row.detail}</small>
  </li>)}</ul>:<Empty title="Sem registros neste recorte"/>}
 </Dialog>}
 </>}
 </Page>
}
