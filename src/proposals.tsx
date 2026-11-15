import {useState} from 'react'
import {FileText,Plus} from 'lucide-react'
import {dateLabel,day,money,norm,solutions,uid,type Data,type Proposal} from './domain'
import {Choices,Dialog,Empty,Field,Form,Page,Tag} from './ui'
import {proposalStatuses,proposalVersions,proposalText,type ProposalDecision} from './proposal-rules'

export function Proposals({data,add,open}:{data:Data;add:()=>void;open:(id:string)=>void}){
 const [query,setQuery]=useState('')
 const [status,setStatus]=useState('')
 const rows=proposalVersions(data.proposals).filter(p=>(!status||p.status===status)&&norm(p.title+' '+data.leads.find(l=>l.id===p.leadId)?.name).includes(norm(query.trim())))
 return <Page title="Propostas comerciais" description="Prepare o escopo a partir do diagnóstico e registre o retorno do cliente." actions={<button className="button primary" onClick={add}><Plus size={16}/> Nova proposta</button>}>
 <div className="toolbar"><Field label="Buscar proposta ou estabelecimento" value={query} on={setQuery}/><Field label="Situação da versão atual" value={status} options={proposalStatuses} on={setStatus}/></div>
 <div className="card table-wrap">{rows.length?<table><thead><tr><th>Proposta</th><th>Estabelecimento</th><th>Versão atual</th><th>Implantação</th><th>Mensalidade</th><th>Validade</th><th>Situação</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><button className="text-button lead-name" onClick={()=>open(p.id)}>{p.title}</button></td><td>{data.leads.find(l=>l.id===p.leadId)?.name}</td><td>v{p.version}</td><td>{p.setup===undefined?'Restrito':money(p.setup)}</td><td>{p.monthly===undefined?'Restrito':money(p.monthly)}</td><td>{dateLabel(p.validity)}</td><td><Tag tone={p.status==='Aceita'?'green':p.status==='Recusada'?'rose':'neutral'}>{p.status}</Tag></td></tr>)}</tbody></table>:<Empty title="Nenhuma proposta encontrada" detail="Cadastre uma proposta ou ajuste os filtros."/>}</div>
 </Page>
}

export function ProposalEditor({data,item,leadId='',meetingId='',save,close,open,project,projectExists,readOnly=false,financial=true}:{data:Data;item?:Proposal;leadId?:string;meetingId?:string;save:(p:Proposal,decision?:ProposalDecision)=>boolean|Promise<boolean>;close:()=>void;open:(id:string)=>void;project?:(p:Proposal)=>void;projectExists?:(id:string)=>boolean;readOnly?:boolean;financial?:boolean}){
 const [p,set]=useState<Proposal>(item??{id:'',leadId,meetingId,title:'',services:[],scope:'',setup:0,monthly:0,terms:'',validity:day(14),version:1,status:'Rascunho'})
 const [amount,setAmount]=useState(String(p.setup??0))
 const [monthly,setMonthly]=useState(String(p.monthly??0))
 const [revision,setRevision]=useState(false)
 const [decision,setDecision]=useState('')
 const [when,setWhen]=useState(day())
 const [evidence,setEvidence]=useState('')
 const [error,setError]=useState('')
 const [copied,setCopied]=useState('')
 const [saving,setSaving]=useState(false)
 const hasProject=!!item&&(projectExists?.(item.id)??data.projects.some(v=>v.proposalId===item.id))
 const lead=data.leads.find(l=>l.id===p.leadId)
 const meetings=data.meetings.filter(m=>m.leadId===p.leadId&&m.state==='Realizada')
 const meeting=meetings.find(m=>m.id===p.meetingId)
 const group=item?.seriesId||item?.id
 const versions=item?data.proposals.filter(v=>(v.seriesId||v.id)===group).sort((a,b)=>b.version-a.version):[]
 const latest=!item||versions[0]?.id===item.id
 const editable=!readOnly&&(revision||(!item||item.status==='Rascunho'&&latest))
 const dirty=!!item&&(JSON.stringify(p)!==JSON.stringify(item)||financial&&(amount!==String(item.setup)||monthly!==String(item.monthly)))
 const canDecide=!readOnly&&!!(item&&latest&&['Rascunho','Enviada','Negociação'].includes(item.status))
 const options=item?.status==='Rascunho'?['Enviada']:item?.status==='Enviada'?['Negociação','Aceita','Recusada','Expirada']:['Aceita','Recusada','Expirada']
 const setField=(key:keyof Proposal,value:string)=>set({...p,[key]:value})
 async function saveDraft(){
  if(saving)return
  if(!lead||!p.title.trim()||!p.scope.trim()||!p.validity||!amount.trim()||!monthly.trim()||[amount,monthly].some(x=>!Number.isFinite(Number(x))||Number(x)<0))return setError('Informe estabelecimento, título, escopo, validade e valores válidos.')
  const id=revision||!item?uid():item.id
  setSaving(true)
  try{if(await save({...p,id,seriesId:group||id,version:revision?(versions[0]?.version??0)+1:item?.version??1,status:'Rascunho',title:p.title.trim(),setup:Number(amount),monthly:Number(monthly),sentAt:undefined,decisionAt:undefined,decisionNote:undefined,events:revision?[]:p.events}))close();else setError('Não foi possível salvar. Atualize a lista e confira a versão atual.')}finally{setSaving(false)}
 }
 async function record(){
  if(saving)return
  if(!item||!decision||!evidence.trim()||!when||when>day())return setError('Informe a situação, a data do ocorrido e a evidência ou contexto.')
  setSaving(true)
  try{if(await save(item,{status:decision,date:when,note:evidence.trim()}))close()
  else setError('O andamento não foi salvo. Confira a versão atual, a etapa do CRM e a data do ocorrido.')}finally{setSaving(false)}
 }
 const controls=<><div className="fields">
 <label className="field"><span>Estabelecimento *</span><select value={p.leadId} required disabled={!!item} onChange={e=>set({...p,leadId:e.target.value,meetingId:''})}><option value="">Selecionar</option>{data.leads.map(l=><option value={l.id} key={l.id}>{l.name}</option>)}</select></label>
 <label className="field"><span>Diagnóstico de reunião</span><select value={p.meetingId??''} onChange={e=>setField('meetingId',e.target.value)}><option value="">Sem diagnóstico vinculado</option>{meetings.map(m=><option key={m.id} value={m.id}>{dateLabel(m.date)} · {m.summary.slice(0,65)}</option>)}</select></label>
 <Field label="Título" required value={p.title} on={v=>setField('title',v)}/><Field label="Validade" required type="date" value={p.validity} on={v=>setField('validity',v)}/>
 {financial&&<><Field label="Implantação (R$)" required type="number" min={0} step="0.01" value={amount} on={setAmount}/><Field label="Mensalidade (R$)" required type="number" min={0} step="0.01" value={monthly} on={setMonthly}/></>}
 </div>{meeting&&<div className="callout"><div><b>Diagnóstico interno · {dateLabel(meeting.date)}</b><p>{meeting.summary}</p></div></div>}
 <Choices items={solutions} value={p.services} on={services=>set({...p,services})}/>
 <Field label="Escopo e entregáveis" required type="area" value={p.scope} on={v=>setField('scope',v)}/>{financial&&<Field label="Condições, limites e dependências" type="area" value={p.terms} on={v=>setField('terms',v)}/>}</>
 return <Dialog title={revision?'Nova revisão':item?item.title:'Nova proposta'} subtitle={item?'Versão '+item.version+' · '+item.status:lead?.name} onClose={close} wide>
 {editable?<Form onClose={close} onSave={saveDraft} error={error} label={saving?"Salvando…":"Salvar rascunho"}>{controls}</Form>:<div className="dialog-body">
 <div className="actions"><Tag>{item?.status}</Tag><Tag>v{item?.version}</Tag>{item?.sentAt&&<Tag>Envio registrado em {dateLabel(item.sentAt)}</Tag>}</div>
 <p className="muted">{lead?.name} · Validade {dateLabel(p.validity)}</p>
 {meeting&&<div className="callout"><div><b>Diagnóstico vinculado · {dateLabel(meeting.date)}</b><p>{meeting.summary}</p></div></div>}
 {financial&&<div className="lead-summary"><div><span>Implantação</span><b>{p.setup===undefined?'Restrito':money(p.setup)}</b></div><div><span>Mensalidade</span><b>{p.monthly===undefined?'Restrito':money(p.monthly)}</b></div></div>}
 <h3>Escopo</h3><p className="details-line">{p.scope}</p>{p.services.length>0&&<p>{p.services.join(' · ')}</p>}{p.terms&&<p className="details-line">{p.terms}</p>}
 {project&&item?.status==='Aceita'&&(lead?.stage==='Ganho'||hasProject)&&<div><button className="button primary" onClick={()=>project(item)}>{hasProject?'Abrir projeto vinculado':'Abrir projeto a partir do aceite'}</button></div>}
 {!readOnly&&latest&&item?.status!=='Aceita'&&<div><button className="button" onClick={()=>{setError('');setRevision(true)}}>Criar nova versão</button></div>}
 </div>}
 {item&&!revision&&<div className="dialog-body">
 {financial&&<><div className="actions"><button className="button" onClick={async()=>{try{await navigator.clipboard.writeText(proposalText(item,lead?.name??''));setCopied('Texto copiado.')}catch{setCopied('Selecione e copie o texto na prévia.')}}}>Copiar texto da versão salva</button><span role="status">{copied}</span></div>
 <details className="proposal-preview"><summary><FileText size={16}/> Prévia para compartilhar</summary><pre>{proposalText(item,lead?.name??'')}</pre></details></>}
 {canDecide&&<form className="proposal-decision" onSubmit={e=>{e.preventDefault();record()}}><h3>Registrar andamento</h3><p className="muted">Registre o que já ocorreu com o cliente. O aceite atualiza o CRM para Ganho.</p><div className="fields"><Field label="Nova situação" options={options} required value={decision} on={setDecision}/><Field label="Data do ocorrido" required type="date" value={when} on={setWhen}/></div><Field label={decision==='Aceita'?'Evidência do aceite explícito':'Canal, evidência ou contexto'} required type="area" value={evidence} on={setEvidence}/>{error&&<p className="error" role="alert">{error}</p>}{dirty&&<p className="muted">Salve as alterações do rascunho antes de registrar o envio.</p>}<button className="button primary" disabled={dirty||saving}>Registrar {decision==='Aceita'?'aceite':decision==='Enviada'?'envio':'andamento'}</button></form>}
 <h3>Histórico de versões</h3><div className="actions">{versions.map(v=>v.id===item.id?<Tag key={v.id}>v{v.version} · {v.status}</Tag>:<button key={v.id} className="button compact" onClick={()=>open(v.id)}>v{v.version} · {v.status}</button>)}</div>
 {!!item.events?.length&&<ol className="timeline">{[...item.events].reverse().map((e,i)=><li key={i}><b>{e.status} · {dateLabel(e.date)}</b><p>{e.note}</p></li>)}</ol>}
 </div>}
 </Dialog>
}
