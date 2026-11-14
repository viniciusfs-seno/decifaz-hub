import {useState} from 'react'
import {ArrowRight,BookOpen,Download,Search} from 'lucide-react'
import manual from './manual.json'
import {dateLabel,day,money,norm,solutions,uid,type Data,type Finance} from './domain'
import {Dialog,Empty,Field,Form,Page,Tag} from './ui'

const suggested=[
 ['Script de primeiro contato','Scripts','Abra com uma observação e peça permissão para conversar. “Oi, sou da Decifaz. Estou conhecendo como os negócios da região atendem seus clientes. Posso perguntar como vocês atualizam o cardápio ou recebem os pedidos hoje?”'],
 ['Checklist de levantamento de requisitos','Modelos','Registre contexto, resultado esperado, responsáveis, fluxos atuais, usuários, integrações, conteúdo necessário, limites, dependências e critérios de aceite. Separe fatos, relatos e hipóteses.'],
 ['Atendimento e suporte','Procedimentos','Combine o canal e horário de atendimento. Registre a solicitação, impacto, responsável e evidência de resolução. Consulte o escopo acordado para pedidos de mudança.'],
 ['Rotinas financeiras e administrativas','Procedimentos','Revise semanalmente contas vencidas, entradas recebidas, saídas pagas e valores previstos. Registre vencimento e data efetiva de pagamento em campos separados. Valide preços, prazos e alçadas entre os sócios.'],
 ['Modelo de registro de reunião','Modelos','Registre participantes, contexto, problema relatado, impacto, ferramentas atuais, objeções, decisor, solução cogitada e próximo passo com data e responsável.'],
 ['Checklist de entrega e homologação','Modelos','Confira escopo e critérios de aceite, teste os fluxos críticos, registre evidências e pendências, peça o aceite e alinhe treinamento e suporte.'],
 ['Script de reunião comercial','Scripts','Abra com interesse genuíno. Entenda operação, dificuldade e impacto. Pergunte sobre ferramentas, prioridades e decisão. Demonstre a parte pertinente do MVP, trate dúvidas e combine o próximo passo. Consulte o roteiro interativo em Reuniões.'],
 ['Procedimento de elaboração de proposta','Procedimentos','Descreva contexto, objetivo, módulos, exclusões, pré-requisitos, critérios de aceite, cronograma e condições. Separe implantação, recorrência e custos de terceiros. Valide a política de preço com a equipe.'],
 ['Passagem do comercial para desenvolvimento','Procedimentos','Reúna proposta aceita, aceite documentado, escopo versionado, responsável técnico, material inicial, condição de pagamento e regras de acesso antes de iniciar desenvolvimento.'],
]
type Block={kind:string;text?:string;rows?:string[][]}
const articles=[...manual.map((m,i)=>({id:'m'+i,title:m.title,category:'Manual',status:'Proposta interna · fonte',date:'13/11/2026',blocks:m.blocks as Block[]})),...suggested.map(([title,category,body],i)=>({id:'s'+i,title,category,status:'Sugestão · a validar',date:'—',blocks:[{kind:'paragraph',text:body}] as Block[]}))]
export function Knowledge({category='',go}:{category?:string;go:(page:string)=>void}){
 const [query,set]=useState('')
 const [filter,setFilter]=useState(category)
 const [current,open]=useState('')
 const list=articles.filter(a=>(!filter||a.category===filter)&&norm(a.title+' '+JSON.stringify(a.blocks)).includes(norm(query.trim())))
 const item=list.find(a=>a.id===current)
 return <Page title="Base de conhecimento" description="Consulte o manual interno, roteiros comerciais e materiais de apoio." actions={<a className="button" download href="./referencias/decifaz_manual.docx"><Download size={16}/> Manual original</a>}><div className="toolbar"><label className="search"><Search size={17}/><input aria-label="Buscar na base" placeholder="Pesquisar manuais e scripts..." value={query} onChange={e=>set(e.target.value)}/></label><select aria-label="Categoria" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todas as categorias</option>{['Manual','Scripts','Procedimentos','Modelos'].map(x=><option key={x}>{x}</option>)}</select></div>
 <div className="knowledge-grid"><div className="card panel knowledge-index"><h2>Índice</h2>{list.map(a=><button className={item?.id===a.id?'selected':''} key={a.id} onClick={()=>open(a.id)}><BookOpen size={16}/><span>{a.title}</span><ArrowRight size={14}/></button>)}{!list.length&&<Empty/>}</div>
 <div className="card panel article">{item?<><div className="actions"><Tag tone="green">{item.category}</Tag><Tag>{item.status}</Tag></div><h2>{item.title}</h2><p className="muted">Versão inicial · Última atualização da fonte: {item.date} · Revisor a definir</p>{item.blocks.map((b,i)=>b.kind==='table'?<div className="table-wrap" key={i}><table><tbody>{b.rows?.map((r,j)=><tr key={j}>{r.map((c,k)=>j===0?<th key={k}>{c}</th>:<td key={k}>{c}</td>)}</tr>)}</tbody></table></div>:b.kind==='heading'?<h3 key={i}>{b.text}</h3>:b.kind==='bullet'?<p className="article-bullet" key={i}>{b.text}</p>:<p key={i}>{b.text}</p>)}</>:<Empty title="Selecione um material" detail="Use o índice ou pesquise por palavras do conteúdo."/>}{filter==='Scripts'&&<button className="button" onClick={()=>go('reunioes')}>Abrir reuniões <ArrowRight size={16}/></button>}</div></div></Page>
}
export type SecondaryKind='propostas'|'projetos'|'financeiro'
const config={
 propostas:{title:'Propostas comerciais',description:'Registre escopo, valores e a situação da negociação vinculada ao estabelecimento.',action:'Nova proposta'},
 projetos:{title:'Projetos e entregas',description:'Acompanhe a execução a partir de uma proposta aceita e de um ganho confirmado.',action:'Novo projeto'},
 financeiro:{title:'Financeiro',description:'Acompanhe lançamentos manuais de demonstração, com previsto e realizado separados.',action:'Novo lançamento'}
}
export function SecondaryList({kind,data,add,edit}:{kind:SecondaryKind;data:Data;add:()=>void;edit:(id:string)=>void}){
 const c=config[kind]
 const [financeFilter,setFinanceFilter]=useState('Todos')
 const entries=kind==='propostas'?data.proposals:kind==='projetos'?data.projects:data.finance.filter(f=>financeFilter==='Todos'||(financeFilter==='Vencidos'?f.state==='Previsto'&&f.due<day():f.state===financeFilter)).sort((a,b)=>a.due.localeCompare(b.due))
 const months=[...new Set(data.finance.map(f=>(f.state==='Realizado'?f.paid:f.due).slice(0,7)))].sort().slice(-6)
 const totals=(f:(x:Finance)=>boolean)=>data.finance.filter(f).reduce((sum,x)=>sum+x.amount,0)
 const columns=[['Receitas previstas','Receita','Previsto'],['Receitas realizadas','Receita','Realizado'],['Despesas previstas','Despesa','Previsto'],['Despesas realizadas','Despesa','Realizado']] as const
 const monthly=months.map(month=>({month,values:columns.map(([label,k,s])=>({label,value:totals(x=>x.kind===k&&x.state===s&&(s==='Realizado'?x.paid:x.due).startsWith(month))}))}))
 const max=Math.max(1,...monthly.flatMap(m=>m.values.map(v=>v.value)))
 return <Page title={c.title} description={c.description} actions={<button className="button primary" onClick={add}>＋ {c.action}</button>}>
 <div className="callout"><div><b>Registro inicial</b><p>{kind==='propostas'?'Cadastros e versões manuais. Emissão de proposta, contratos e assinatura ficam para uma fase futura.':kind==='projetos'?'Abra projetos a partir de propostas aceitas e acompanhe a passagem para desenvolvimento.':'Lançamentos manuais de demonstração. Recorrência é uma marcação para consulta.'}</p></div></div>
 {kind==='financeiro'&&<><div className="kpis">{columns.map(([label,k,s])=><div className="metric card" key={label}><span>{label}</span><strong>{money(totals(x=>x.kind===k&&x.state===s))}</strong></div>)}</div>{monthly.length>0&&<section className="card panel finance-chart"><h2>Movimentação por mês</h2>{monthly.map(({month,values})=><div className="month-chart" key={month}><h3>{month.split('-').reverse().join('/')}</h3>{values.map(({label,value},i)=><div className="funnel-row" key={label}><span>{label}</span><div className="track"><i style={{width:value/max*100+'%',background:['#8f9ab3','#3a4a6f','#e0b782','#b16a50'][i]}}/></div><strong>{money(value)}</strong></div>)}</div>)}</section>}</>}
 {kind==='financeiro'&&<div className="tabs">{['Todos','Previsto','Vencidos','Realizado'].map(status=><button key={status} aria-pressed={financeFilter===status} onClick={()=>setFinanceFilter(status)}>{status}</button>)}</div>}
 <div className="card table-wrap">{entries.length?<table><thead><tr><th>Registro</th><th>Estabelecimento</th><th>Situação</th><th>{kind==='projetos'?'Prazo':'Valor'}</th><th>{kind==='propostas'?'Validade':'Detalhe'}</th></tr></thead><tbody>{entries.map(v=><tr key={v.id}><td><button className="text-button lead-name" onClick={()=>edit(v.id)}>{v.title}</button></td><td>{data.leads.find(l=>l.id===v.leadId)?.name??'—'}</td><td><Tag tone={'state'in v&&v.state==='Previsto'&&v.due<day()?'rose':'neutral'}>{'state'in v?v.state==='Previsto'&&v.due<day()?'Vencido':v.state:v.status}</Tag></td><td>{'setup'in v?money(v.setup):'amount'in v?money(v.amount):dateLabel(v.due)}</td><td>{'validity'in v?dateLabel(v.validity)+' · v'+v.version:'amount'in v?v.kind+(v.recurring?' · Recorrente':'')+' · '+dateLabel(v.state==='Realizado'?v.paid:v.due):<>{v.stage}<small>{v.handoff?.completedAt?'Passagem concluída':v.handoff?'Passagem pendente':'Passagem sem registro'}</small></>}</td></tr>)}</tbody></table>:<Empty detail="Os registros cadastrados aparecem aqui."/>}</div></Page>
}
export function SecondaryEditor({data,item,leadId='',close,save}:{kind:'financeiro';data:Data;item?:Finance;leadId?:string;close:()=>void;save:(v:Finance)=>string|undefined}){
 const [entry,set]=useState<Finance>(item??{id:'',leadId,projectId:'',title:'',kind:'Receita',amount:0,due:day(),paid:'',state:'Previsto',recurring:false})
 const [amount,setAmount]=useState(item?String(item.amount):'')
 const [error,setError]=useState('')
 const locked=!!entry.origin
 return <Dialog title={item?'Editar lançamento':'Novo lançamento'} onClose={close}><Form onSave={()=>{
  const issue=save({...entry,id:entry.id||uid(),amount:Number(amount)})
  if(issue)setError(issue)
  else close()
 }} onClose={close} error={error}>
 {locked&&<div className="callout"><div><b>{entry.origin?.kind} · {money(entry.amount)}</b><p>{data.projects.find(p=>p.id===entry.projectId)?.title}{entry.origin?.period?' · '+entry.origin.period.split('-').reverse().join('/'):''}</p></div></div>}
 <Field label="Descrição" required value={entry.title} on={title=>set({...entry,title})}/>
 <div className="fields">
 {!locked&&<><Field label="Tipo" required options={['Receita','Despesa']} value={entry.kind} on={kind=>set({...entry,kind:kind as Finance['kind']})}/><Field label="Valor (R$)" required type="number" min={0.01} step="0.01" value={amount} on={setAmount}/></>}
 <Field label="Vencimento" required type="date" value={entry.due} on={due=>set({...entry,due})}/>
 <Field label="Situação" required options={['Previsto','Realizado']} value={entry.state} on={state=>set({...entry,state:state as Finance['state']})}/>
 {entry.state==='Realizado'&&<Field label="Data da baixa" required type="date" value={entry.paid} on={paid=>set({...entry,paid})}/>}
 {!locked&&<><label className="field"><span>Estabelecimento</span><select value={entry.leadId} onChange={e=>set({...entry,leadId:e.target.value,projectId:''})}><option value="">Sem vínculo</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
 <label className="field"><span>Projeto</span><select value={entry.projectId} onChange={e=>set({...entry,projectId:e.target.value,leadId:data.projects.find(p=>p.id===e.target.value)?.leadId??entry.leadId})}><option value="">Sem vínculo</option>{data.projects.filter(p=>!entry.leadId||p.leadId===entry.leadId).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
 <label className="checkline"><input type="checkbox" checked={entry.recurring} onChange={e=>set({...entry,recurring:e.target.checked})}/>Despesa ou receita recorrente</label></>}
 </div></Form></Dialog>
}

export function Catalog({leadCount}:{leadCount:(solution:string)=>number}){
 const descriptions=['Apresentação institucional, localização e canais de contato.','Consulta de itens, preços e disponibilidade.','Fluxo de pedidos e acompanhamento da operação.','Acesso rápido a cardápios e páginas por mesa ou ponto físico.','Redução de tarefas repetitivas entre ferramentas.','Exibição de ofertas e avisos no estabelecimento.','Organização de horários, solicitações e confirmações.','Fluxos específicos com escopo e integrações sob avaliação.']
 return <Page title="Catálogo de soluções" description="Soluções para investigar durante a triagem. Disponibilidade e preços dependem de validação interna."><div className="catalog">{solutions.map((s,i)=><article className="card panel" key={s}><BookOpen size={20}/><h2>{s}</h2><p>{descriptions[i]}</p><Tag>{leadCount(s)} vínculos no CRM</Tag></article>)}</div></Page>
}
