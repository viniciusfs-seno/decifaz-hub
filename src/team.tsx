import {useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role} from './access'

type Member={user_id:string;email:string;roles:Role[];revision:string}
type SaveResult={status:'saved'|'conflict';roles:Role[];revision:string}|{status:'rejected'|'missing'}
const options:[Role,string][]=[['admin','Administração'],['commercial','Comercial'],['operations','Operação'],['finance','Financeiro']]

export function Team({client,workspace,onSaved}:{client:SupabaseClient;workspace:string;onSaved:()=>Promise<void>}){
 const [members,setMembers]=useState<Member[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [revision,refresh]=useState(0)
 useEffect(()=>{
  let current=true
  setLoading(true);setMembers([]);setError('')
  void client.rpc('hub_list_members',{w:workspace}).then(({data,error})=>{
   if(!current)return
   if(error)setError('Não foi possível consultar a equipe. Confira seu acesso e tente novamente.')
   else setMembers(data??[])
   setLoading(false)
  })
  return ()=>{current=false}
 },[client,workspace,revision])
 return <section className="team-members" aria-labelledby="team-heading">
  <h1 id="team-heading">Equipe</h1><p>Administração · Papéis no espaço atual</p>
  <p>Selecione todos os papéis de cada integrante. Ao salvar, o conjunto anterior será substituído. O espaço precisa manter pelo menos uma pessoa com Administração.</p>
  <button className="button compact" disabled={loading} onClick={()=>refresh(n=>n+1)}>Atualizar equipe</button>
  {loading&&<p role="status">Carregando equipe…</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&!error&&members.length===0&&<p>Nenhum integrante neste espaço.</p>}
  {members.map(member=><MemberEditor key={workspace+member.user_id} member={member} save={async (roles,revision):Promise<SaveResult>=>{
   setNotice('');setError('')
   const {data,error}=await client.rpc('hub_update_member_roles',{w:workspace,u:member.user_id,r:roles,expected_revision:revision})
   if(error||!data)return {status:'rejected'}
   const result=data as SaveResult
   if(result.status!=='saved')return result
   setNotice('Papéis salvos.')
   try{await onSaved()}catch{setError('Papéis salvos, mas seu acesso não pôde ser atualizado. Recarregue a página.')}
   return result
  }}/>) }
 </section>
}

function MemberEditor({member,save}:{member:Member;save:(roles:Role[],revision:string)=>Promise<SaveResult>}){
 const [selected,setSelected]=useState(member.roles)
 const [revision,setRevision]=useState(member.revision)
 const [conflict,setConflict]=useState<{roles:Role[];revision:string}>()
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('')
  try{
   const result=await save(selected,revision)
   if(result.status==='conflict'){setConflict(result);setError('Outro administrador alterou este integrante. Revise os papéis atuais antes de tentar novamente.')}
   else if(result.status==='saved'){setRevision(result.revision);setSelected(result.roles);setNotice('Papéis salvos.')}
   else setError('Não foi possível alterar os papéis. Confira sua permissão e mantenha pelo menos um administrador no espaço.')
  }catch{setError('Não foi possível salvar. Confira a conexão e tente novamente.')}
  finally{setBusy(false)}
 }
 return <form className="card panel" aria-label={'Papéis de '+member.email} onSubmit={submit}>
  <h2>{member.email}</h2>
  <fieldset disabled={busy||Boolean(conflict)}><legend>{conflict?'Sua seleção desatualizada':'Papéis deste integrante'}</legend>
   <div className="team-roles">{options.map(([role,label])=><label key={role}><input type="checkbox" checked={selected.includes(role)} onChange={e=>{setError('');setNotice('');setSelected(e.target.checked?[...selected,role]:selected.filter(value=>value!==role))}}/>{label}</label>)}</div>
   <button className="button primary" disabled={selected.length===0}>{busy?'Salvando…':'Salvar papéis'}</button>
  </fieldset>
  {conflict&&<div><p>Papéis atuais: {options.filter(([role])=>conflict.roles.includes(role)).map(([,label])=>label).join(', ')}.</p>
   <button type="button" className="button" onClick={()=>{setSelected(conflict.roles);setRevision(conflict.revision);setConflict(undefined);setError('');setNotice('Revise a seleção antes de salvar.')}}>Revisar a partir dos papéis atuais</button></div>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </form>
}
