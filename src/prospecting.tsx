import {WorkflowForm} from './workflow-form'
import {useSessionDraft} from './session-drafts'
import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {active,dateLabel,norm,type Data,type Lead} from './domain'
import type {PilotLead} from './pilot-journey'
import type {SharedActivity} from './shared-operational'
import {useViewState} from './view-state'
import {Empty,Field,Page,Priority,Tag} from './ui'

export function channelLinks(lead:Pick<Lead,'whatsapp'|'website'|'instagram'>){
 const links:{label:string;url:string}[]=[]
 const digits=lead.whatsapp.replace(/\D/g,'')
 if([10,11,12,13].includes(digits.length)){const phone=digits.length<=11?'55'+digits:digits;if(phone.startsWith('55'))links.push({label:'Abrir WhatsApp',url:'https://wa.me/'+phone})}
 const safe=(value:string)=>{try{const u=new URL(value.match(/^https?:\/\//i)?value:'https://'+value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&u.hostname.includes('.')?u.href:''}catch{return ''}}
 const site=lead.website&&!/^[a-z]+:/i.test(lead.website.replace(/^https?:/i,''))?safe(lead.website):''
 if(site)links.push({label:'Abrir site',url:site})
 const instagram=lead.instagram.trim();const handle=instagram.replace(/^@/,'')
 const insta=/^[\w.]+$/.test(handle)?'https://www.instagram.com/'+encodeURIComponent(handle)+'/':safe(instagram)
 if(insta&&new URL(insta).hostname.replace(/^www\./,'')==='instagram.com')links.push({label:'Abrir Instagram',url:insta})
 return links
}
export function ProspectingQueue({data,tasks,open}:{data:Data;tasks:SharedActivity[];open:(id:string)=>void}){
 const [filter,set]=useViewState('prospecting-filter',{owner:'',reason:'',query:''})
 const owners=[...new Set(data.leads.map(l=>l.owner).filter(Boolean))].sort()
 const rows=data.leads.filter(l=>active(l.stage)).map(lead=>{
  const triage=data.triages.find(t=>t.leadId===lead.id)
  const reasons=[...(['Identificado','Em pesquisa'].includes(lead.stage)?['Pesquisa']:[]),...(!triage?.completed?['Triagem incompleta']:[]),...(lead.stage==='Contato planejado'||tasks.some(t=>t.lead_id===lead.id&&!['Concluída','Cancelada'].includes(t.status))?['Contato planejado']:[]),...(!lead.next?['Sem próxima ação']:[])]
  return {lead,triage,reasons}
 }).filter(({lead,reasons})=>reasons.length&&(!filter.owner||lead.owner===filter.owner||filter.owner==='__none'&&!lead.owner)&&(!filter.reason||reasons.includes(filter.reason))&&norm(lead.name+' '+lead.city).includes(norm(filter.query)))
 return <Page title="Central de prospecção" description="Organize a pesquisa e a próxima abordagem, sem presumir necessidades não confirmadas.">
  <div className="toolbar"><Field label="Buscar na prospecção" value={filter.query} on={query=>set({...filter,query})}/><label>Responsável da fila<select value={filter.owner} onChange={e=>set({...filter,owner:e.target.value})}><option value="">Todo o espaço</option><option value="__none">Sem responsável</option>{owners.map(o=><option key={o}>{o}</option>)}</select></label><Field label="Motivo da pendência" value={filter.reason} options={['Pesquisa','Triagem incompleta','Contato planejado','Sem próxima ação']} on={reason=>set({...filter,reason})}/></div>
  <p role="status">{rows.length} estabelecimentos no recorte · uma ficha por estabelecimento</p>
  {rows.length?rows.map(({lead,triage,reasons})=><article className="card panel" key={lead.id}><div className="row-between"><button className="text-button lead-name" onClick={()=>open(lead.id)}>{lead.name}</button><Priority triage={triage}/></div><p>{lead.city||'Cidade não informada'} · {lead.owner||'Sem responsável'} · {lead.stage}</p><div className="actions">{reasons.map(r=><Tag key={r}>{r}</Tag>)}</div><p>{lead.next||'Defina a próxima ação'} · {dateLabel(lead.due)}</p><p className="muted">{!lead.contact?'Responsável do estabelecimento não informado. ':''}{!channelLinks(lead).length?'Sem canal válido cadastrado. ':''}{triage?.hypotheses?'Há hipóteses a confirmar na triagem.':''}</p></article>):<Empty title="Fila sem pendências neste recorte" detail="Ajuste os filtros para consultar os demais responsáveis."/>}
 </Page>
}
export function ContactPlanner({client,workspace,lead,allowed,saved}:{client:SupabaseClient;workspace:string;lead:PilotLead;allowed:boolean;saved:()=>void}){
 const [entry,setEntry]=useSessionDraft('contact:'+lead.id,()=>({result:'',next:lead.profile.next??'',owner:lead.profile.owner??'',due:lead.profile.due??'',create:true,plan:false,revision:lead.revision??0}))
 const {result,next,owner,due,create,plan,revision}=entry
 const setResult=(result:string)=>setEntry(v=>({...v,result})),setNext=(next:string)=>setEntry(v=>({...v,next})),setOwner=(owner:string)=>setEntry(v=>({...v,owner})),setDue=(due:string)=>setEntry(v=>({...v,due})),setCreate=(create:boolean)=>setEntry(v=>({...v,create})),setPlan=(plan:boolean)=>setEntry(v=>({...v,plan}))
 const setRevision=(action:number|((v:number)=>number))=>setEntry(v=>({...v,revision:typeof action==='function'?action(v.revision):action}))
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('')
 const operation=useRef({id:crypto.randomUUID(),payload:''})
 useEffect(()=>{if(plan||result||(lead.revision??0)<revision)return;setRevision(previous=>Math.max(previous,lead.revision??0));setNext(lead.profile.next??'');setOwner(lead.profile.owner??'');setDue(lead.profile.due??'')},[lead.revision,plan,result,revision])
 async function save(){
  if(busy)return;setBusy(true);setMessage('')
  const body={result,...(plan?{next,owner,due,create_activity:create}:{})},payload=JSON.stringify(body)
  if(operation.current.payload&&operation.current.payload!==payload)operation.current.id=crypto.randomUUID()
  operation.current.payload=payload
  try{
   const r=await client.rpc('hub_plan_contact',{w:workspace,l:lead.id,expected_revision:revision,operation_id:operation.current.id,body})
   if(r.error||!r.data){setMessage('Não foi possível registrar. Confira resultado, responsável, prazo e seu acesso. Tente novamente.');return}
   setRevision(r.data.current.revision)
   if(r.data.status==='conflict'){setMessage('A ficha mudou. Dados atuais carregados; revise a próxima ação antes de salvar.');setNext(r.data.current.profile.next??'');setOwner(r.data.current.profile.owner??'');setDue(r.data.current.profile.due??'');operation.current={id:crypto.randomUUID(),payload:''};return}
   setResult('');setPlan(false);operation.current={id:crypto.randomUUID(),payload:''};setMessage('Abordagem registrada.');saved()
  }catch{setMessage('Conexão indisponível. Tente novamente; a mesma operação não será duplicada.')}finally{setBusy(false)}
 }
 const links=channelLinks({...lead.profile,whatsapp:lead.profile.whatsapp??'',website:lead.profile.website??'',instagram:lead.profile.instagram??''})
 return <section className="card panel contact-planner"><h2>Abordagem e próxima ação</h2><div className="actions">{links.map(link=><a key={link.label} className="button" href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</div><p className="muted">Abrir um canal não registra contato realizado. Registre abaixo apenas o que aconteceu; hipóteses continuam na triagem.</p><WorkflowForm onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={!allowed||busy}><Field label="Resultado da abordagem" type="area" value={result} on={setResult} required={!plan}/><label><input type="checkbox" checked={plan} onChange={e=>setPlan(e.target.checked)}/>Definir próxima ação</label>{plan&&<><Field label="Próxima ação planejada" required value={next} on={setNext}/><div className="fields"><Field label="Responsável da próxima ação" required value={owner} on={setOwner}/><Field label="Prazo da próxima ação" required type="date" value={due} on={setDue}/></div><label><input type="checkbox" checked={create} onChange={e=>setCreate(e.target.checked)}/>Criar atividade vinculada</label></>}<button className="button primary">{busy?'Registrando…':'Salvar abordagem e plano'}</button></fieldset></WorkflowForm>{message&&<p role="status">{message}</p>}{!allowed&&<p>Seu papel permite consultar; registrar uma abordagem exige acesso comercial.</p>}</section>
}
