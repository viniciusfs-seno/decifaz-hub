import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel} from './domain'
export function NoticeSummary({client,workspace,revision}:{client:SupabaseClient;workspace:string;revision:number}){
 const [summary,setSummary]=useState<{day:string;pending:number}|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let active=true;void Promise.resolve(client.rpc('hub_notice_summary',{w:workspace})).then(r=>{if(active){setSummary(r.error?null:r.data);setError(!!r.error)}}).catch(()=>{if(active){setSummary(null);setError(true)}});return()=>{active=false}},[client,workspace,revision])
 return error?<p role="status">Resumo diário indisponível. A lista de avisos continua disponível.</p>:summary?<section aria-label="Resumo diário"><h2>Resumo de {dateLabel(summary.day)}</h2><p>{summary.pending} pendências no seu recorte autorizado. O resumo é preparado pelo servidor; a quantidade reflete a situação atual, inclusive pagamentos e mudanças de acesso.</p></section>:<p>O resumo aparece após o horário escolhido quando a geração estiver ativa. E-mail é uma preferência separada.</p>
}
