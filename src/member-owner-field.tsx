import {useEffect,useId,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'

// Meetings keep their existing text snapshot. Choosing a suggestion never grants
// access or infers an assignment UUID for historical text-only records.
export function MemberOwnerField({client,workspace,value,on}:{client:SupabaseClient;workspace:string;value:string;on:(value:string)=>void}){
 const id=useId(),[directory,setDirectory]=useState<{workspace:string;people:{id:string;name:string}[];error:boolean}>()
 const [retry,setRetry]=useState(0)
 useEffect(()=>{let live=true;setDirectory(undefined);void client.rpc('hub_work_assignees',{w:workspace}).then(r=>{if(live)setDirectory({workspace,people:r.error?[]:r.data??[],error:Boolean(r.error)})});return()=>{live=false}},[client,workspace,retry])
 const current=directory?.workspace===workspace?directory:undefined
 return <div><label className="field"><span>Responsável pela reunião <b>*</b></span><input required list={id} value={value} onChange={e=>on(e.target.value)} aria-describedby={id+'-help'}/></label><datalist id={id}>{current?.people.map(p=><option key={p.id} value={p.name}/>)}</datalist><small id={id+'-help'}>Integrantes ativos do espaço como sugestões. O responsável registrado em texto é preservado.</small>{!current&&<p role="status">Consultando integrantes…</p>}{current?.error&&<p role="status">Sugestões indisponíveis. Você pode manter o responsável em texto. <button type="button" className="text-button" onClick={()=>setRetry(n=>n+1)}>Tentar integrantes novamente</button></p>}</div>
}
