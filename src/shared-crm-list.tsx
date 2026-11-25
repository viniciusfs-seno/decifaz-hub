import {useWorkspacePeople} from './workspace-people'
import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {CRM} from './commercial'
import {fullLead,type PilotLead} from './pilot-journey'
import type {Data} from './domain'
import {useViewState} from './view-state'
export type CrmFilter={query:string;stage:string;owner:string;priority:string;sort:string;offset:number}
export function SharedCrmList({client,workspace,revision,data,triage,open,add,start}:{client:SupabaseClient;workspace:string;revision:number;data:Data;triage:boolean;open:(lead:PilotLead)=>void;add:()=>void;start:(lead:PilotLead)=>void}){
 const people=useWorkspacePeople(client,workspace,revision)
 const [filter,setFilter]=useViewState<CrmFilter>('server-crm-'+triage,{query:'',stage:'',owner:'',priority:'',sort:'Recentes',offset:0})
 const [result,setResult]=useState<{rows:PilotLead[];total:number;owners:string[]}>(),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const [position,setPosition]=useViewState('crm-position-'+triage,{y:0,id:''})
 const restore=useRef(true),loadedQuery=useRef(''),focusedRow=useRef('')
 const queryKey=JSON.stringify([workspace,filter.query,filter.stage,filter.owner,filter.priority,filter.sort,filter.offset])
 const visibleResult=loadedQuery.current===queryKey?result:undefined
 useLayoutEffect(()=>{
  if(busy)return
  if(!visibleResult){if(error&&focusedRow.current&&document.activeElement===document.body)document.querySelector<HTMLElement>('[aria-label="Buscar leads"]')?.focus();focusedRow.current='';return}
  if(focusedRow.current){const id=focusedRow.current;focusedRow.current='';if(document.activeElement===document.body){const row=document.querySelector<HTMLElement>(`[data-crm-lead="${id}"]`);if(row)row.focus({preventScroll:true});else document.querySelector<HTMLElement>('[aria-label="Buscar leads"]')?.focus()} }
  if(!position.id||!restore.current)return
  const target=document.querySelector<HTMLElement>(`[data-crm-lead="${position.id}"]`)
  if(target){target.focus({preventScroll:true});window.scrollTo(0,position.y);restore.current=false}
 },[busy,visibleResult,error,position.id,position.y])
 const params={w:workspace,q:filter.query,s:filter.stage,o:filter.owner,p:filter.priority,sort_by:filter.sort}
 useEffect(()=>{
  let current=true;setBusy(true);setError('');focusedRow.current=(document.activeElement as HTMLElement|null)?.closest<HTMLElement>('[data-crm-lead]')?.dataset.crmLead??'';if(loadedQuery.current!==queryKey)setResult(undefined)
  const timer=setTimeout(()=>{void client.rpc('hub_crm_page',{...params,page_offset:filter.offset,page_size:25}).then(({data,error})=>{
   if(!current)return
   if(error||!data||!Array.isArray(data.rows)||!Array.isArray(data.owners)||typeof data.total!=='number'){loadedQuery.current='';setResult(undefined);setError('Não foi possível consultar o CRM. Tente novamente.');setBusy(false);return}
   if(filter.offset>0&&filter.offset>=data.total){setFilter({...filter,offset:data.total?Math.floor((data.total-1)/25)*25:0});return}
   loadedQuery.current=queryKey;setResult(data);setBusy(false)
  })},150)
  return ()=>{current=false;clearTimeout(timer)}
 },[client,workspace,revision,filter,retry])
 const select=(id:string,edit=false)=>{const lead=result?.rows.find(l=>l.id===id);if(lead){setPosition({y:scrollY,id});(edit?start:open)(lead)}}
 async function download(){setError('');const r=await client.rpc('hub_crm_export',params);if(r.error){setError('Não foi possível exportar o recorte completo.');return}const url=URL.createObjectURL(new Blob(['\uFEFF'+r.data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='decifaz-crm.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <><CRM triage={triage} data={{...data,leads:visibleResult?.rows.map(fullLead)??[],team:visibleResult?.owners??[]}} open={id=>select(id)} start={id=>select(id,true)} add={add} server={{people,filter,setFilter:next=>{setPosition({y:0,id:''});setFilter(next)},total:visibleResult?.total??0,busy,refreshing:busy&&!!visibleResult,download}}/>
  {error&&<p role="alert">{error} <button className="button" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></p>}
  <nav className="pagination" aria-label="Páginas do CRM"><button className="button" disabled={busy||filter.offset===0} onClick={()=>{setPosition({y:0,id:''});setFilter({...filter,offset:Math.max(0,filter.offset-25)})}}>Página anterior</button><span role="status">{busy?'Consultando…':`${result?.total?filter.offset+1:0}–${Math.min(filter.offset+25,result?.total??0)} de ${result?.total??0} estabelecimentos`}</span><button className="button" disabled={busy||filter.offset+25>=(result?.total??0)} onClick={()=>{setPosition({y:0,id:''});setFilter({...filter,offset:filter.offset+25})}}>Próxima página</button></nav>
  <p className="view-hint">{triage?'Triagem':'CRM'}: 25 registros por página. Tabela e Kanban exibem esta página; a contagem e o CSV abrangem todo o recorte.</p>
 </>
}
