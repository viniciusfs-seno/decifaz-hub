import {useEffect,useLayoutEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {CRM} from './commercial'
import {fullLead,type PilotLead} from './pilot-journey'
import type {Data} from './domain'
import {useViewState} from './view-state'
export type CrmFilter={query:string;stage:string;owner:string;priority:string;sort:string;offset:number}
export function SharedCrmList({client,workspace,revision,data,triage,open,add,start}:{client:SupabaseClient;workspace:string;revision:number;data:Data;triage:boolean;open:(lead:PilotLead)=>void;add:()=>void;start:(lead:PilotLead)=>void}){
 const [filter,setFilter]=useViewState<CrmFilter>('server-crm-'+triage,{query:'',stage:'',owner:'',priority:'',sort:'Recentes',offset:0})
 const [result,setResult]=useState<{rows:PilotLead[];total:number;owners:string[]}>(),[busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 const [position,setPosition]=useViewState('crm-position-'+triage,{y:0,id:''})
 const restore=useRef(true)
 useLayoutEffect(()=>{
  if(busy||!result||!position.id||!restore.current)return
  const target=document.querySelector<HTMLElement>(`[data-crm-lead="${position.id}"]`)
  if(target){target.focus({preventScroll:true});window.scrollTo(0,position.y);restore.current=false}
 },[busy,result,position.id,position.y])
 const params={w:workspace,q:filter.query,s:filter.stage,o:filter.owner,p:filter.priority,sort_by:filter.sort}
 useEffect(()=>{
  let current=true;setBusy(true);setError('');setResult(undefined)
  const timer=setTimeout(()=>{void client.rpc('hub_crm_page',{...params,page_offset:filter.offset,page_size:25}).then(({data,error})=>{
   if(!current)return
   if(error||!data){setError('Não foi possível consultar o CRM. Tente novamente.');setBusy(false);return}
   if(filter.offset>0&&filter.offset>=data.total){setFilter({...filter,offset:data.total?Math.floor((data.total-1)/25)*25:0});return}
   setResult(data);setBusy(false)
  })},150)
  return ()=>{current=false;clearTimeout(timer)}
 },[client,workspace,revision,filter,retry])
 const select=(id:string,edit=false)=>{const lead=result?.rows.find(l=>l.id===id);if(lead){setPosition({y:scrollY,id});(edit?start:open)(lead)}}
 async function download(){setError('');const r=await client.rpc('hub_crm_export',params);if(r.error){setError('Não foi possível exportar o recorte completo.');return}const url=URL.createObjectURL(new Blob(['\uFEFF'+r.data],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='decifaz-crm.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <><CRM triage={triage} data={{...data,leads:result?.rows.map(fullLead)??[],team:result?.owners??[]}} open={id=>select(id)} start={id=>select(id,true)} add={add} server={{filter,setFilter:next=>{setPosition({y:0,id:''});setFilter(next)},total:result?.total??0,busy,download}}/>
  {error&&<p role="alert">{error} <button className="button" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></p>}
  <nav className="pagination" aria-label="Páginas do CRM"><button className="button" disabled={busy||filter.offset===0} onClick={()=>{setPosition({y:0,id:''});setFilter({...filter,offset:Math.max(0,filter.offset-25)})}}>Página anterior</button><span role="status">{busy?'Consultando…':`${result?.total?filter.offset+1:0}–${Math.min(filter.offset+25,result?.total??0)} de ${result?.total??0} estabelecimentos`}</span><button className="button" disabled={busy||filter.offset+25>=(result?.total??0)} onClick={()=>{setPosition({y:0,id:''});setFilter({...filter,offset:filter.offset+25})}}>Próxima página</button></nav>
  <p className="view-hint">{triage?'Triagem':'CRM'}: 25 registros por página. Tabela e Kanban exibem esta página; a contagem e o CSV abrangem todo o recorte.</p>
 </>
}
