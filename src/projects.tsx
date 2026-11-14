import {useState} from 'react'
import {dateLabel,money,uid,type Data,type Project} from './domain'
import {availableProposals,handoffItems} from './handoff'
import {deliveryChecks} from './delivery'
import {Dialog,Field,Form,Tag} from './ui'

export function ProjectEditor({data,item,proposalId='',close,save,openProposal,addActivity,openSupport,openActivity,addForecast,openFinance}:{data:Data;item?:Project;proposalId?:string;close:()=>void;save:(p:Project)=>string|undefined;openProposal:(id:string)=>void;addActivity:(p:Project,postSale?:boolean)=>void;openSupport:(p:Project)=>void;openActivity:(id:string)=>void;addForecast:(p:Project)=>void;openFinance:(id:string)=>void}){
 const available=availableProposals(data)
 const source=available.find(p=>p.id===proposalId)
 const [p,set]=useState<Project>(item??{id:'',leadId:source?.leadId??'',proposalId:source?.id??'',title:source?.title??'',owner:'',stage:'Descoberta',due:'',tasks:'',deliverables:'',status:'Planejado'})
 const [error,setError]=useState('')
 const proposal=data.proposals.find(v=>v.id===p.proposalId)
 const approved=p.approved??(proposal&&{...proposal,acceptance:proposal.decisionNote,acceptedAt:proposal.decisionAt})
 const lead=data.leads.find(l=>l.id===p.leadId)
 const handoff=p.handoff??{checks:[],reference:'',notes:''}
 const delivery=p.delivery??{checks:[],acceptedAt:'',reference:'',notes:''}
 const activities=data.activities.filter(a=>a.projectId===item?.id&&!!item)
 const field=(key:'title'|'owner'|'due'|'stage'|'status'|'tasks'|'deliverables',label:string,required=false,type='text',options?:string[])=><Field label={label} value={p[key]} required={required} type={type} options={options} on={v=>set({...p,[key]:v})}/>
 function choose(id:string){
  const next=available.find(x=>x.id===id)
  set({...p,proposalId:id,leadId:next?.leadId??'',title:next?.title??'',handoff:undefined})
 }
 return <Dialog title={item?item.title:'Abrir projeto'} subtitle={lead?.name} wide onClose={close}>
 {(!item&&!available.length)?<div className="dialog-body"><p>As propostas aceitas de oportunidades ganhas aparecem aqui quando estiverem disponíveis para abrir um projeto.</p><button className="button" onClick={close}>Fechar</button></div>:<Form onClose={close} error={error} label={item?'Salvar projeto':'Abrir projeto'} onSave={()=>{const message=save({...p,id:p.id||uid(),handoff});if(message)setError(message);else close()}}>
 {!item&&<label className="field"><span>Proposta aceita *</span><select required value={p.proposalId} onChange={e=>choose(e.target.value)}><option value="">Selecionar</option>{available.map(v=><option key={v.id} value={v.id}>{v.title} · v{v.version} · {data.leads.find(l=>l.id===v.leadId)?.name}</option>)}</select></label>}
 {approved&&<section className="callout"><div><h3>Escopo aprovado · v{approved.version}</h3><p>{approved.title} · {lead?.name}</p><p className="details-line">{approved.scope}</p>{approved.services.length>0&&<p>{approved.services.join(' · ')}</p>}{approved.terms&&<p className="details-line">{approved.terms}</p>}<p>Implantação {money(approved.setup)} · Mensalidade {money(approved.monthly)}</p>{approved.acceptance&&<p>Aceite em {dateLabel(approved.acceptedAt??'')} · {approved.acceptance}</p>}</div></section>}
 {item&&<div className="actions">{proposal&&<button className="button compact" type="button" onClick={()=>openProposal(proposal.id)}>Abrir proposta de origem</button>}<button className="button compact" type="button" onClick={()=>addActivity(item)}>Criar atividade vinculada</button></div>}
 <div className="fields">{field('title','Título',true)}{field('owner','Responsável técnico',true,'text',data.team)}{field('due','Prazo',true,'date')}{field('stage','Etapa',true,'text',['Descoberta','Protótipo','Implementação','Testes','Homologação','Entrega','Suporte'])}{field('status','Situação',true,'text',['Planejado','Em andamento','Entregue','Pausado'])}</div>
 <section className="proposal-decision"><div className="row-between"><h3>Passagem para desenvolvimento</h3><Tag tone={handoff.completedAt?'green':'amber'}>{handoff.completedAt?'Concluída em '+dateLabel(handoff.completedAt):handoff.checks.length+' de '+handoffItems.length+' verificados'}</Tag></div><p className="muted">O projeto pode ficar planejado enquanto houver pendências. Para avançar a execução, confirme todos os itens e indique onde o aceite está registrado.</p>
 {handoffItems.map(([key,label])=><label className="checkline" key={key}><input type="checkbox" checked={handoff.checks.includes(key)} onChange={e=>set({...p,handoff:{...handoff,checks:e.target.checked?[...handoff.checks,key]:handoff.checks.filter(x=>x!==key),completedAt:undefined}})}/>{label}</label>)}
 <Field label="Referência do aceite ou contrato" value={handoff.reference} on={reference=>set({...p,handoff:{...handoff,reference}})} placeholder="Ex.: e-mail de aceite de 13/11, registro interno nº 04"/>
 <Field label="Pendências e próximos passos" type="area" value={handoff.notes} on={notes=>set({...p,handoff:{...handoff,notes}})}/>
 </section><div className="fields">{field('tasks','Tarefas e marcos',false,'area')}{field('deliverables','Entregáveis',false,'area')}</div>
 <section className="proposal-decision">
 <h3>Homologação e aceite da entrega</h3><p className="muted">Registre a evidência do aceite final antes de avançar para Entrega ou Suporte. Use as notas para acompanhar pendências, publicação e treinamento.</p>
 {deliveryChecks.map(([key,label])=><label className="checkline" key={key}><input type="checkbox" checked={delivery.checks.includes(key)} onChange={e=>set({...p,delivery:{...delivery,checks:e.target.checked?[...delivery.checks,key]:delivery.checks.filter(x=>x!==key)}})}/>{label}</label>)}
 <div className="fields"><Field label="Data do aceite da entrega" type="date" value={delivery.acceptedAt} on={acceptedAt=>set({...p,delivery:{...delivery,acceptedAt}})}/><Field label="Evidência do aceite da entrega" value={delivery.reference} on={reference=>set({...p,delivery:{...delivery,reference}})} placeholder="Ex.: confirmação por e-mail ou termo de aceite"/></div>
 <Field label="Pendências e notas da entrega" type="area" value={delivery.notes} on={notes=>set({...p,delivery:{...delivery,notes}})}/>
 </section>
 {item&&<section className="proposal-decision"><h3>Atividades vinculadas</h3>{activities.length===0&&<p className="muted">Sem atividades vinculadas.</p>}{activities.map(a=><button type="button" className="text-button" key={a.id} onClick={()=>openActivity(a.id)}>{a.title} · {a.kind} · {dateLabel(a.due)} · {a.status}</button>)}{item.status==='Entregue'&&<button type="button" className="button compact primary" onClick={()=>openSupport(item)}>Abrir chamado de suporte</button>}{item.status==='Entregue'&&<button type="button" className="button compact" onClick={()=>addActivity(item,true)}>Agendar pós-venda</button>}</section>}
 {item&&<section className="proposal-decision"><h3>Financeiro do projeto</h3>{data.finance.filter(f=>f.projectId===item.id).map(f=><button type="button" className="text-button" key={f.id} onClick={()=>openFinance(f.id)}>{f.title} · {money(f.amount)} · {f.state}</button>)}{!data.finance.some(f=>f.projectId===item.id)&&<p className="muted">Sem lançamentos vinculados.</p>}{proposal?.status==='Aceita'&&(proposal.setup>0||proposal.monthly>0)&&<button type="button" className="button compact" onClick={()=>addForecast(item)}>Prever recebimento</button>}</section>}
 </Form>}
 </Dialog>
}
