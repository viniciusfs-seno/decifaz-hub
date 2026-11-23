import {WorkflowForm} from './workflow-form'
import {useEffect,useId,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {money,dateLabel} from './domain'
import {Disclosure,RecordSummary,DraftRecovery} from './portal-patterns'
import {Empty} from './ui'
import {memberOwner,type WorkspacePerson} from './workspace-people'
import {useViewState} from './view-state'
import {FinancialRows} from './financial-week-rows'
import {FinancialSnapshot} from './financial-snapshot'
import {FinancialPaymentTrace} from './financial-payment-trace'
import {financialLabels as labels,type FinancialReport,type FinancialClosure,type FinancialItem} from './financial-week-types'

export function FinancialWeek({client,workspace,week,revision,people,open,saved}:{client:SupabaseClient;workspace:string;week:string;revision:number;people:WorkspacePerson[];open:(kind:string,id:string,date:string)=>void;saved:()=>void}){
 const notesId=useId(),ownerFieldId=useId()
 const [owner,setOwner]=useViewState('financial-owner-'+week,''),[offset,setOffset]=useViewState('financial-offset-'+week,0),[cursors,setCursors]=useViewState<(number|null)[]>('financial-history-'+week,[null])
 const [report,setReport]=useState<FinancialReport>(),[history,setHistory]=useState<FinancialClosure[]>([]),[historyTotal,setHistoryTotal]=useState(0),[notes,setNotes]=useState(''),[expected,setExpected]=useState(0),[reload,setReload]=useState(0),[loading,setLoading]=useState(true),[historyLoading,setHistoryLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loadError,setLoadError]=useState(''),[historyError,setHistoryError]=useState(''),[notice,setNotice]=useState(''),[snapshot,setSnapshot]=useState<number>(),[trace,setTrace]=useState<FinancialItem>()
 const operation=useRef({id:crypto.randomUUID(),payload:''}),loaded=useRef('')
 const [previousNotes,setPreviousNotes]=useState<string>()
 const cursor=cursors.at(-1)??null
 useEffect(()=>{let live=true;setLoading(true);setReport(undefined);setLoadError('')
  void client.rpc('hub_financial_week',{w:workspace,start_on:week,owner_id:owner||null,page_offset:offset}).then(r=>{if(!live)return;if(r.error)setLoadError('Não foi possível consultar a posição financeira. Confira seu acesso ou tente atualizar.');else if(offset>0&&offset>=r.data.count){setOffset(Math.floor(Math.max(0,r.data.count-1)/100)*100);return}else setReport(r.data as FinancialReport);setLoading(false)})
  return()=>{live=false}
 },[client,workspace,week,owner,offset,revision,reload])
 useEffect(()=>{let live=true;setHistoryLoading(true);setHistory([]);setHistoryError('');const key=workspace+week
  void client.rpc('hub_financial_week_history',{w:workspace,start_on:week,before_revision:cursor}).then(r=>{if(!live)return;setHistoryLoading(false);if(r.error){setHistoryError('Não foi possível consultar o histórico financeiro. Tente atualizar.');return}setHistory(r.data.items);setHistoryTotal(r.data.count);if(loaded.current!==key){const latest=r.data.latest as FinancialClosure|null;setNotes(latest?.notes??'');setExpected(latest?.revision??0);setNotice('');operation.current={id:crypto.randomUUID(),payload:''};loaded.current=key}})
  return()=>{live=false}
 },[client,workspace,week,cursor,revision,reload])
 async function close(){if(busy||!notes.trim())return;setBusy(true);setError('');setNotice('');const payload=JSON.stringify({workspace,week,notes});if(operation.current.payload&&operation.current.payload!==payload)operation.current.id=crypto.randomUUID();operation.current.payload=payload
  try{const r=await client.rpc('hub_close_financial_week',{w:workspace,start_on:week,expected_revision:expected,operation_id:operation.current.id,notes_text:notes});if(r.error)throw Error();const current=r.data.current as FinancialClosure;if(r.data.status==='conflict'){setPreviousNotes(notes);setNotes(current?.notes??'');setExpected(current?.revision??0);operation.current={id:crypto.randomUUID(),payload:''};setError('Outra sessão fechou esta semana. As decisões da revisão mais recente foram carregadas; confira a posição atual antes de salvar novamente.')}else{setPreviousNotes(undefined);setExpected(current.revision);setNotice('Revisão financeira registrada com fotografia completa das origens e identificação do autor.');setCursors([null]);saved()}setReload(v=>v+1)}catch{setError('Não foi possível registrar o fechamento. Seus apontamentos foram mantidos; confira o acesso e tente novamente.')}finally{setBusy(false)}
 }
 return <Disclosure title="Revisão financeira dos sócios" description="Posição atual e fotografias dos fechamentos" defaultOpen><section className="financial-week" aria-label="Revisão financeira semanal">
  <div className="toolbar"><div className="field"><label htmlFor={ownerFieldId}>Responsável financeiro</label><select id={ownerFieldId} value={owner} onChange={e=>{setOwner(e.target.value);setOffset(0)}}><option value="">Todo o espaço, inclusive sem responsável</option>{people.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div><button type="button" className="button" disabled={loading||historyLoading} onClick={()=>setReload(v=>v+1)}>Atualizar posição financeira</button></div>
  {(error||loadError)&&<p role="alert">{error||loadError}</p>}{notice&&<p role="status">{notice}</p>}
  {loading?<p role="status">Carregando revisão financeira…</p>:report&&<>
   <h3>Posição atual</h3><p>Semana de {dateLabel(report.week_start)} a {dateLabel(report.week_end)} · Fortaleza. Previsões pelo vencimento; recebimentos e pagamentos pela data efetiva. Cancelamentos e suspensões não entram; recebimentos estornados são excluídos.</p>
   <RecordSummary items={['forecast','received','expenses','paid'].map(k=>({label:labels[k],value:money(Number(report.totals[k]))}))}/>
   <h3>Prioridades atuais · {dateLabel(report.as_of)}</h3><RecordSummary items={['overdue','overdue_income','next_seven','next_thirty'].map(k=>({label:labels[k],value:money(Number(report.totals[k]))}))}/>
   <p className="view-hint">A posição de pendências é atual, mesmo ao selecionar uma semana anterior. Próximos 30 dias incluem os próximos 7. Contratos vinculados dão contexto, sem gerar uma segunda cobrança. Registros avulsos antigos podem não ter responsável. Cada cadastro de despesa deve representar uma única obrigação; não há conciliação automática de cadastros duplicados.</p>
   <h3>Origens para conferir e agir</h3>{report.items.length?<FinancialRows items={report.items} people={people} actions={i=><><button type="button" className="button compact" onClick={()=>open(i.kind,i.origin,i.paid_on??i.due_on)}>{i.kind==='bill'&&i.status==='Prevista'?'Conferir e dar baixa':'Abrir origem'}</button>{(i.kind==='receipt'||i.paid_on)&&<button type="button" className="button compact" onClick={()=>setTrace(i)}>Rastrear baixa</button>}</>}/>:<Empty title="Nenhum lançamento neste recorte" detail="Cadastre as obrigações ou previsões nas origens; esta revisão não duplica cadastros."/>}
   <div className="actions"><button type="button" className="button" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-100))}>Página anterior da revisão</button><span>{Math.min(offset+1,report.count)}–{Math.min(offset+100,report.count)} de {report.count} origens · totais do recorte completo</span><button type="button" className="button" disabled={offset+100>=report.count} onClick={()=>setOffset(offset+100)}>Próxima página da revisão</button></div>
  </>}
  <Disclosure key={expected} defaultOpen={!!error} title="Registrar conferência e decisões financeiras" description={'Revisão '+expected+' · histórico financeiro restrito'}>
   <p>O fechamento congela os totais e todas as origens do espaço nesta semana, independentemente do filtro de responsável. Os detalhes são paginados e não mudam com pagamentos posteriores. Fechar não paga nem altera vencimentos. Uma conferência tardia reflete os dados disponíveis no momento do registro.</p>
   <WorkflowForm onSubmit={e=>{e.preventDefault();void close()}}><div className="field"><label htmlFor={notesId}>Conferência e decisões financeiras</label><textarea id={notesId} required maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)}/></div><button className="button primary" disabled={busy||loading||historyLoading||!!historyError||!report}>{busy?'Registrando…':'Registrar fechamento financeiro'}</button>{previousNotes!==undefined&&<DraftRecovery restore={()=>{setNotes(previousNotes);setPreviousNotes(undefined)}}/>}</WorkflowForm>
  </Disclosure>
  <Disclosure title="Histórico financeiro desta semana" count={historyTotal} defaultOpen>
   {historyLoading?<p role="status">Carregando histórico financeiro…</p>:historyError?<p role="alert">{historyError} <button className="button" onClick={()=>setReload(v=>v+1)}>Tentar histórico novamente</button></p>:<>
    {history.length?history.map(h=><details key={h.revision}><summary>Revisão {h.revision} · {memberOwner('Integrante cadastrado',people,h.actor_id)} · {new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'}).format(new Date(h.closed_at))}</summary><p className="closure-notes">{h.notes}</p><p>{h.source_count} origens · {h.preserved_count} preservadas · {h.details_complete?'fotografia completa':'fotografia antiga parcial; detalhes restantes não foram congelados'}.</p><button className="button" onClick={()=>setSnapshot(h.revision)}>Consultar fotografia · revisão {h.revision}</button></details>):<Empty title="Nenhuma revisão financeira registrada para esta semana"/>}
    <div className="actions"><button className="button" disabled={cursors.length===1} onClick={()=>setCursors(cursors.slice(0,-1))}>Revisões mais recentes</button><span>Página {cursors.length} · {historyTotal} revisões registradas</span><button className="button" disabled={history.length<20||history.at(-1)?.revision===1} onClick={()=>setCursors([...cursors,history.at(-1)!.revision])}>Revisões anteriores</button></div>
   </>}
  </Disclosure>
  {snapshot!==undefined&&<FinancialSnapshot client={client} workspace={workspace} week={week} revision={snapshot} onClose={()=>setSnapshot(undefined)}/>}
  {trace&&<FinancialPaymentTrace client={client} workspace={workspace} item={trace} people={people} onClose={()=>setTrace(undefined)}/>}
 </section></Disclosure>
}
