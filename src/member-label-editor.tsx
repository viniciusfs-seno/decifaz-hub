import {useId,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {Disclosure} from './portal-patterns'
export type MemberLabel={user_id:string;display_name:string;revision:number}
export function MemberLabelEditor({client,workspace,profile,saved}:{client:SupabaseClient;workspace:string;profile:MemberLabel;saved:()=>void}){
 const help=useId()
 const [name,setName]=useState(profile.display_name),[revision,setRevision]=useState(profile.revision),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflict,setConflict]=useState<MemberLabel>()
 async function save(){if(busy)return;setBusy(true);setMessage('');try{
  const r=await client.rpc('hub_set_member_label',{w:workspace,u:profile.user_id,n:name,expected_revision:revision})
  if(r.error||!r.data){setMessage('Não foi possível salvar o nome. Confira seu acesso e tente novamente.');return}
  if(r.data.status==='conflict'){setConflict({...profile,...r.data});setMessage('Outra sessão alterou a identificação. Confira o nome atual antes de salvar.');return}
  setName(r.data.display_name);setRevision(r.data.revision);setMessage('Nome salvo neste espaço.');saved()
 }catch{setMessage('Não foi possível salvar. Confira a conexão e tente novamente.')}finally{setBusy(false)}}
 return <Disclosure title="Identificação no espaço" description="Nome exibido em responsáveis e histórico"><div className="fields"><label className="field"><span>Nome no espaço</span><input aria-describedby={help} value={name} maxLength={80} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();if(!conflict)void save()}}} disabled={busy||Boolean(conflict)} onChange={e=>{setName(e.target.value);setMessage('')}}/></label><small id={help}>Até 80 caracteres. Deixe vazio para usar a identificação da conta. Não altera login, papéis ou vínculos.</small></div>{conflict&&<div><p>Nome atual: {conflict.display_name||'Identificação da conta'}.</p><button type="button" className="button" onClick={()=>{setName(conflict.display_name);setRevision(conflict.revision);setConflict(undefined);setMessage('Revise o nome antes de salvar.')}}>Revisar nome atual</button></div>}<button type="button" className="button" disabled={busy||Boolean(conflict)} onClick={()=>void save()}>{busy?'Salvando nome…':'Salvar nome'}</button>{message&&<p role="status">{message}</p>}</Disclosure>
}
