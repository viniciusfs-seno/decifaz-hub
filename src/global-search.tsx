import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Dialog,Empty} from './ui'
export type SearchRecord={kind:'lead'|'project'|'contract';id:string;title:string;detail:string;lead_id:string}
const kinds={lead:'Estabelecimento',project:'Projeto',contract:'Contrato'}
export function GlobalSearch({client,workspace,close,open}:{client:SupabaseClient;workspace:string;close:()=>void;open:(record:SearchRecord)=>Promise<boolean>}){
 const [query,setQuery]=useState(''),[rows,setRows]=useState<SearchRecord[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const input=useRef<HTMLInputElement>(null)
 const [opening,setOpening]=useState(false)
 async function select(row:SearchRecord){setOpening(true);try{if(!await open(row))setError('Não foi possível abrir o registro. Ele pode ter mudado ou seu acesso foi atualizado. Tente buscar novamente.')}catch{setError('Não foi possível abrir o registro. Tente buscar novamente.')}finally{setOpening(false)}}
 useEffect(()=>{input.current?.focus()},[])
 useEffect(()=>{
  let current=true;const controller=new AbortController();setRows([]);setError('')
  if(query.trim().length<2){setBusy(false);return}
  setBusy(true)
  const timer=setTimeout(()=>{void Promise.resolve(client.rpc('hub_search_records',{w:workspace,q:query.trim(),result_limit:20}).abortSignal(controller.signal)).then(r=>{
   if(!current)return
   setBusy(false);if(r.error||!Array.isArray(r.data)){setError('Não foi possível buscar neste espaço. Tente novamente.');return}setRows(r.data)
  }).catch(()=>{if(current){setBusy(false);setError('Não foi possível buscar neste espaço. Tente novamente.')}})},200)
  return()=>{current=false;controller.abort();clearTimeout(timer)}
 },[client,workspace,query,retry])
 return <Dialog title="Buscar registros" subtitle="Estabelecimentos, projetos e contratos do espaço atual" onClose={close} wide><div className="dialog-body global-record-search" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close()}}}>
  <label className="field">Nome ou cidade<input ref={input} type="search" maxLength={100} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Digite pelo menos dois caracteres" autoComplete="off"/></label>
  <p className="muted">Somente registros autorizados · até 20 resultados por busca. Notas internas, valores e documentos ficam fora da busca.</p>
  {busy&&<p role="status">Buscando neste espaço…</p>}
  {error&&<p role="alert">{error} <button className="button" onClick={()=>setRetry(n=>n+1)}>Tentar novamente a busca</button></p>}
  {opening&&<p role="status">Abrindo registro…</p>}
  {!busy&&!error&&query.trim().length>=2&&(rows.length?<><p role="status">{rows.length} resultados exibidos · refine o nome para encontrar outros registros</p><ul className="global-search-results">{rows.map(row=><li key={row.kind+row.id}><button type="button" disabled={opening} onClick={()=>void select(row)}><span className="tag">{kinds[row.kind]}</span><strong>{row.title}</strong><small>{row.detail}</small></button></li>)}</ul></>:<Empty title="Nenhum registro autorizado encontrado" detail="Confira o nome ou tente outro termo no espaço atual."/>)}
 </div></Dialog>
}
