import {useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role} from './access'
import {InviteManager,type InviteMailer} from './invites'
import {Dialog} from './ui'

type Member={user_id:string;email:string;roles:Role[];revision:string;active:boolean}
type Snapshot={roles:Role[];revision:string;active:boolean}
type SaveResult=Snapshot&{status:'saved'|'conflict'}|{status:'rejected'|'missing'}
const options:[Role,string][]=[['admin','Administração'],['commercial','Comercial'],['operations','Operação'],['finance','Financeiro']]

export function Team({client,workspace,onSaved,sendInviteLink}:{client:SupabaseClient;workspace:string;onSaved:()=>Promise<void>;sendInviteLink:InviteMailer}){
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
  <InviteManager client={client} workspace={workspace} sendLink={sendInviteLink}/>
  <p>Selecione todos os papéis de cada integrante. Ao salvar, o conjunto anterior será substituído. O espaço precisa manter pelo menos uma pessoa ativa com Administração. Desativar preserva a conta, os papéis e o acesso a outros espaços.</p>
  <button className="button compact" disabled={loading} onClick={()=>refresh(n=>n+1)}>Atualizar equipe</button>
  {loading&&<p role="status">Carregando equipe…</p>}
  {error&&<p role="alert">{error}</p>}
  {notice&&<p role="status">{notice}</p>}
  {!loading&&!error&&members.length===0&&<p>Nenhum integrante neste espaço.</p>}
  {members.map(member=><MemberEditor key={workspace+member.user_id+':'+member.revision} member={member} save={async (roles,revision):Promise<SaveResult>=>{
   setNotice('');setError('')
   const {data,error}=await client.rpc('hub_update_member_roles',{w:workspace,u:member.user_id,r:roles,expected_revision:revision})
   if(error||!data)return {status:'rejected'}
   const result=data as SaveResult
   if(result.status!=='saved')return result
   setNotice('Papéis salvos.')
   try{await onSaved()}catch{setError('Papéis salvos, mas seu acesso não pôde ser atualizado. Recarregue a página.')}
   return result
  }} changeActive={async(enabled,revision):Promise<SaveResult>=>{
   setNotice('');setError('')
   const {data,error}=await client.rpc('hub_update_member_active',{w:workspace,u:member.user_id,enabled,expected_revision:revision})
   if(error||!data)return {status:'rejected'}
   const result=data as SaveResult
   if(result.status!=='saved')return result
   setNotice(enabled?'Integrante reativado.':'Integrante desativado neste espaço.')
   try{await onSaved()}catch{setError('Estado salvo, mas seu acesso não pôde ser atualizado. Recarregue a página.')}
   return result
  }}/>) }
 </section>
}

function MemberEditor({member,save,changeActive}:{member:Member;save:(roles:Role[],revision:string)=>Promise<SaveResult>;changeActive:(active:boolean,revision:string)=>Promise<SaveResult>}){
 const [selected,setSelected]=useState(member.roles)
 const [revision,setRevision]=useState(member.revision)
 const [active,setActive]=useState(member.active)
 const [conflict,setConflict]=useState<Snapshot>()
 const [confirm,setConfirm]=useState(false)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 async function persist(stateChange=false){
  setBusy(true);setError('');setNotice('')
  try{
   const result=await (stateChange?changeActive(!active,revision):save(selected,revision))
   if(result.status==='conflict'){setConflict(result);setError('Outro administrador alterou este integrante. Revise os papéis atuais antes de tentar novamente.')}
   else if(result.status==='saved'){setRevision(result.revision);setSelected(result.roles);setActive(result.active);setNotice(stateChange?(result.active?'Integrante reativado.':'Integrante desativado neste espaço.'):'Papéis salvos.')}
   else setError('Não foi possível alterar este integrante. Confira sua permissão e mantenha pelo menos um administrador ativo no espaço.')
  }catch{setError('Não foi possível salvar. Confira a conexão e tente novamente.')}
  finally{setBusy(false);setConfirm(false)}
 }
 function submit(event:FormEvent){event.preventDefault();void persist()}
 return <><form className="card panel" aria-label={'Papéis de '+member.email} onSubmit={submit}>
  <h2>{member.email}</h2>
  <p>Estado: <strong>{active?'Ativo':'Desativado'}</strong></p>
  <fieldset disabled={busy||Boolean(conflict)}><legend>{conflict?'Sua seleção desatualizada':'Papéis deste integrante'}</legend>
   <div className="team-roles">{options.map(([role,label])=><label key={role}><input type="checkbox" checked={selected.includes(role)} onChange={e=>{setError('');setNotice('');setSelected(e.target.checked?[...selected,role]:selected.filter(value=>value!==role))}}/>{label}</label>)}</div>
   <button className="button primary" disabled={selected.length===0}>{busy?'Salvando…':'Salvar papéis'}</button>
   <button type="button" className="button" onClick={()=>setConfirm(true)}>{active?'Desativar integrante':'Reativar integrante'}</button>
  </fieldset>
  {conflict&&<div><p>Papéis atuais: {options.filter(([role])=>conflict.roles.includes(role)).map(([,label])=>label).join(', ')}.</p><p>Estado atual: {conflict.active?'Ativo':'Desativado'}.</p>
   <button type="button" className="button" onClick={()=>{setSelected(conflict.roles);setRevision(conflict.revision);setActive(conflict.active);setConflict(undefined);setError('');setNotice('Revise a seleção antes de salvar.')}}>Revisar a partir dos papéis atuais</button></div>}
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
 </form>{confirm&&<Dialog title={active?'Desativar integrante?':'Reativar integrante?'} subtitle={member.email} onClose={()=>{if(!busy)setConfirm(false)}}>
  <div className="dialog-body"><p>{active?'O acesso deste integrante será bloqueado somente neste espaço, inclusive nas próximas requisições de uma sessão aberta.':'O acesso a este espaço será restaurado conforme os papéis registrados.'}</p><p>A conta Auth, o histórico e os vínculos em outros espaços serão preservados. Seleções de papéis ainda não salvas serão descartadas.</p></div>
  <div className="dialog-foot"><button type="button" className="button" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</button><button type="button" className="button primary" disabled={busy} onClick={()=>void persist(true)}>{busy?'Salvando…':active?'Confirmar desativação':'Confirmar reativação'}</button></div>
 </Dialog>}</>
}
