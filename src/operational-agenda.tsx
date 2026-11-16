import {useState} from 'react'
import {ArrowUpRight,CalendarDays} from 'lucide-react'
import {dateLabel,type Lead} from './domain'
import {businessDay,filterWork,workKinds,type WorkEntry,type WorkFilter,type WorkKind} from './shared-operational'
import {Empty,Page,Tag} from './ui'

export function OperationalAgenda({entries,leads,initial={},open,change,busy,canChange,title='Agenda operacional'}:{entries:WorkEntry[];leads:Lead[];initial?:WorkFilter;open:(entry:WorkEntry)=>void;change:(entry:WorkEntry,status:string)=>void;busy:boolean;canChange:(entry:WorkEntry)=>boolean;title?:string}){
 const [filter,setFilter]=useState<WorkFilter>({period:'all',state:'pending',...initial})
 const today=businessDay(),rows=filterWork(entries,filter,today)
 const owners=[...new Set(entries.map(e=>e.owner).filter(Boolean))].sort()
 return <Page title={title} description="Atividades, reuniões, próximos contatos e prazos de entrega do espaço.">
  <div className="op-periods" aria-label="Recorte da agenda">{([['all','Todas'],['overdue','Vencidas'],['today','Hoje'],['week','Próximos 7 dias'],['undated','Sem prazo']] as const).map(([value,label])=><button key={value} className="button compact" aria-pressed={filter.period===value} onClick={()=>setFilter({...filter,period:value})}>{label}</button>)}</div>
  <div className="toolbar op-filters">
   <label>Tipo de compromisso<select value={filter.kind??''} onChange={e=>setFilter({...filter,kind:e.target.value as WorkKind|''})}><option value="">Todos os tipos</option>{Object.entries(workKinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
   <label>Responsável<select value={filter.owner??''} onChange={e=>setFilter({...filter,owner:e.target.value})}><option value="">Todos os responsáveis</option>{owners.map(o=><option key={o}>{o}</option>)}</select></label>
   <label>Buscar na agenda<input value={filter.query??''} onChange={e=>setFilter({...filter,query:e.target.value})} placeholder="Atividade, reunião ou projeto"/></label>
   <label>Registros<select value={filter.state} onChange={e=>setFilter({...filter,state:e.target.value as WorkFilter['state']})}><option value="pending">Pendentes</option><option value="all">Todos, inclusive concluídos</option></select></label>
   <button className="button" onClick={()=>setFilter({period:'all',state:'pending'})}>Limpar filtros da agenda</button>
  </div>
  <p className="muted" role="status">{rows.length} {rows.length===1?'item neste recorte':'itens neste recorte'} · Referência: {dateLabel(today)} · Fortaleza</p>
  {rows.length?<div className="op-agenda-list">{rows.map(row=><article className="card op-work-item" key={row.key}>
   <span className={'tile '+(row.date&&row.date<today?'rose':'blue')}><CalendarDays size={19}/></span>
   <div><small>{workKinds[row.kind]} · {row.detail}</small><button className="text-button lead-name" onClick={()=>open(row)}>{row.title}</button><p>{leads.find(l=>l.id===row.leadId)?.name??'Sem estabelecimento'} · {row.owner||'Sem responsável'}</p><Tag tone={row.date&&row.date<today?'rose':'neutral'}>{row.date?dateLabel(row.date):'Sem prazo'}{row.date===today?' · Hoje':''}</Tag> <Tag>{row.status}</Tag></div>
   <div className="op-item-actions">{(row.kind==='activity'||row.kind==='support')&&<label>Situação de {row.title}<select value={row.status} disabled={busy||!canChange(row)} onChange={e=>change(row,e.target.value)}>{['Pendente','Em andamento','Concluída','Cancelada'].map(s=><option key={s}>{s}</option>)}</select></label>}<button className="button compact" onClick={()=>open(row)}>Abrir ficha <ArrowUpRight size={15}/></button></div>
  </article>)}</div>:<div className="card"><Empty title="Nenhum compromisso neste recorte" detail="Ajuste os filtros ou registre atividades e reuniões nas fichas."/></div>}
 </Page>
}
