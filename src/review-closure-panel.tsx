import {useState} from 'react'
import {weekDates} from './agenda-data'
import {dateLabel,day,type Data,type ReviewClosure} from './domain'
import {closeReview,filterReviewClosures,reviewClosureText} from './review-closure'
import {Dialog,Empty,Field,Form,Tag} from './ui'

export function ReviewClosurePanel({data,save,openActivity}:{data:Data;save:(data:Data)=>boolean;openActivity:(id:string)=>void}){
 const [exportRecord,setExportRecord]=useState<ReviewClosure>()
 const [copyStatus,setCopyStatus]=useState('')
 const [filters,setFilters]=useState({from:'',to:'',owner:'',query:''})
 const [editing,setEditing]=useState(false)
 const [notes,setNotes]=useState('')
 const [selected,setSelected]=useState<string[]>([])
 const [error,setError]=useState('')
 const today=day()
 const week=weekDates(today,0)
 const records=[...(data.reviewClosures??[])].sort((a,b)=>b.week.localeCompare(a.week))
 const reversed=!!(filters.from&&filters.to&&filters.from>filters.to)
 const visible=reversed?[]:filterReviewClosures(records,filters)
 const owners=[...new Set(records.flatMap(record=>record.actions.map(action=>action.owner)))].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 const current=records.some(record=>record.week===week[0])
 const actions=data.activities.filter(action=>action.reviewSource)
 function submit(){
  const record=closeReview(data,notes,selected)
  if('error'in record){setError(record.error);return}
  if(!save({...data,reviewClosures:[record,...records]})){setError('Não foi possível salvar o fechamento neste navegador.');return}
  setEditing(false)
  setNotes('')
  setSelected([])
  setError('')
 }
 return <section className="card panel review-closure"><div className="panel-head"><div><h2>Fechamento da revisão</h2><p>{dateLabel(week[0])} a {dateLabel(week[6])} · Histórico de decisões e compromissos.</p></div>
 {current?<Tag tone="green">Semana fechada</Tag>:<button className="button primary" onClick={()=>setEditing(true)}>Registrar fechamento</button>}</div>
 {records.length>0&&<><div className="fields">
 <Field label="Período a partir de" type="date" value={filters.from} on={from=>setFilters({...filters,from})}/>
 <Field label="Período até" type="date" value={filters.to} on={to=>setFilters({...filters,to})}/>
 <label className="field"><span>Responsável no fechamento</span><select value={filters.owner} onChange={e=>setFilters({...filters,owner:e.target.value})}><option value="">Todos os responsáveis</option>{owners.map(owner=><option key={owner}>{owner}</option>)}</select></label>
 <Field label="Buscar nas decisões" value={filters.query} on={query=>setFilters({...filters,query})}/>
 </div><div className="actions closure-filter-info"><p className="muted" role="status">{reversed?'A data inicial deve vir antes da final.':visible.length+' de '+records.length+' fechamentos'}</p>{Object.values(filters).some(Boolean)&&<button className="button compact" onClick={()=>setFilters({from:'',to:'',owner:'',query:''})}>Limpar filtros do histórico</button>}</div></>}
 {visible.length?visible.map(record=><details key={record.week} className="closure-record"><summary><b>{dateLabel(record.week)} a {dateLabel(weekDates(record.week,0)[6])}</b> · Fechada em {dateLabel(record.closedOn)}</summary>
 <p className="closure-notes">{record.notes}</p><h3>Atividades registradas no fechamento</h3>
 {record.actions.length?record.actions.map(action=><button key={action.id} className="agenda-entry" onClick={()=>openActivity(action.id)} disabled={!data.activities.some(a=>a.id===action.id)}><span className="agenda-entry-text"><b>{action.title}</b><small>{action.owner} · {dateLabel(action.due)}</small></span><Tag>{action.status}</Tag></button>):<p className="muted">Sem atividades vinculadas.</p>}
 <button type="button" className="button compact" onClick={()=>{setCopyStatus('');setExportRecord(record)}}>Exportar texto</button>
 </details>):<Empty title={records.length?'Nenhum fechamento corresponde aos filtros':'Nenhum fechamento registrado'}/>}
 {exportRecord&&<Dialog title="Exportar fechamento" onClose={()=>setExportRecord(undefined)} wide><div className="dialog-body">
 <label className="field"><span>Texto para compartilhar</span><textarea className="closure-export-text" readOnly value={reviewClosureText(exportRecord)} onFocus={e=>e.currentTarget.select()}/></label>
 <div className="actions"><button type="button" className="button primary" onClick={async()=>{
  try{await navigator.clipboard.writeText(reviewClosureText(exportRecord));setCopyStatus('Texto copiado.')}
  catch{setCopyStatus('Selecione o texto acima e copie manualmente.')}
 }}>Copiar texto</button><span role="status">{copyStatus}</span></div>
 </div></Dialog>}
 {editing&&<Dialog title="Registrar fechamento semanal" subtitle={dateLabel(week[0])+' a '+dateLabel(week[6])} onClose={()=>setEditing(false)} wide><Form onSave={submit} onClose={()=>setEditing(false)} error={error} label="Salvar fechamento">
 <Field label="Decisões e acordos" required type="area" value={notes} on={setNotes} placeholder="O que foi decidido e quais pontos precisam de acompanhamento?"/>
 <div><h3>Atividades vinculadas</h3><p className="muted">Selecione as ações discutidas. O registro guarda o responsável, o prazo e a situação no momento do fechamento.</p></div>
 {actions.map(action=><label className="checkline" key={action.id}><input type="checkbox" checked={selected.includes(action.id)} onChange={e=>setSelected(e.target.checked?[...selected,action.id]:selected.filter(id=>id!==action.id))}/>{action.title} · {action.owner} · {dateLabel(action.due)}</label>)}
 {!actions.length&&<p className="muted">Você pode registrar as decisões e criar atividades na revisão antes de fechar a semana.</p>}
 </Form></Dialog>}
 </section>
}
