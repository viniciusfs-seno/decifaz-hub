import {WorkflowForm} from './workflow-form'
import {useEffect,useRef,useState} from 'react'
import {useSessionDraft} from './session-drafts'
import {useInvalidField} from './form-guidance'
import type {PilotLead} from './pilot-journey'
import type {Solution} from './shared-catalog'
import {Choices} from './ui'
import {SecondaryFields,DraftRecovery} from './portal-patterns'
import {ClassificationSelect,ExpandingTextarea,MemberIdSelect,PhoneField} from './classification-fields'
import {LeadAddress} from './lead-address'
import {commercialProfileKeys,verificationOptions,verificationChecks,type Classification} from './commercial-classifications'
import type {WorkspacePerson} from './workspace-people'
type Result={status:'saved'|'conflict';current:PilotLead}
const fields=[['Localização',[['region','Região'],['address','Endereço ou localização']]],['Canais e contato',[['contact','Responsável pelo estabelecimento'],['contactInfo','Contato do responsável'],['whatsapp','WhatsApp'],['instagram','Instagram'],['website','Site'],['other','Outros canais']]],['Contexto comercial',[['origin','Origem da oportunidade'],['verification','Verificação'],['needs','Necessidades identificadas']]],['Encaminhamento',[['owner','Responsável Decifaz'],['next','Próxima ação'],['due','Prazo'],['noDueReason','Motivo para ausência de prazo']]]] as const
const editableProfile=new Set<string>([...fields.flatMap(([,items])=>items.map(([key])=>key)),'services',...commercialProfileKeys])
const initial=(lead?:PilotLead)=>({name:lead?.name??'',segment:lead?.segment??'',city:lead?.city??'',notes:lead?.notes??'',profile:{...lead?.profile}})
export function LeadDetails({lead,solutions,allowed,save,onSaved,classifications=[],people=[]}:{classifications?:Classification[];people?:WorkspacePerson[];lead?:PilotLead;solutions:Solution[];allowed:boolean;save:(body:object,revision:number|null)=>Promise<Result|undefined>;onSaved:(lead:PilotLead)=>void}){
 const live=useRef(true)
 useEffect(()=>{live.current=true;return()=>{live.current=false}},[])
 const [entry,setEntry,clearDraft]=useSessionDraft('lead:'+(lead?.id??'new'),()=>({draft:initial(lead),revision:lead?.revision??null,dirty:false}))
 const {draft,revision}=entry
 const setDraft=(draft:ReturnType<typeof initial>)=>setEntry({...entry,draft,dirty:true})
 const setRevision=(revision:number|null)=>setEntry(previous=>({...previous,revision}))
 const {invalid,changed,validation}=useInvalidField()
 useEffect(()=>{if(!entry.dirty&&lead&&lead.revision!==entry.revision)setEntry({draft:initial(lead),revision:lead.revision??0,dirty:false})},[lead?.revision,entry.dirty])
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[conflict,setConflict]=useState(false)
 const [previousDraft,setPreviousDraft]=useState<ReturnType<typeof initial>>()
 const profile=(key:string,value:string)=>setDraft({...draft,profile:{...draft.profile,[key]:value}})
 const option=(kind:Classification['kind'],id:string)=>classifications.find(c=>c.kind===kind&&c.id===id)
 const checks=(draft.profile.verification_criteria??'').split(',').filter(Boolean)
 return <WorkflowForm className="lead-details" onInvalidCapture={invalid} onInputCapture={changed} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const profile=Object.fromEntries(Object.entries(draft.profile).filter(([key,value])=>editableProfile.has(key)&&(typeof value==='string'||key==='services'&&Array.isArray(value)&&value.every(v=>typeof v==='string'))));const r=await save({...draft,profile:{...profile,...(profile.origin_id&&profile.origin_id!=='other'?{origin_other:''}:{})}},revision);if(!live.current){if(r?.status==='saved')clearDraft();return}if(!r)throw Error();if(r.status==='conflict'){setPreviousDraft(draft);setDraft({name:r.current.name,segment:r.current.segment,city:r.current.city,notes:r.current.notes,profile:{...r.current.profile}});setRevision(r.current.revision??0);setConflict(true);setMessage('Outra sessão alterou a ficha. Os dados atuais foram carregados. Revise antes de salvar novamente.')}else{setRevision(r.current.revision??0);setConflict(false);setPreviousDraft(undefined);setEntry({draft:initial(r.current),revision:r.current.revision??0,dirty:false});if(!lead)clearDraft();setMessage('Ficha salva.');onSaved(r.current)}}catch{if(live.current)setMessage('Não foi possível salvar a ficha. Confira seu acesso e tente novamente.')}finally{if(live.current)setBusy(false)}}}>
  {validation&&<p role="alert">{validation}</p>}
  {entry.dirty&&<p className="draft-note" role="status">Rascunho não salvo · mantido nesta sessão e neste espaço.</p>}
  {!allowed&&<p role="status">Seu papel permite consulta. A edição da ficha exige Administração ou Comercial.</p>}
  <fieldset disabled={busy||!allowed}><div className="pilot-fields">
   <label>Nome da empresa<input required autoComplete="organization" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
   <ClassificationSelect label="Segmento" kind="segment" items={classifications} value={draft.profile.segment_id??''} legacy={draft.segment} on={id=>setDraft({...draft,segment:option('segment',id)?.label??draft.segment,profile:{...draft.profile,segment_id:id}})}/>
  </div><p className="view-hint">Somente o nome é obrigatório para começar. Classifique e complemente quando houver informação confiável.</p>
  <SecondaryFields title="Localização"><div className="pilot-fields"><LeadAddress city={draft.city} profile={draft.profile} on={(city,patch)=>setDraft({...draft,city,profile:{...draft.profile,...patch}})}/></div></SecondaryFields>
  <SecondaryFields title="Canais e contato"><div className="pilot-fields">
   <PhoneField value={draft.profile.whatsapp??''} on={v=>setDraft({...draft,profile:{...draft.profile,whatsapp:v,phone_kind:draft.profile.phone_kind??(lead?'legacy':'br')}})} kind={draft.profile.phone_kind??(lead?'legacy':'br')} setKind={v=>profile('phone_kind',v)}/>
   {fields[1][1].filter(([key])=>key!=='whatsapp').map(([key,label])=><label key={key}>{label}<input type={key==='website'?'url':'text'} value={String(draft.profile[key]??'')} onChange={e=>profile(key,e.target.value)}/></label>)}
  </div></SecondaryFields>
  <SecondaryFields title="Contexto comercial"><div className="pilot-fields">
   <ClassificationSelect label="Origem da oportunidade" kind="origin" items={classifications} value={draft.profile.origin_id??''} legacy={draft.profile.origin??''} on={id=>setDraft({...draft,profile:{...draft.profile,origin_id:id,origin:option('origin',id)?.label??draft.profile.origin}})}/>
   {draft.profile.origin_id==='other'&&<label>Especificar outra origem<input required value={draft.profile.origin_other??''} onChange={e=>profile('origin_other',e.target.value)}/></label>}
   <label>Verificação cadastral<select value={draft.profile.verification_code??''} onChange={e=>profile('verification_code',e.target.value)}><option value="">{draft.profile.verification?'Manter verificação legada: '+draft.profile.verification:'Não avaliado (sem decisão registrada)'}</option>{verificationOptions.map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label>
   <p className="view-hint">Não avaliado: sem conferência. Pendente: aguarda informação. Parcial: parte dos critérios conferida. Conferido: identidade, localização e contato conferidos com evidência. Isso não indica interesse nem qualificação comercial.</p>
   {draft.profile.verification_code&&draft.profile.verification_code!=='unassessed'&&<fieldset><legend>Critérios cadastrais conferidos</legend>{verificationChecks.map(([key,label])=><label className="checkline" key={key}><input type="checkbox" checked={checks.includes(key)} onChange={e=>profile('verification_criteria',(e.target.checked?[...checks,key]:checks.filter(k=>k!==key)).join(','))}/>{label}</label>)}<label>Evidência ou motivo da pendência<textarea required={draft.profile.verification_code==='checked'} value={draft.profile.verification_note??''} onChange={e=>profile('verification_note',e.target.value)}/></label></fieldset>}
   {'verification_at' in draft.profile&&<p className="view-hint">Última decisão de verificação: {String(draft.profile.verification_at)}. Autor registrado no histórico autorizado.</p>}
   <ExpandingTextarea label="Necessidades identificadas" value={draft.profile.needs??''} on={v=>profile('needs',v)}/>
  </div></SecondaryFields>
  <SecondaryFields title="Encaminhamento"><div className="pilot-fields">
   <MemberIdSelect label="Responsável Decifaz" people={people} value={draft.profile.owner_id??''} legacy={draft.profile.owner??''} on={id=>setDraft({...draft,profile:{...draft.profile,owner_id:id,owner:people.find(p=>p.id===id)?.name??draft.profile.owner}})}/>
   <ClassificationSelect label="Tipo da próxima ação" kind="action" items={classifications} value={draft.profile.next_action_id??''} legacy={draft.profile.next??''} on={id=>setDraft({...draft,profile:{...draft.profile,next_action_id:id,next:option('action',id)?.label??draft.profile.next}})}/>
   <label>Detalhes da próxima ação<textarea value={draft.profile.next_details??''} onChange={e=>profile('next_details',e.target.value)}/></label>
   <p className="view-hint">Próxima ação é uma tarefa; selecionar o tipo não altera a etapa do funil. Use o registro de interação para combinar abordagem e acompanhamento.</p>
   <label>Próxima ação (texto ou descrição legada)<input value={draft.profile.next??''} onChange={e=>profile('next',e.target.value)}/></label><label>Prazo<input type="date" value={draft.profile.due??''} onChange={e=>profile('due',e.target.value)}/></label><label>Motivo para ausência de prazo<input value={draft.profile.noDueReason??''} onChange={e=>profile('noDueReason',e.target.value)}/></label>
  </div></SecondaryFields>
  <SecondaryFields title="Soluções aplicáveis e evidências"><Choices items={[...new Set([...solutions.filter(s=>s.active).map(s=>s.name),...draft.profile.services??[]])]} value={draft.profile.services??[]} on={services=>setDraft({...draft,profile:{...draft.profile,services}})}/><label className="field">Observações e evidências<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><p className="muted">Selecionar uma solução não cria proposta nem altera versões já registradas.</p></SecondaryFields>
  <button className="button primary" disabled={busy}>{busy?'Salvando…':'Salvar estabelecimento'}</button></fieldset>
  {message&&<p role={message==='Ficha salva.'?'status':'alert'}>{message}</p>}{conflict&&<p>As alterações locais anteriores não foram gravadas. Confira todos os campos atuais antes de reenviar.</p>}
 {previousDraft&&<DraftRecovery restore={()=>{setDraft(previousDraft);setPreviousDraft(undefined)}}/>}
 </WorkflowForm>
}
