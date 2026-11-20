import type {ReactNode} from 'react'
import {Disclosure} from './portal-patterns'
import {useState} from 'react'
import {ArrowUpRight,CalendarDays,FolderKanban,ListTodo,Target,Users,Wallet} from 'lucide-react'
import {dateLabel,grade,money,stages,type Data} from './domain'
import {financeMetrics} from './shared-finance-metrics'
import type {loadFinance} from './pilot-finance'
import type {SharedProject} from './pilot-projects'
import {businessDay,filterWork,isPending,workKinds,type WorkEntry,type WorkFilter} from './shared-operational'
import {Dialog,Empty,Page,Tag} from './ui'

type Detail={label:string;rows:{id:string;title:string;detail:string;lead?:string;project?:string}[]}
export function OperationalDashboard({data,entries,projects,finance,financial,errors=[],attention,month,setMonth,openLead,openProject,openAgenda,openEntry,openFinance,addLead}:{data:Data;entries:WorkEntry[];projects:SharedProject[];finance?:Awaited<ReturnType<typeof loadFinance>>;financial:boolean;errors?:string[];attention?:ReactNode;month:string;setMonth:(m:string)=>void;openLead:(id:string)=>void;openProject:(id:string)=>void;openAgenda:(filter:WorkFilter)=>void;openEntry:(entry:WorkEntry)=>void;openFinance:()=>void;addLead:()=>void}){
 const [detail,setDetail]=useState<Detail>()
 const today=businessDay(),pending=filterWork(entries,{state:'pending'},today),tasks=pending.filter(e=>e.kind==='activity'),late=tasks.filter(e=>e.date&&e.date<today),due=tasks.filter(e=>e.date===today),meetings=pending.filter(e=>e.kind==='meeting'),running=projects.filter(p=>p.status==='Em andamento')
 const billing=financial&&finance?financeMetrics(finance[0].data??[],finance[1].data??[],finance[2].data??[],today,month):undefined
 const listLeads=(label:string,leads= data.leads)=>setDetail({label,rows:leads.map(l=>({id:l.id,title:l.name,detail:l.stage+' · '+(l.owner||'Sem responsável'),lead:l.id}))})
 const listProjects=()=>setDetail({label:'Projetos em andamento',rows:running.map(p=>({id:p.proposal_id,title:p.approved.title,detail:(p.owner||'Sem responsável')+' · '+dateLabel(p.due_on??''),project:p.proposal_id}))})
 const showFinance=(received:boolean)=>{
  if(!billing)return
  const rows=received?billing.scope.receipts.filter(r=>!r.reversed_at):billing.scope.forecasts
  setDetail({label:(received?'Receita recebida':'Receita prevista')+' · '+month,rows:rows.map((r,i)=>({id:r.proposal_id+'-'+i,title:projects.find(p=>p.proposal_id===r.proposal_id)?.approved.title??'Projeto',detail:r.kind+' · '+money(r.amount)+' · '+dateLabel('received_on' in r?r.received_on:r.due_on),project:r.proposal_id}))})
 }
 const cards=[
  {Icon:Users,label:'Estabelecimentos',value:data.leads.length,help:'Abrir o CRM do espaço',action:()=>listLeads('Estabelecimentos')},
  {Icon:ListTodo,label:'Atividades vencidas',value:late.length,help:'Pendências anteriores a hoje',action:()=>openAgenda({period:'overdue',kind:'activity'})},
  {Icon:Target,label:'Atividades de hoje',value:due.length,help:'O que precisa acontecer hoje',action:()=>openAgenda({period:'today',kind:'activity'})},
  {Icon:CalendarDays,label:'Reuniões agendadas',value:meetings.length,help:'Abrir agenda de reuniões',action:()=>openAgenda({kind:'meeting'})},
  {Icon:ListTodo,label:'Atividades pendentes',value:tasks.length,help:'Com e sem prazo definido',action:()=>openAgenda({kind:'activity'})},
  {Icon:FolderKanban,label:'Projetos em andamento',value:running.length,help:'Entregas em execução',action:listProjects},
 ]
 return <Page title="Dashboard" description="Prioridades e compromissos do espaço, atualizados com os registros da equipe." actions={<button className="button primary" onClick={addLead}>＋ Novo lead</button>}>
  <section className="op-hero"><div><span className="op-eyebrow">HOJE · FORTALEZA</span><h2>Seu dia de trabalho</h2><p>{dateLabel(today)} · {pending.length} ações e compromissos em aberto</p></div><button className="button" onClick={()=>openAgenda({period:'today'})}>Organizar meu dia <ArrowUpRight size={17}/></button></section>
<div className="kpis op-kpis dashboard-stats">{cards.map(({Icon,label,value,help,action})=>{const unavailable=errors.includes(label==='Estabelecimentos'?'CRM':label==='Reuniões agendadas'?'Reuniões':label==='Projetos em andamento'?'Projetos':'Agenda');return <button className="metric card" key={label} onClick={action} disabled={unavailable}><div className="metric-top"><span className={'tile '+(label.includes('vencidas')?'rose':'mint')}><Icon size={20}/></span><ArrowUpRight size={16}/></div><h2>{label}</h2><strong>{unavailable?'—':value}</strong><small>{unavailable?'Indisponível · tente Atualizar':help}</small></button>})}</div>
  <div className="dashboard-grid op-main-grid">
   <section className="card panel"><div className="panel-head"><div><span className="op-eyebrow">PRÓXIMOS PASSOS</span><h2>Fila de ações</h2></div><button className="text-button" onClick={()=>openAgenda({})}>Ver agenda</button></div>
    {pending.length?<div className="op-queue">{pending.slice(0,7).map(e=><button key={e.key} onClick={()=>openEntry(e)}><span className={'op-dot '+(e.date&&e.date<today?'late':'')}/><span><small>{workKinds[e.kind]} · {e.owner||'Sem responsável'}</small><b>{e.title}</b><small>{data.leads.find(l=>l.id===e.leadId)?.name}</small></span><Tag tone={e.date&&e.date<today?'rose':'neutral'}>{e.date===today?'Hoje':e.date?dateLabel(e.date):'Sem prazo'}</Tag><ArrowUpRight size={16}/></button>)}</div>:<Empty title="Tudo em dia neste espaço" detail="Novas atividades, reuniões e prazos aparecem aqui."/>}
   </section>
   <aside className="dashboard-attention" aria-label="Prazos de contratos e obrigações">{attention}</aside>
  </div>
  <Disclosure title="Indicadores e funil" description="Visão do espaço, oportunidades e resultados">   <section className="card panel"><div className="panel-head"><div><span className="op-eyebrow">OPORTUNIDADES</span><h2>Funil comercial</h2></div><span className="muted">{data.leads.length} no CRM</span></div>
    {data.leads.length?<div className="op-funnel">{stages.filter(s=>data.leads.some(l=>l.stage===s)).map(stage=>{const count=data.leads.filter(l=>l.stage===stage).length;return <button key={stage} onClick={()=>listLeads(stage,data.leads.filter(l=>l.stage===stage))}><span>{stage}<b>{count}</b></span><i style={{width:Math.max(8,count/Math.max(data.leads.length,1)*100)+'%'}}/></button>})}</div>:<Empty title="Seu funil começa pelo primeiro cadastro"/>}
    <button className="button compact" onClick={()=>listLeads('Prioridade A',data.leads.filter(l=>grade(data.triages.find(t=>t.leadId===l.id))?.label==='A'))}>Ver oportunidades de prioridade A</button>
   </section>
  <section className="card panel op-finance"><div className="panel-head"><div><span className="op-eyebrow">GESTÃO</span><h2>Financeiro do mês selecionado</h2></div><label>Mês de análise <input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}}/></label></div>
   {financial?billing?<><div className="op-money-grid"><button onClick={()=>showFinance(false)}><Wallet size={20}/><span>Receita prevista</span><strong>{money(billing.forecast/100)}</strong><small>Vencimentos no mês · abrir lista</small></button><button onClick={()=>showFinance(true)}><Wallet size={20}/><span>Receita recebida</span><strong>{money(billing.received/100)}</strong><small>Recebimentos no mês, sem estornos</small></button></div><p className="muted"><span>Saldo atrasado no mês</span>: {money(billing.overdue/100)}. Previsão e recebimento são medidas separadas. O Financeiro e o CSV usam o mesmo mês.</p><button className="button" onClick={openFinance}>Abrir financeiro neste mês</button></>:<p role="status">Financeiro indisponível. Os demais módulos continuam disponíveis; use Atualizar para tentar novamente.</p>:<p className="muted">Valores financeiros são restritos aos papéis autorizados. As ações operacionais continuam disponíveis.</p>}
  </section>
  </Disclosure>
  {detail&&<Dialog title={detail.label} subtitle={detail.rows.length+' registros no recorte'} onClose={()=>setDetail(undefined)}><div className="dialog-body">{detail.rows.length?<ul className="report-records">{detail.rows.map(r=><li key={r.id}><button className="text-button" onClick={()=>{setDetail(undefined);if(r.project)openProject(r.project);else if(r.lead)openLead(r.lead)}}>{r.title}</button><small>{r.detail}</small></li>)}</ul>:<Empty title="Nenhum registro neste recorte"/>}</div></Dialog>}
 </Page>
}
