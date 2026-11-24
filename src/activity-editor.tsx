import {WorkflowForm} from './workflow-form'
import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {SharedActivity} from './shared-operational'
import {businessDay} from './shared-operational'
import type {Lead} from './domain'
import {DraftRecovery} from './portal-patterns'
import {Dialog,Field,OptionGroup} from './ui'
type Assignee={id:string;name:string}
export function ActivityEditor({client,workspace,item,leadId='',projectId='',leads,close,saved,initialStatus}:{client:SupabaseClient;workspace:string;item?:SharedActivity;leadId?:string;projectId?:string;leads:Lead[];close:()=>void;saved:()=>void;initialStatus?:string}){
 const [lead,setLead]=useState(item?.lead_id??leadId),[title,setTitle]=useState(item?.title??''),[owner,setOwner]=useState(item?.owner??''),[assigned,setAssigned]=useState(item?.assigned_user_id??''),[due,setDue]=useState(item?.due_on??businessDay()),[status,setStatus]=useState(initialStatus??item?.status??'Pendente'),[result,setResult]=useState(item?.result??'')
 const [revision,setRevision]=useState(item?.revision??0),[follow,setFollow]=useState(false),[nextTitle,setNextTitle]=useState(''),[nextOwner,setNextOwner]=useState(item?.owner??''),[nextAssigned,setNextAssigned]=useState(item?.assigned_user_id??''),[nextDue,setNextDue]=useState(businessDay())
 const [people,setPeople]=useState<Assignee[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[directoryError,setDirectoryError]=useState(false)
 const [recover,setRecover]=useState<(()=>void)>()
 const operation=useRef({id:crypto.randomUUID(),payload:''})
 useEffect(()=>{let current=true;void client.rpc('hub_work_assignees',{w:workspace}).then(r=>{if(!current)return;if(r.error||!Array.isArray(r.data)){setDirectoryError(true);return}setPeople(r.data)});return()=>{current=false}},[client,workspace])
 const picker=(label:string,value:string,on:(id:string)=>void,name:(v:string)=>void)=><label>{label}<select value={value} onChange={e=>{on(e.target.value);const selected=people.find(p=>p.id===e.target.value);if(selected)name(selected.name)}}><option value="">Sem conta vinculada (responsável em texto)</option>{people.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>
 async function save(){
  if(busy)return;setBusy(true);setMessage('')
  const body={lead_id:lead,project_id:item?.project_proposal_id??projectId,title,owner,assigned_user_id:assigned||null,due:due||null,status,result,followup:follow&&status==='Concluída'?{title:nextTitle,owner:nextOwner,assigned_user_id:nextAssigned||null,due:nextDue}:null},payload=JSON.stringify(body)
  if(operation.current.payload&&operation.current.payload!==payload)operation.current.id=crypto.randomUUID()
  operation.current.payload=payload
  try{
   const r=await client.rpc('hub_save_activity',{w:workspace,a:item?.id??null,expected_revision:item?revision:null,operation_id:operation.current.id,body})
   if(r.error||!r.data){setMessage('Não foi possível salvar. Confira responsável, prazo, vínculo e seu acesso. Tente novamente.');return}
   if(r.data.status==='conflict'){setRecover(()=>()=>{setTitle(title);setOwner(owner);setAssigned(assigned);setDue(due);setStatus(status);setResult(result);setFollow(follow);setNextTitle(nextTitle);setNextOwner(nextOwner);setNextAssigned(nextAssigned);setNextDue(nextDue);setRecover(undefined)});const actual=r.data.current as SharedActivity;setRevision(actual.revision??0);setTitle(actual.title);setOwner(actual.owner);setAssigned(actual.assigned_user_id??'');setDue(actual.due_on??'');setStatus(actual.status);setResult(actual.result??'');setFollow(false);operation.current={id:crypto.randomUUID(),payload:''};setMessage('A atividade mudou em outra sessão. Dados atuais carregados; revise antes de salvar novamente.');return}
   saved();close()
  }catch{setMessage('Conexão indisponível. Tente novamente; a mesma gravação não será duplicada.')}finally{setBusy(false)}
 }
 return <Dialog title={item?'Editar acompanhamento':'Nova atividade'} subtitle="Reagende, atribua um responsável e registre o resultado." onClose={close} wide><WorkflowForm onSubmit={e=>{e.preventDefault();void save()}}><fieldset className="dialog-body" disabled={busy}>
  {!item&&!leadId&&<label>Estabelecimento<select required value={lead} onChange={e=>setLead(e.target.value)}><option value="">Selecionar</option>{leads.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label>}
  <Field label="Título da atividade" required value={title} on={setTitle}/>{picker('Conta responsável',assigned,setAssigned,setOwner)}<div className="fields"><Field label="Responsável registrado" required value={owner} on={setOwner}/><Field label="Prazo da atividade" type="date" value={due} on={setDue}/></div>
  <OptionGroup label="Situação da atividade" options={['Pendente','Em andamento','Concluída','Cancelada']} value={status} on={setStatus}/><Field label="Resultado da atividade" type="area" value={result} on={setResult}/>
  {item&&status==='Concluída'&&item.status!=='Concluída'&&<label><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>Criar próximo acompanhamento nesta conclusão</label>}
  {follow&&status==='Concluída'&&<section><h3>Próximo acompanhamento</h3><Field label="Título do próximo acompanhamento" required value={nextTitle} on={setNextTitle}/>{picker('Conta do próximo responsável',nextAssigned,setNextAssigned,setNextOwner)}<div className="fields"><Field label="Responsável do próximo acompanhamento" required value={nextOwner} on={setNextOwner}/><Field label="Prazo do próximo acompanhamento" required type="date" value={nextDue} on={setNextDue}/></div><p>Mesmo estabelecimento e projeto. A conclusão e o acompanhamento serão confirmados juntos.</p></section>}
  {directoryError&&<p role="alert">Não foi possível carregar integrantes. Feche e tente novamente para atribuir uma conta; responsáveis em texto continuam disponíveis.</p>}
  <p className="muted">“Minhas atividades” inclui somente vínculos explícitos com sua conta. Nomes antigos permanecem preservados, sem associação automática.</p>{message&&<p role="alert">{message}</p>}
 {recover&&<DraftRecovery restore={recover}/>}</fieldset><div className="dialog-foot"><button type="button" className="button" onClick={close}>Cancelar</button><button className="button primary" disabled={busy}>{busy?'Salvando…':'Salvar acompanhamento'}</button></div></WorkflowForm></Dialog>
}
