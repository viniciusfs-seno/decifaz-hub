import {useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role} from './access'

type Member={user_id:string;email:string;roles:Role[]}
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
  {members.map(member=><MemberEditor key={workspace+member.user_id+member.roles.join(',')} member={member} save={async roles=>{
   const {data,error}=await client.rpc('hub_set_roles',{w:workspace,u:member.user_id,r:roles})
   if(error||data!==true)return false
   setNotice('Papéis salvos.')
   try{await onSaved()}catch{setError('Papéis salvos, mas seu acesso não pôde ser atualizado. Recarregue a página.')}
   refresh(n=>n+1)
   return true
  }}/>) }
 </section>
}

function MemberEditor({member,save}:{member:Member;save:(roles:Role[])=>Promise<boolean>}){
 const [selected,setSelected]=useState(member.roles)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function submit(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('')
  try{
   if(!await save(selected))setError('Não foi possível alterar os papéis. Confira sua permissão e mantenha pelo menos um administrador no espaço.')
   else setNotice('Papéis salvos.')
  }catch{setError('Não foi possível salvar. Confira a conexão e tente novamente.')}
  finally{setBusy(false)}
 }
 return <form className="card panel" aria-label={'Papéis de '+member.email} onSubmit={submit}>
  <h2>{member.email}</h2>
  <fieldset disabled={busy}><legend>Papéis deste integrante</legend>
   <div className="team-roles">{options.map(([role,label])=><label key={role}><input type="checkbox" checked={selected.includes(role)} onChange={e=>{setError('');setNotice('');setSelected(e.target.checked?[...selected,role]:selected.filter(value=>value!==role))}}/>{label}</label>)}</div>
   <button className="button primary" disabled={selected.length===0}>{busy?'Salvando…':'Salvar papéis'}</button>
  </fieldset>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </form>
}
