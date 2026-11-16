import {useEffect,useState,type FormEvent} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {Role} from './access'

const options:[Role,string][]=[['admin','Administração'],['commercial','Comercial'],['operations','Operação'],['finance','Financeiro']]
const labels=(roles:Role[])=>options.filter(([role])=>roles.includes(role)).map(([,label])=>label).join(', ')
const states:Record<string,string>={pending:'Pendente',accepted:'Aceito',revoked:'Revogado',expired:'Expirado'}
type Invite={id:string;recipient_email:string;roles:Role[];state:string;expires_at:string;acceptance_outcome?:string}
type PersonalInvite={id:string;workspace_name:string;roles:Role[];state:string;expires_at:string}
export type InviteMailer=(email:string,id:string)=>Promise<void>

export function InviteManager({client,workspace,sendLink}:{client:SupabaseClient;workspace:string;sendLink:InviteMailer}){
 const [email,setEmail]=useState(''),[roles,setRoles]=useState<Role[]>([])
 const [mail,setMail]=useState(true),[busy,setBusy]=useState(false)
 const [rows,setRows]=useState<Invite[]>([]),[loading,setLoading]=useState(true)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,refresh]=useState(0)
 useEffect(()=>{
  let current=true;setRows([]);setLoading(true)
  void client.rpc('hub_list_invites',{w:workspace}).then(({data,error})=>{
   if(!current)return
   if(error)setError('Não foi possível consultar os convites deste espaço.')
   else setRows(data??[])
   setLoading(false)
  })
  return ()=>{current=false}
 },[client,workspace,revision])
 async function deliver(id:string){
  try{
   const {data,error}=await client.rpc('hub_list_invites',{w:workspace})
   const target=(data as Invite[]|null)?.find(row=>row.id===id&&row.state==='pending')
   if(error||!target)throw Error()
   await sendLink(target.recipient_email,id);setNotice('Link de acesso solicitado por e-mail. O convite continua pendente até o aceite.')
  }
  catch{setError('Convite pendente. O envio do link está indisponível; tente enviar novamente ou compartilhe o link do convite.')}
 }
 async function create(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setNotice('')
  try{
   const {data,error}=await client.rpc('hub_create_invite',{w:workspace,e:email,r:roles})
   if(error||!data)throw Error()
   if(data.status==='existing_member')setError('Esta conta já integra o espaço. Revise seus papéis na gestão de Equipe.')
   else if(data.status==='pending_exists')setError('Já existe um convite pendente para este e-mail. Revogue-o antes de mudar os papéis.')
   else if(data.status!=='created')setError('Confira o e-mail e selecione pelo menos um papel válido.')
   else{
    setNotice('Convite criado. Validade de sete dias, sem acesso ao espaço antes do aceite.')
    if(mail)await deliver(data.id)
    setEmail('');setRoles([])
   }
   refresh(n=>n+1)
  }catch{setError('Não foi possível criar o convite. Confira seu acesso e tente novamente.')}
  finally{setBusy(false)}
 }
 async function revoke(id:string){
  setBusy(true);setError('');setNotice('')
  try{const {data,error}=await client.rpc('hub_revoke_invite',{i:id});if(error||data!==true)throw Error();setNotice('Convite revogado.');refresh(n=>n+1)}
  catch{setError('Não foi possível revogar. Atualize a lista para conferir o estado do convite.')}
  finally{setBusy(false)}
 }
 return <section aria-labelledby="invite-heading"><h2 id="invite-heading">Convites</h2>
  <p>Validade de sete dias. O destinatário precisa entrar com o e-mail verificado e aceitar. Convite pendente não concede acesso.</p>
  <form className="card panel" aria-label="Novo convite" onSubmit={create}><fieldset disabled={busy}>
   <label>E-mail do convite<input type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <div className="team-roles">{options.map(([role,label])=><label key={role}><input type="checkbox" checked={roles.includes(role)} onChange={e=>setRoles(e.target.checked?[...roles,role]:roles.filter(value=>value!==role))}/>{label}</label>)}</div>
   <label className="invite-mail"><input type="checkbox" checked={mail} onChange={e=>setMail(e.target.checked)}/>Enviar link de acesso por e-mail</label>
   <button className="button primary" disabled={!roles.length}>Criar convite</button>
  </fieldset></form>
  <button className="button compact" disabled={busy||loading} onClick={()=>{setError('');refresh(n=>n+1)}}>Atualizar convites</button>
  {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {loading&&<p role="status">Carregando convites…</p>}
  {!loading&&!rows.length&&<p>Nenhum convite neste espaço.</p>}
  {rows.map(row=><article className="card panel" key={row.id} aria-label={'Convite para '+row.recipient_email}>
   <h3 className="invite-email">{row.recipient_email}</h3><p>{labels(row.roles)} · {states[row.state]??row.state}</p>
   <p>Válido até {new Date(row.expires_at).toLocaleString('pt-BR')}{row.acceptance_outcome==='existing_member'?' · Vínculo existente preservado':''}</p>
   {row.state==='pending'&&<div className="actions"><button className="button" disabled={busy} onClick={()=>{setBusy(true);setError('');setNotice('');void deliver(row.id).finally(()=>setBusy(false))}}>Enviar link</button>
    <button className="button" disabled={busy} onClick={()=>void navigator.clipboard.writeText(new URL('/?convite='+row.id,location.origin).href).then(()=>setNotice('Link do convite copiado.'),()=>setError('Não foi possível copiar o link.'))}>Copiar link do convite</button>
    <button className="button" disabled={busy} onClick={()=>void revoke(row.id)}>Revogar convite</button></div>}
  </article>)}
 </section>
}

export function InviteInbox({client,onAccepted}:{client:SupabaseClient;onAccepted:(workspace:string)=>Promise<void>}){
 const [rows,setRows]=useState<PersonalInvite[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false)
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[revision,refresh]=useState(0)
 useEffect(()=>{
  let current=true;setLoading(true)
  void client.rpc('hub_my_invites').then(({data,error})=>{
   if(!current)return
   setRows(error?[]:data??[]);if(error)setError('Entre com o e-mail verificado do destinatário para consultar seus convites.');setLoading(false)
  })
  return ()=>{current=false}
 },[client,revision])
 async function accept(id:string){
  setBusy(true);setError('');setNotice('')
  try{
   const {data,error}=await client.rpc('hub_accept_invite',{i:id})
   if(error||!data)throw Error()
   if(data.status==='accepted'){
    setNotice(data.outcome==='existing_member'?'Você já integra o espaço. Seus papéis foram preservados; mudanças devem ser feitas pela Administração em Equipe.':'Convite aceito. Seu acesso foi concedido.')
    await onAccepted(data.workspace_id)
   }else setError(data.status==='issuer_unavailable'?'A Administração que concedeu este convite não está mais ativa. Solicite um novo convite.':'Convite indisponível. Confira o destinatário, a validade e se houve revogação.')
   refresh(n=>n+1)
  }catch{setError('Não foi possível concluir o aceite. Atualize os convites para conferir o resultado antes de tentar novamente.')}
  finally{setBusy(false)}
 }
 return <section aria-labelledby="my-invites-heading"><h1 id="my-invites-heading">Meus convites</h1>
  <p>Convites para seu e-mail verificado. Entrar no Hub não aceita um convite automaticamente.</p>
  <button className="button compact" disabled={busy||loading} onClick={()=>{setError('');refresh(n=>n+1)}}>Atualizar meus convites</button>
  {loading&&<p role="status">Carregando convites…</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!loading&&!error&&!rows.length&&<p>Nenhum convite para este e-mail.</p>}
  {rows.map(row=><article className="card panel" key={row.id} aria-label={'Convite de '+row.workspace_name}><h2>{row.workspace_name}</h2>
   <p>{labels(row.roles)} · {states[row.state]??row.state}</p><p>Válido até {new Date(row.expires_at).toLocaleString('pt-BR')}</p>
   {row.state==='pending'&&<button className="button primary" disabled={busy} onClick={()=>void accept(row.id)}>Aceitar convite</button>}
  </article>)}
 </section>
}
