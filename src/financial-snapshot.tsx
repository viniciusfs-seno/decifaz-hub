import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Dialog,Empty} from './ui'
import {RecordSummary} from './portal-patterns'
import {FinancialRows} from './financial-week-rows'
import {financialLabels,type FinancialClosure,type FinancialItem} from './financial-week-types'
import {dateLabel,money} from './domain'
export function FinancialSnapshot({client,workspace,week,revision,onClose}:{client:SupabaseClient;workspace:string;week:string;revision:number;onClose:()=>void}){
 const [offset,setOffset]=useState(0),[data,setData]=useState<{closure:FinancialClosure;items:FinancialItem[]}>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[retry,setRetry]=useState(0)
 useEffect(()=>{let live=true;setLoading(true);setData(undefined);setError('');void client.rpc('hub_financial_week_snapshot',{w:workspace,start_on:week,rev:revision,page_offset:offset}).then(r=>{if(!live)return;setLoading(false);if(r.error)setError('Não foi possível consultar esta fotografia. Confira seu acesso ou tente novamente.');else setData(r.data)});return()=>{live=false}},[client,workspace,week,revision,offset,retry])
 return <Dialog title={'Fotografia financeira · revisão '+revision} onClose={onClose} wide><div className="dialog-body financial-week">
  <p>Detalhes congelados no fechamento. Esta consulta não lê nem reconstrói os lançamentos atuais.</p>{loading&&<p role="status">Carregando fotografia…</p>}{error&&<p role="alert">{error} <button className="button" onClick={()=>setRetry(v=>v+1)}>Tentar fotografia novamente</button></p>}
  {data&&<><p>Semana {dateLabel(week)} · registrada em {new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'}).format(new Date(data.closure.closed_at))} · posição congelada de {dateLabel(data.closure.report.as_of)}.</p>
   <RecordSummary items={Object.entries(financialLabels).map(([k,label])=>({label,value:money(Number(data.closure.report.totals[k]))}))}/>
   <p>{data.closure.source_count} origens no recorte · {data.closure.preserved_count} preservadas.</p>{!data.closure.details_complete&&<p role="status">Fotografia antiga parcial: {data.closure.source_count-data.closure.preserved_count} origens não foram congeladas. Não há reconstrução desses detalhes a partir dos dados atuais.</p>}
   {data.items.length?<FinancialRows items={data.items} frozen/>:<Empty title="Nenhum detalhe preservado nesta página"/>}
   <div className="actions"><button className="button" disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-100))}>Detalhes anteriores</button><span>{Math.min(offset+1,data.closure.preserved_count)}–{Math.min(offset+100,data.closure.preserved_count)} de {data.closure.preserved_count} preservadas</span><button className="button" disabled={offset+100>=data.closure.preserved_count} onClick={()=>setOffset(offset+100)}>Próximos detalhes</button></div>
  </>}
 </div><div className="dialog-foot"><button className="button" onClick={onClose}>Voltar ao histórico financeiro</button></div></Dialog>
}
