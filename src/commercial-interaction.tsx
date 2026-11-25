import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {day,dateLabel,type Meeting} from './domain'
import type {PilotLead} from './pilot-journey'
import {useSessionDraft} from './session-drafts'
import {WorkflowForm} from './workflow-form'
import {DraftRecovery,SecondaryFields} from './portal-patterns'
import {ClassificationSelect,MemberIdSelect} from './classification-fields'
import type {Classification} from './commercial-classifications'
import type {WorkspacePerson} from './workspace-people'
import {channelLinks} from './prospecting'
import {Field} from './ui'
export const interactionResults=[['recorded','Somente registrar'],['waiting','Aguardando resposta'],['resume','Retomar futuramente'],['advanced','Abordagem realizada / avançar'],['lost','Sem aderência / perdido'],['won','Ganho confirmado']] as const
const initial=(lead:PilotLead)=>({summary:'',kind:'other',occurred_on:day(),outcome:'recorded',reason:'',resume_on:'',meeting_id:'',plan:false,next:lead.profile.next??'',owner_id:lead.profile.owner_id??'',due:lead.profile.due??'',next_action_id:lead.profile.next_action_id??'',next_details:lead.profile.next_details??'',confirm:false,revision:lead.revision??0})
export function CommercialInteraction({client,workspace,lead,allowed,admin,people,classifications,meetings,saved}:{client:SupabaseClient;workspace:string;lead:PilotLead;allowed:boolean;admin:boolean;people:WorkspacePerson[];classifications:Classification[];meetings:Meeting[];saved:()=>void}){
 const [entry,setEntry]=useSessionDraft('commercial-interaction:'+lead.id,()=>initial(lead)),[previous,setPrevious]=useState<typeof entry>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const operation=useRef({id:crypto.randomUUID(),payload:''});const patch=(values:Partial<typeof entry>)=>setEntry(p=>({...p,...values}))
 useEffect(()=>{if(!entry.summary&&!entry.plan&&entry.revision!==(lead.revision??0))setEntry(initial(lead))},[lead.revision,entry.summary,entry.plan])
 const meeting=meetings.find(m=>m.id===entry.meeting_id)
 const links=channelLinks({whatsapp:lead.profile.whatsapp??'',website:lead.profile.website??'',instagram:lead.profile.instagram??''})
 async function save(){
  if(busy)return;setBusy(true);setMessage('')
  const body={kind:entry.kind,occurred_on:entry.occurred_on,summary:entry.summary,outcome:entry.outcome,...(['resume','lost'].includes(entry.outcome)?{reason:entry.reason}:{}),...(entry.outcome==='resume'?{resume_on:entry.resume_on}:{}),...(entry.kind==='meeting'?{meeting_id:entry.meeting_id,meeting_revision:meeting?.revision}:{}),...(entry.outcome==='won'?{confirm_won:entry.confirm}:{}),...(entry.plan&&!['lost','won'].includes(entry.outcome)?{plan:{next_action_id:entry.next_action_id,next:entry.next,next_details:entry.next_details,owner_id:entry.owner_id,due:entry.outcome==='resume'?entry.resume_on:entry.due}}:{})}
  const payload=JSON.stringify([entry.revision,body]);if(operation.current.payload&&operation.current.payload!==payload)operation.current.id=crypto.randomUUID();operation.current.payload=payload
  try{
   const r=await client.rpc('hub_record_commercial_interaction',{w:workspace,l:lead.id,expected_revision:entry.revision,operation_id:operation.current.id,body})
   if(r.error||!r.data){setMessage('Não foi possível registrar. Confira os campos, reunião realizada, aceite e seu acesso; a edição foi mantida.');return}
   if(r.data.status==='conflict'){setPrevious(entry);setEntry({...entry,revision:r.data.current.revision,next:r.data.current.profile.next??'',owner_id:r.data.current.profile.owner_id??'',due:r.data.current.profile.due??'',next_action_id:r.data.current.profile.next_action_id??''});setMessage('A ficha ou reunião mudou. Dados atuais carregados; revise o plano antes de salvar.');operation.current={id:crypto.randomUUID(),payload:''};saved();return}
   setEntry(initial(r.data.current));setPrevious(undefined);operation.current={id:crypto.randomUUID(),payload:''};setMessage('Interação e acompanhamento registrados.');saved()
  }catch{setMessage('Conexão indisponível. Sua edição foi preservada; repetir a mesma operação não duplica o registro.')}finally{setBusy(false)}
 }
 return <section className="card panel contact-planner"><h2>Registrar interação</h2><div className="actions">{links.map(link=><a className="button" key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div><p className="view-hint">Abrir um canal não confirma contato. Registre o que aconteceu; nada será enviado automaticamente.</p>
 <WorkflowForm onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={!allowed||busy}>
 <div className="fields"><label className="field">Tipo de interação<select aria-label="Tipo de interação" value={entry.kind} onChange={e=>patch({kind:e.target.value})}>{[['other','Outro contato'],['whatsapp','WhatsApp'],['phone','Telefone'],['visit','Visita'],['meeting','Reunião existente']].map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label><Field label="Data da interação" required type="date" value={entry.occurred_on} on={occurred_on=>patch({occurred_on})}/></div>
 {entry.kind==='meeting'&&<label className="field">Reunião realizada<select aria-label="Reunião realizada" required value={entry.meeting_id} onChange={e=>{const m=meetings.find(m=>m.id===e.target.value);patch({meeting_id:e.target.value,...(m?{occurred_on:m.date}:{})})}}><option value="">Selecionar reunião</option>{meetings.filter(m=>m.state==='Realizada').map(m=><option value={m.id} key={m.id}>{dateLabel(m.date)} · {m.summary||m.participants}</option>)}</select><small>O resultado será registrado nesta reunião, sem criar outra interação de reunião.</small></label>}
 <Field label="Resultado da abordagem" type="area" required value={entry.summary} on={summary=>patch({summary})}/>
 <label className="field">Resultado comercial<select aria-label="Resultado comercial" value={entry.outcome} onChange={e=>patch({outcome:e.target.value,...(e.target.value==='resume'?{plan:true}:{})})}>{interactionResults.filter(([k])=>k!=='won'||admin).map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></label>
 {['resume','lost'].includes(entry.outcome)&&<Field label="Motivo do resultado" required type="area" value={entry.reason} on={reason=>patch({reason})}/>}
 {entry.outcome==='resume'&&<Field label="Data de retomada" required type="date" value={entry.resume_on} on={resume_on=>patch({resume_on})}/>}
 {entry.outcome==='waiting'&&<p className="view-hint">A oportunidade permanece ativa. Programe um acompanhamento, se fizer sentido.</p>}
 {entry.outcome==='won'&&<><p>Exige proposta aceita pela Administração. Não cria contrato ou projeto automaticamente.</p><label className="checkline"><input required type="checkbox" checked={entry.confirm} onChange={e=>patch({confirm:e.target.checked})}/>Confirmo o ganho com aceite explícito registrado.</label></>}
 {!['lost','won'].includes(entry.outcome)&&<><label className="checkline"><input type="checkbox" checked={entry.plan} onChange={e=>patch({plan:e.target.checked})}/>Definir próxima ação</label>{entry.plan&&<><ClassificationSelect required label="Tipo da próxima ação" kind="action" items={classifications} value={entry.next_action_id} on={id=>patch({next_action_id:id,next:classifications.find(c=>c.kind==='action'&&c.id===id)?.label??entry.next})}/><Field label="Próxima ação planejada" required value={entry.next} on={next=>patch({next})}/><MemberIdSelect required label="Responsável da próxima ação" people={people} value={entry.owner_id} on={owner_id=>patch({owner_id})}/>{entry.outcome!=='resume'&&<Field label="Prazo da próxima ação" required type="date" value={entry.due} on={due=>patch({due})}/>}<SecondaryFields title="Detalhes do acompanhamento"><Field label="Detalhes da próxima ação" type="area" value={entry.next_details} on={next_details=>patch({next_details})}/></SecondaryFields><p className="view-hint">Será criada ou atualizada uma atividade vinculada, visível na Agenda e na Central.</p></>}</>}
 <button className="button primary">{busy?'Registrando…':'Registrar interação e acompanhamento'}</button></fieldset></WorkflowForm>
 {previous&&<DraftRecovery restore={()=>{setEntry({...previous,revision:entry.revision});setPrevious(undefined)}}/>}{message&&<p role="status">{message}</p>}{!allowed&&<p>Registrar interações exige Administração ou Comercial.</p>}
 </section>
}
