import {meetingLink} from './meeting-link'
import {MeetingPresentation} from './meeting-presentation'
import {useState} from 'react'
import {ArrowRight,ClipboardList,Columns3,LayoutList,Search} from 'lucide-react'
import {active,activityTypes,channels,criteria,dateLabel,day,emptyLead,emptyTriage,grade,norm,overdue,pending,script,solutions,stages,uid,type Activity,type Data,type Lead,type Meeting,type Stage,type Triage} from './domain'
import {Choices,Dialog,Empty,Field,Form,Page,Priority,Tag} from './ui'

export function CRM({data,open,add,triage,start}:{data:Data;open:(id:string)=>void;add:()=>void;triage?:boolean;start:(id:string)=>void}){
 const [query,setQuery]=useState('')
 const [stage,setStage]=useState('')
 const [owner,setOwner]=useState('')
 const [priority,setPriority]=useState('')
 const [sort,setSort]=useState('Recentes')
 const [kanban,setKanban]=useState(false)
 const find=(id:string)=>data.triages.find(t=>t.leadId===id)
 const leads=data.leads.filter(l=>norm([l.name,l.segment,l.city,l.region,l.whatsapp,l.instagram].join(' ')).includes(norm(query.trim()))&&(!stage||l.stage===stage)&&(!owner||l.owner===owner)&&(!priority||(grade(find(l.id))?.label??'Sem classificação')===priority)).sort((a,b)=>sort==='Nome'?a.name.localeCompare(b.name,'pt-BR'):sort==='Prazo'?(a.due||'9999').localeCompare(b.due||'9999'):b.created.localeCompare(a.created))
 return <Page title={triage?'Triagem comercial':'Captação e CRM'} description={triage?'Pesquise o estabelecimento e classifique a oportunidade com base em evidências.':'Acompanhe estabelecimentos, responsáveis e próximas ações ao longo do funil.'} actions={<button className="button primary" onClick={add}>＋ Novo lead</button>}>
 <div className="toolbar"><label className="search"><Search size={17}/><input aria-label="Buscar leads" placeholder="Buscar estabelecimento..." value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Etapa" value={stage} onChange={e=>setStage(e.target.value)}><option value="">Todas as etapas</option>{stages.map(s=><option key={s}>{s}</option>)}</select><select aria-label="Responsável" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{data.team.map(s=><option key={s}>{s}</option>)}</select><select aria-label="Prioridade" value={priority} onChange={e=>setPriority(e.target.value)}><option value="">Todas as prioridades</option>{['A','B','C','Sem classificação'].map(s=><option key={s}>{s}</option>)}</select><select aria-label="Ordenar" value={sort} onChange={e=>setSort(e.target.value)}>{['Recentes','Nome','Prazo'].map(s=><option key={s}>{s}</option>)}</select>{!triage&&<div className="segmented"><button aria-label="Tabela" aria-pressed={!kanban} onClick={()=>setKanban(false)}><LayoutList size={17}/></button><button aria-label="Kanban" aria-pressed={kanban} onClick={()=>setKanban(true)}><Columns3 size={17}/></button></div>}</div>
 {!leads.length?<div className="card"><Empty detail="Ajuste a busca ou cadastre um estabelecimento."/></div>:kanban?<div className="kanban">{stages.filter(s=>!stage||s===stage).map(s=><section key={s}><h3>{s} <Tag>{leads.filter(l=>l.stage===s).length}</Tag></h3>{leads.filter(l=>l.stage===s).map(l=><button className="card kanban-lead" key={l.id} onClick={()=>open(l.id)}><b>{l.name}</b><small>{l.segment} · {l.city}</small><Priority triage={find(l.id)}/><small>{l.next||'Sem próxima ação'} · {dateLabel(l.due)}</small></button>)}</section>)}</div>:<div className="card table-wrap"><table><thead><tr><th>Estabelecimento</th><th>Etapa</th><th>Prioridade</th><th>Responsável</th><th>Próxima ação</th><th>Prazo</th><th><span className="sr">Abrir</span></th></tr></thead><tbody>{leads.map(l=><tr key={l.id}><td><button className="text-button lead-name" onClick={()=>open(l.id)}>{l.name}</button><small>{l.segment} · {l.city}{l.demo?' · Fictício':''}</small></td><td><Tag>{l.stage}</Tag></td><td><Priority triage={find(l.id)}/></td><td>{l.owner}</td><td>{l.next||'—'}</td><td>{dateLabel(l.due)}</td><td><button className="button compact" aria-label={(triage?'Triar ':'Abrir ')+l.name} onClick={()=>triage?start(l.id):open(l.id)}>{triage?'Triar':<ArrowRight size={16}/>}</button></td></tr>)}</tbody></table><div className="table-foot">{leads.length} {leads.length===1?'estabelecimento':'estabelecimentos'}</div></div>}
 </Page>
}
export function LeadEditor({data,lead,onSave,close}:{data:Data;lead?:Lead;onSave:(l:Lead,reason:string)=>boolean;close:()=>void}){
 const [l,set]=useState(lead??emptyLead(data.team[0]))
 const [reason,setReason]=useState('')
 const [confirm,setConfirm]=useState(false)
 const [duplicate,setDuplicate]=useState(false)
 const [error,setError]=useState('')
 const isNew=!lead
 const stageChanged=!lead?l.stage!=='Identificado':lead.stage!==l.stage
 const setValue=(key:keyof Lead,v:string)=>{set({...l,[key]:v});if(['name','city','website','whatsapp','instagram'].includes(key))setDuplicate(false);if(key==='stage')setConfirm(false)}
 const fields=(items:[keyof Lead,string,string?,boolean?][])=>items.map(([key,label,type,required])=><Field key={key} label={label} type={type} required={required} value={String(l[key]??'')} on={v=>setValue(key,v)}/>)
 function save(){
  if(!l.name.trim()||!l.city.trim()||!l.segment.trim()||!l.owner) return setError('Preencha nome, cidade, segmento e responsável.')
  if(active(l.stage)&&(!l.next.trim()||(!l.due&&!l.noDueReason.trim()))) return setError('Informe a próxima ação e o prazo ou justifique a ausência de prazo.')
  if(stageChanged&&!reason.trim()) return setError('Informe o contexto da mudança de etapa.')
  if(stageChanged&&l.stage==='Ganho'&&!confirm) return setError('Confirme o aceite do cliente para marcar como ganho.')
  const same=(a:string,b:string)=>!!a.trim()&&norm(a.trim())===norm(b.trim())
  const collision=data.leads.find(x=>x.id!==l.id&&((same(x.name,l.name)&&same(x.city,l.city))||same(x.website,l.website)||same(x.instagram,l.instagram)||same(x.whatsapp.replace(/\D/g,''),l.whatsapp.replace(/\D/g,''))))
  if(collision&&!duplicate){setDuplicate(true);return setError('Possível duplicata: '+collision.name+'. Confira o cadastro existente ou selecione Salvar mesmo assim.')}
  if(onSave({...l,name:l.name.trim(),id:l.id||uid()},reason.trim()))close()
 }
 return <Dialog title={isNew?'Novo lead':'Editar estabelecimento'} subtitle="Cadastro e encaminhamento comercial" onClose={close} wide><Form onSave={save} onClose={close} error={error} label={duplicate?'Salvar mesmo assim':'Salvar lead'}>
 <div className="fields">{fields([['name','Nome comercial','text',true],['segment','Segmento','text',true],['city','Cidade','text',true],['region','Região'],['address','Endereço ou localização'],['origin','Origem da oportunidade'],['instagram','Instagram'],['website','Site','url'],['whatsapp','WhatsApp','tel'],['other','Outros canais'],['contact','Nome do responsável no estabelecimento'],['contactInfo','Contato do responsável']])}<Field label="Responsável Decifaz" options={data.team} required value={l.owner} on={v=>setValue('owner',v)}/><Field label="Verificação" options={['Não verificado','Parcialmente verificado','Verificado']} value={l.verification} on={v=>setValue('verification',v)}/><Field label="Etapa no funil" options={stages} required value={l.stage} on={v=>setValue('stage',v as Stage)}/>{stageChanged&&<Field label="Contexto da mudança de etapa" required value={reason} on={setReason}/>}</div>
 {stageChanged&&l.stage==='Ganho'&&<label className="checkline"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Confirmo que houve aceite explícito do cliente.</label>}
 <div className="fields">{fields([['next','Próxima ação','text',active(l.stage)],['due','Prazo','date'],['noDueReason','Motivo para ausência de prazo'],['needs','Necessidades identificadas','area'],['notes','Observações e evidências','area']])}</div><h3>Soluções potenciais</h3><Choices items={solutions} value={l.services} on={services=>set({...l,services})}/>
 </Form></Dialog>
}
const steps=['Identificação','Presença digital','Diagnóstico preliminar','Soluções aplicáveis','Pontuação','Encaminhamento']
export function TriageEditor({lead,triage,team,save,close}:{lead:Lead;triage?:Triage;team:string[];save:(t:Triage,lead:Lead)=>boolean;close:()=>void}){
 const [t,set]=useState(triage??emptyTriage(lead))
 const [l,setLead]=useState(lead)
 const [step,setStep]=useState(0)
 const [error,setError]=useState('')
 const [qualify,setQualify]=useState(false)
 const setT=(key:keyof Triage,value:string)=>set({...t,[key]:value})
 const field=(key:'observations'|'reports'|'hypotheses'|'evidence'|'approach'|'next'|'due'|'owner',label:string,type='area')=><Field key={key} label={label} type={type} options={key==='owner'?team:undefined} value={t[key]} on={v=>setT(key,v)}/>
 const reviewed=t.scores.filter(n=>n!==null).length
 const complete=!!(l.name.trim()&&l.segment.trim()&&l.city.trim()&&reviewed===criteria.length&&(t.observations.trim()||t.reports.trim()||t.evidence.trim())&&t.owner&&t.next.trim()&&t.due&&t.approach.trim())
 function commit(final:boolean){
  if(!l.name.trim()||!l.segment.trim()||!l.city.trim()){setStep(0);return setError('Preencha a identificação do estabelecimento.')}
  if(final&&!complete)return setError('Para concluir, avalie os sete critérios, inclua evidência ou relato e informe abordagem, responsável, próxima ação e prazo.')
  const updated={...t,completed:final,updated:day()}
  const updatedLead={...l,services:t.services,...(final?{owner:t.owner,next:t.next,due:t.due,stage:qualify?'Qualificado' as const:l.stage}:{})}
  if(save(updated,updatedLead))close()
 }
 return <Dialog title="Triagem comercial" subtitle={lead.name} wide onClose={close}><div className="wizard-tabs" aria-label="Etapas da triagem">{steps.map((s,i)=><button key={s} aria-current={i===step?'step':undefined} className={step===i?'current':''} onClick={()=>{setStep(i);setError('')}}><span>{i+1}</span>{s}</button>)}</div><div className="dialog-body"><h3>{steps[step]}</h3>
 {step===0&&<div className="fields">{([['name','Nome comercial'],['segment','Segmento'],['city','Cidade'],['region','Região'],['address','Localização'],['instagram','Instagram'],['website','Site'],['whatsapp','WhatsApp'],['other','Outros canais']] as const).map(([k,label])=><Field key={k} label={label} value={l[k]} on={v=>setLead({...l,[k]:v})}/>)}</div>}
 {step===1&&<div className="fields">{channels.map(c=><Field key={c} label={c} options={['Não verificado','Identificado · qualidade a avaliar','Identificado · aparenta atender','Identificado · investigar limitação','Não encontrado na pesquisa']} value={t.presence[c]||'Não verificado'} on={v=>set({...t,presence:{...t.presence,[c]:v}})}/>)}</div>}
 {step===2&&<><p className="muted">A falta de uma ferramenta é um sinal para investigar. Registre a origem da informação.</p>{field('observations','Fatos observados diretamente')}{field('reports','Relatos do cliente ou de terceiros')}{field('hypotheses','Hipóteses ainda não confirmadas')}{field('evidence','Evidências, links e fontes')}</>}
 {step===3&&<Choices items={solutions} value={t.services} on={services=>set({...t,services})}/>}
 {step===4&&<><p className="muted">{reviewed} de 7 critérios avaliados. Use “Não avaliado” quando faltar evidência.</p><div className="score-fields">{criteria.map(([label,max],i)=><label key={label} className="field"><span>{label} · 0–{max}</span><select value={t.scores[i]??''} onChange={e=>set({...t,scores:t.scores.map((n,j)=>i===j?(e.target.value===''?null:Number(e.target.value)):n)})}><option value="">Não avaliado</option>{Array.from({length:max+1},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>)}</div></>}
 {step===5&&<><div className="callout"><ClipboardList size={19}/><div><b>{complete?'Pronta para concluir':'Triagem incompleta'}</b><p>{reviewed} de 7 critérios avaliados · {t.services.join(', ')||'Nenhuma solução selecionada'}. A prioridade aparece após a conclusão.</p></div></div>{field('approach','Abordagem sugerida')}<div className="fields">{field('owner','Responsável','text')}{field('next','Próxima ação','text')}{field('due','Prazo','date')}</div>{(['Identificado','Em pesquisa'] as Stage[]).includes(l.stage)&&<label className="checkline"><input type="checkbox" checked={qualify} onChange={e=>setQualify(e.target.checked)}/>Mover para Qualificado ao concluir</label>}</>}
 {error&&<p className="error" role="alert">{error}</p>}</div><div className="dialog-foot"><button className="button" onClick={()=>commit(false)}>Salvar rascunho</button>{step>0&&<button className="button" onClick={()=>{setStep(step-1);setError('')}}>Voltar</button>}<button className="button primary" onClick={()=>step<5?(setStep(step+1),setError('')):commit(true)}>{step<5?'Continuar':'Concluir triagem'}</button></div></Dialog>
}
export function ActivityList({data,edit,add,done}:{data:Data;edit:(id:string)=>void;add:()=>void;done:(id:string)=>void}){
 const [filter,set]=useState('Todas')
 const filters=['Todas','Vencidas','Hoje','Próximos 7 dias','Concluídas']
 const [kind,setKind]=useState('')
 const [owner,setOwner]=useState('')
 const [status,setStatus]=useState('')
 const owners=[...new Set([...data.team,...data.activities.map(a=>a.owner)])].filter(Boolean)
 const tasks=data.activities.filter(a=>(!kind||a.kind===kind)&&(!owner||a.owner===owner)&&(!status||a.status===status)).filter(a=>filter==='Todas'||(filter==='Vencidas'&&overdue(a))||(filter==='Hoje'&&pending(a)&&a.due===day())||(filter==='Próximos 7 dias'&&pending(a)&&a.due>day()&&a.due<=day(7))||(filter==='Concluídas'&&a.status==='Concluída')).sort((a,b)=>a.due.localeCompare(b.due))
 return <Page title="Atividades" description="Organize contatos, visitas, follow-ups e entregas." actions={<button className="button primary" onClick={add}>＋ Criar atividade</button>}><div className="tabs">{filters.map(f=><button key={f} aria-pressed={f===filter} onClick={()=>set(f)}>{f}</button>)}</div><div className="toolbar">
 <label className="field"><span>Tipo de atividade</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Todos os tipos</option>{activityTypes.map(value=><option key={value}>{value}</option>)}</select></label>
 <label className="field"><span>Responsável</span><select value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map(value=><option key={value}>{value}</option>)}</select></label>
 <label className="field"><span>Situação</span><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todas as situações</option>{['Pendente','Em andamento','Concluída','Cancelada'].map(value=><option key={value}>{value}</option>)}</select></label>
 </div><div className="card table-wrap">{tasks.length?<table><thead><tr><th>Atividade</th><th>Responsável</th><th>Prazo</th><th>Prioridade</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{tasks.map(a=><tr key={a.id}><td><button className="text-button lead-name" onClick={()=>edit(a.id)}>{a.title}</button><small>{a.kind} · {data.leads.find(l=>l.id===a.leadId)?.name??'Sem vínculo'}{a.projectId?' · '+(data.projects.find(p=>p.id===a.projectId)?.title??''):''}</small></td><td>{a.owner}</td><td>{dateLabel(a.due)}</td><td><Tag tone={a.priority==='Alta'?'amber':'neutral'}>{a.priority}</Tag></td><td><Tag tone={overdue(a)?'rose':a.status==='Concluída'?'green':'neutral'}>{overdue(a)?'Vencida':a.status}</Tag></td><td>{pending(a)&&<button className="button compact" onClick={()=>done(a.id)}>Concluir</button>}</td></tr>)}</tbody></table>:<Empty title="Sem atividades nesta visão"/>}</div></Page>
}
export function ActivityEditor({data,item,leadId,projectId,postSale,draft,close,save}:{data:Data;item?:Activity;leadId?:string;projectId?:string;postSale?:boolean;draft?:Activity;close:()=>void;save:(a:Activity)=>boolean}){
 const linked=data.leads.find(l=>l.id===leadId)
 const [a,set]=useState<Activity>(item??draft??{id:'',leadId:leadId??'',projectId:projectId??'',title:postSale?'Acompanhamento pós-venda':projectId?'':linked?.next??'',description:'',kind:postSale?'Pós-venda':projectId?'Entrega':'Contato',owner:data.projects.find(p=>p.id===projectId)?.owner??linked?.owner??data.team[0]??'',due:postSale?day(7):projectId?day():linked?.due||day(),priority:'Normal',status:'Pendente',result:''})
 const [error,setError]=useState('')
 const f=(k:Exclude<keyof Activity,'reviewSource'|'completedOn'>,label:string,required=false,type='text',options?:string[])=><Field label={label} value={a[k]} required={required} type={type} options={options} on={v=>set({...a,[k]:v})}/>
 return <Dialog title={item?'Editar atividade':'Criar atividade'} onClose={close}><Form onClose={close} error={error} onSave={()=>{if(!a.title.trim()||!a.owner||!a.kind||!a.priority||!a.status||!a.due)return setError('Preencha os campos obrigatórios.');if(save({...a,id:a.id||uid(),title:a.title.trim()}))close()}}>
 {a.reviewSource&&<p className="callout">Origem na Revisão semanal · {a.reviewSource.title}</p>}
 <div className="fields">{f('title','Título',true)}{f('kind','Tipo',true,'text',activityTypes)}{f('owner','Responsável',true,'text',data.team)}{f('due','Prazo',true,'date')}{f('priority','Prioridade',true,'text',['Alta','Normal','Baixa'])}{f('status','Status',true,'text',['Pendente','Em andamento','Concluída','Cancelada'])}<label className="field"><span>Estabelecimento</span><select disabled={!!a.reviewSource} value={a.leadId} onChange={e=>set({...a,leadId:e.target.value,projectId:''})}><option value="">Sem vínculo</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label><label className="field"><span>Projeto</span><select disabled={!!a.reviewSource} value={a.projectId} onChange={e=>{const p=data.projects.find(p=>p.id===e.target.value);set({...a,projectId:e.target.value,leadId:p?.leadId??a.leadId})}}><option value="">Sem vínculo</option>{data.projects.filter(p=>!a.leadId||a.leadId===p.leadId).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>{f('description','Descrição',false,'area')}{f('result','Resultado',false,'area')}</Form></Dialog>
}
export function MeetingList({data,edit,add,propose}:{data:Data;edit:(id:string)=>void;add:()=>void;propose:(id:string,leadId:string)=>void}){
 const [presentation,setPresentation]=useState(false)
 return <Page title="Reuniões e diagnósticos" description="Prepare o roteiro, registre a conversa e combine o acompanhamento." actions={<button className="button primary" onClick={add}>＋ Registrar reunião</button>}>
 <div className="toolbar" role="group" aria-label="Área de reuniões">
  <button type="button" className={'button '+(!presentation?'primary':'')} aria-pressed={!presentation} onClick={()=>setPresentation(false)}>Registros</button>
  <button type="button" className={'button '+(presentation?'primary':'')} aria-pressed={presentation} onClick={()=>setPresentation(true)}>Apresentação e tela</button>
 </div>
 {presentation?<MeetingPresentation meetings={data.meetings} leads={data.leads}/>:<div className="card table-wrap">{data.meetings.length?<table><thead><tr><th>Estabelecimento</th><th>Data</th><th>Participantes</th><th>Situação</th><th>Próxima ação</th><th>Ações</th></tr></thead><tbody>{[...data.meetings].sort((a,b)=>b.date.localeCompare(a.date)).map(m=><tr key={m.id}><td><button className="text-button lead-name" onClick={()=>edit(m.id)}>{data.leads.find(l=>l.id===m.leadId)?.name}</button></td><td>{dateLabel(m.date)}</td><td>{m.participants}</td><td><Tag tone={m.state==='Realizada'?'green':'blue'}>{m.state}</Tag></td><td>{m.next||'—'}</td><td>{m.state!=='Cancelada'&&meetingLink(m.callUrl)&&<a className="button compact" href={meetingLink(m.callUrl)!} target="_blank" rel="noopener noreferrer">Abrir chamada</a>}{m.state==='Realizada'&&<button className="button compact" onClick={()=>propose(m.id,m.leadId)}>Criar proposta</button>}</td></tr>)}</tbody></table>:<Empty title="Sem reuniões registradas"/>}</div>}</Page>
}
export function MeetingEditor({data,item,leadId,save,close}:{data:Data;item?:Meeting;leadId?:string;save:(m:Meeting,follow:boolean,update:boolean)=>boolean;close:()=>void}){
 const [m,set]=useState<Meeting>(item??{id:'',leadId:leadId??'',date:day(),participants:'',state:'Agendada',answers:{},checked:[],summary:'',tools:'',objections:'',budget:'',next:'',owner:data.leads.find(l=>l.id===leadId)?.owner??data.team[0]??'',due:''})
 const [simple,setSimple]=useState(false)
 const [follow,setFollow]=useState(false)
 const [update,setUpdate]=useState(false)
 const [error,setError]=useState('')
 const l=data.leads.find(l=>l.id===m.leadId)
 const f=(k:'date'|'participants'|'summary'|'tools'|'objections'|'budget'|'next'|'owner'|'due',label:string,type='text',required=false)=><Field label={label} type={type} required={required} options={k==='owner'?data.team:undefined} value={m[k]} on={v=>set({...m,[k]:v})}/>
 function commit(){
  if(!l||!m.date||!m.participants.trim()||!m.state)return setError('Informe estabelecimento, data, participantes e situação.')
  if(m.state==='Realizada'&&!m.summary.trim())return setError('Registre um resumo do diagnóstico para finalizar.')
  if(m.state!=='Cancelada'&&follow&&(!m.next.trim()||!m.owner||!m.due))return setError('Para criar o acompanhamento, informe ação, responsável e prazo.')
  const callUrl=meetingLink(m.callUrl)
  if(m.callUrl?.trim()&&!callUrl)return setError('Informe um link de chamada HTTPS válido.')
  if(save({...m,callUrl:callUrl??undefined,id:m.id||uid()},follow&&m.state!=='Cancelada',update&&m.state!=='Cancelada'))close()
 }
 return <Dialog title={item?'Editar reunião':'Registrar reunião'} subtitle={l?.name} wide onClose={close}><Form onClose={close} onSave={commit} error={error} label="Salvar reunião">
 <div className="row-between"><h3>{simple?'Roteiro durante a reunião':'Preparação e roteiro'}</h3><button type="button" className="button compact" onClick={()=>setSimple(!simple)}>{simple?'Voltar à ficha completa':'Modo reunião'}</button></div>
 {!simple&&<><div className="fields"><label className="field"><span>Estabelecimento *</span><select required value={m.leadId} onChange={e=>set({...m,leadId:e.target.value,owner:data.leads.find(l=>l.id===e.target.value)?.owner??m.owner})}><option value="">Selecionar</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>{f('date','Data','date',true)}{f('participants','Participantes','text',true)}<Field label="Link da chamada (HTTPS)" type="url" value={m.callUrl??''} on={v=>set({...m,callUrl:v})}/><Field label="Situação" options={['Agendada','Realizada','Cancelada']} required value={m.state} on={v=>set({...m,state:v as Meeting['state']})}/></div>{l&&<div className="callout"><div><b>Contexto da oportunidade</b><p>{l.stage} · {l.needs||l.notes||'Sem diagnóstico anterior.'}</p><p>{data.triages.find(t=>t.leadId===l.id)?.hypotheses||l.history.at(0)?.text}</p></div></div>}</>}
 <div className="script">{script.map(([title,prompt],i)=><details key={title} open={simple?true:undefined}><summary><b>{i+1}. {title}</b>{m.checked.includes(i)&&<Tag tone="green">Realizada</Tag>}</summary><p>{prompt}</p><label className="checkline"><input type="checkbox" checked={m.checked.includes(i)} onChange={e=>set({...m,checked:e.target.checked?[...m.checked,i]:m.checked.filter(n=>n!==i)})}/>Pergunta realizada</label><Field label="Resposta" type="area" value={m.answers[i]??''} on={v=>set({...m,answers:{...m.answers,[i]:v}})}/></details>)}</div>
 {f('summary','Resumo do diagnóstico','area',m.state==='Realizada')}{!simple&&<div className="fields">{f('tools','Ferramentas atuais','area')}{f('objections','Objeções e restrições','area')}{f('budget','Faixa de investimento declarada')}{f('next','Próxima ação')}{f('owner','Responsável pelo acompanhamento')}{f('due','Prazo do acompanhamento','date')}</div>}
 {!simple&&m.state!=='Cancelada'&&<><label className="checkline"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>Criar atividade de acompanhamento ao salvar</label><label className="checkline"><input type="checkbox" checked={update} onChange={e=>setUpdate(e.target.checked)}/>Atualizar a etapa do CRM ao salvar, se avançar o funil</label></>}
 </Form></Dialog>
}
