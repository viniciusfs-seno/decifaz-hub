import {WorkflowForm} from './workflow-form'
import {useEffect,useRef,useState} from 'react'
import {useSessionDraft} from './session-drafts'
import {useInvalidField} from './form-guidance'
import type {PilotLead} from './pilot-journey'
import type {Solution} from './shared-catalog'
import {Choices} from './ui'
import {SecondaryFields,DraftRecovery} from './portal-patterns'
type Result={status:'saved'|'conflict';current:PilotLead}
const fields=[['Localização',[['region','Região'],['address','Endereço ou localização']]],['Canais e contato',[['contact','Responsável pelo estabelecimento'],['contactInfo','Contato do responsável'],['whatsapp','WhatsApp'],['instagram','Instagram'],['website','Site'],['other','Outros canais']]],['Contexto comercial',[['origin','Origem da oportunidade'],['verification','Verificação'],['needs','Necessidades identificadas']]],['Encaminhamento',[['owner','Responsável Decifaz'],['next','Próxima ação'],['due','Prazo'],['noDueReason','Motivo para ausência de prazo']]]] as const
const editableProfile=new Set<string>([...fields.flatMap(([,items])=>items.map(([key])=>key)),'services'])
const initial=(lead?:PilotLead)=>({name:lead?.name??'',segment:lead?.segment??'',city:lead?.city??'',notes:lead?.notes??'',profile:{...lead?.profile}})
export function LeadDetails({lead,solutions,allowed,save,onSaved}:{lead?:PilotLead;solutions:Solution[];allowed:boolean;save:(body:object,revision:number|null)=>Promise<Result|undefined>;onSaved:(lead:PilotLead)=>void}){
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
 return <WorkflowForm className="lead-details" onInvalidCapture={invalid} onInputCapture={changed} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setMessage('');try{const profile=Object.fromEntries(Object.entries(draft.profile).filter(([key,value])=>editableProfile.has(key)&&(typeof value==='string'||key==='services'&&Array.isArray(value)&&value.every(v=>typeof v==='string'))));const r=await save({...draft,profile},revision);if(!live.current){if(r?.status==='saved')clearDraft();return}if(!r)throw Error();if(r.status==='conflict'){setPreviousDraft(draft);setDraft({name:r.current.name,segment:r.current.segment,city:r.current.city,notes:r.current.notes,profile:{...r.current.profile}});setRevision(r.current.revision??0);setConflict(true);setMessage('Outra sessão alterou a ficha. Os dados atuais foram carregados. Revise antes de salvar novamente.')}else{setRevision(r.current.revision??0);setConflict(false);setPreviousDraft(undefined);setEntry({draft:initial(r.current),revision:r.current.revision??0,dirty:false});if(!lead)clearDraft();setMessage('Ficha salva.');onSaved(r.current)}}catch{if(live.current)setMessage('Não foi possível salvar a ficha. Confira seu acesso e tente novamente.')}finally{if(live.current)setBusy(false)}}}>
  {validation&&<p role="alert">{validation}</p>}
  {entry.dirty&&<p className="draft-note" role="status">Rascunho não salvo · mantido nesta sessão e neste espaço.</p>}
  {!allowed&&<p role="status">Seu papel permite consulta. A edição da ficha exige Administração ou Comercial.</p>}
  <fieldset disabled={busy||!allowed}><div className="pilot-fields">
   {(['name','segment','city'] as const).map((key,i)=><label key={key}>{['Nome','Segmento','Cidade'][i]}<input required={key==='name'} value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}
  </div>
  {lead&&<p className="muted">Cadastro existente · os campos complementares são opcionais.</p>}
  {fields.map(([section,items])=><SecondaryFields key={section} title={section}><div className="pilot-fields">{items.map(([key,label])=><label key={key}>{label}{key==='needs'?<textarea value={String(draft.profile[key]??'')} onChange={e=>profile(key,e.target.value)}/>:key==='verification'?<select value={String(draft.profile[key]??'')} onChange={e=>profile(key,e.target.value)}><option value="">Não informado</option>{['Não verificado','Parcialmente verificado','Verificado'].map(v=><option key={v}>{v}</option>)}</select>:<input type={key==='due'?'date':key==='website'?'url':key==='whatsapp'?'tel':'text'} value={String(draft.profile[key]??'')} onChange={e=>profile(key,e.target.value)}/>}</label>)}</div></SecondaryFields>)}
  <SecondaryFields title="Soluções aplicáveis e evidências"><Choices items={[...new Set([...solutions.filter(s=>s.active).map(s=>s.name),...draft.profile.services??[]])]} value={draft.profile.services??[]} on={services=>setDraft({...draft,profile:{...draft.profile,services}})}/><label className="field">Observações e evidências<textarea value={draft.notes} onChange={e=>setDraft({...draft,notes:e.target.value})}/></label><p className="muted">Selecionar uma solução não cria proposta nem altera versões já registradas.</p></SecondaryFields>
  <button className="button primary" disabled={busy}>{busy?'Salvando…':'Salvar estabelecimento'}</button></fieldset>
  {message&&<p role={message==='Ficha salva.'?'status':'alert'}>{message}</p>}{conflict&&<p>As alterações locais anteriores não foram gravadas. Confira todos os campos atuais antes de reenviar.</p>}
 {previousDraft&&<DraftRecovery restore={()=>{setDraft(previousDraft);setPreviousDraft(undefined)}}/>}
 </WorkflowForm>
}
