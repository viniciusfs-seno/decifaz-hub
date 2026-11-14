import {useState} from 'react'
import {ArrowUpRight,FileCheck2,FolderKanban,Users,Wallet} from 'lucide-react'
import {dateLabel,day,money,pending,type Data} from './domain'
import {weeklyReview,type ReviewItem} from './review-data'
import {weekDates} from './agenda-data'
import {previousReviewActions} from './review-closure'
import {ReviewClosurePanel} from './review-closure-panel'
import {summarizeReview} from './review-summary'
import {pendingReviewAction} from './review-actions'
import {Empty,Page,Tag} from './ui'

export function WeeklyReview({data,open,createAction,openActivity,saveClosure}:{data:Data;open:(item:Pick<ReviewItem,'id'|'target'>)=>void;createAction:(item:ReviewItem)=>void;openActivity:(id:string)=>void;saveClosure:(data:Data)=>boolean}){
 const [owner,setOwner]=useState('')
 const [leadId,setLeadId]=useState('')
 const [actionStatus,setActionStatus]=useState('Todas')
 const {leads,proposals,projects,receivables}=weeklyReview(data)
 const groups=[
  ['Leads a revisar',Users,leads,'Confira a próxima ação e o prazo.'],
  ['Propostas perto do vencimento',FileCheck2,proposals,'Propostas abertas vencidas ou com validade até os próximos sete dias.'],
  ['Projetos com pendências',FolderKanban,projects,'Confira a passagem para desenvolvimento, a homologação e os prazos.'],
  ['Recebimentos em atraso',Wallet,receivables,'Receitas previstas com vencimento passado.'],
 ] as const
 const actions=data.activities.filter(a=>a.reviewSource)
 const owners=[...new Set([...data.team,...actions.map(a=>a.owner),...groups.flatMap(([, ,items])=>items.map(item=>item.owner)).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'))
 const matches=(item:Pick<ReviewItem,'owner'|'leadId'>)=>(!owner||item.owner===owner)&&(!leadId||item.leadId===leadId)
 const visibleActions=actions.filter(a=>matches(a)&&(actionStatus==='Todas'||(actionStatus==='Abertas'?pending(a):a.status===actionStatus)))
 const previous=previousReviewActions(data)
 const carried=previous.actions.filter(matches)
 const today=day()
 const summary=summarizeReview(actions.filter(matches))
 const leadNames=new Map(data.leads.map(l=>[l.id,l.name]))
 return <Page title="Revisão semanal" description="Encontre pendências comerciais, de entrega e de recebimento e abra o registro para agir.">
  <div className="toolbar">
   <select aria-label="Responsável" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map(name=><option key={name}>{name}</option>)}</select>
   <select aria-label="Estabelecimento" value={leadId} onChange={e=>setLeadId(e.target.value)}><option value="">Todos os estabelecimentos</option>{data.leads.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
   {(owner||leadId)&&<button className="button" onClick={()=>{setOwner('');setLeadId('')}}>Limpar filtros</button>}
  </div>
  <section className="card panel review-carryover" aria-labelledby="review-carryover-title">
   <div className="panel-head"><div><h2 id="review-carryover-title">Retomada do último fechamento</h2>
   {previous.closure&&<p>Revisão de {dateLabel(previous.closure.week)} a {dateLabel(weekDates(previous.closure.week,0)[6])}</p>}</div>
   {previous.closure&&<Tag>{carried.length} em aberto</Tag>}</div>
   {!previous.closure?<Empty title="Nenhum fechamento anterior registrado"/>:!carried.length?<Empty title="Nenhuma ação em aberto nesta visão"/>:
    carried.map(a=><button className="agenda-entry" key={a.id} onClick={()=>openActivity(a.id)}>
     <span className="agenda-entry-text"><b>{a.title}</b><small>{[a.owner,a.due&&dateLabel(a.due),leadNames.get(a.leadId)].filter(Boolean).join(' · ')}</small></span>
     <Tag tone={a.due&&a.due<today?'rose':'neutral'}>{a.due&&a.due<today?'Vencida':a.status}</Tag><ArrowUpRight size={16}/>
    </button>)}
  </section>
  <section aria-labelledby="review-summary-title">
   <div className="panel-head"><div><h2 id="review-summary-title">Resumo da semana</h2><p>{dateLabel(summary.week[0])} a {dateLabel(summary.week[6])}</p></div></div>
   <div className="dashboard-grid review-summary-grid">{([
    ['Concluídas na semana',summary.completed,'Nenhuma conclusão registrada nesta semana.'],
    ['Em atraso',summary.overdue,'Nenhuma ação aberta com prazo vencido.'],
    ['Próxima semana',summary.upcoming,dateLabel(summary.next[0])+' a '+dateLabel(summary.next[6])],
   ] as const).map(([title,items,detail])=><section className="card panel" key={title}>
    <div className="panel-head"><div><h3>{title}</h3><p>{title==='Próxima semana'?detail:!items.length?detail:null}</p></div><Tag>{items.length}</Tag></div>
    {items.map(a=><button className="agenda-entry" key={a.id} onClick={()=>openActivity(a.id)}>
     <span className="agenda-entry-text"><b>{a.title}</b><small>{a.owner} · {dateLabel(title==='Concluídas na semana'?a.completedOn??'':a.due)}</small></span><ArrowUpRight size={16}/>
    </button>)}
    {title==='Próxima semana'&&!items.length&&<p className="muted">Nenhuma ação prevista.</p>}
   </section>)}</div>
   {summary.undated>0&&<p className="callout">{summary.undated} {summary.undated===1?'ação concluída sem data registrada':'ações concluídas sem data registrada'}. Consulte em Ações da revisão.</p>}
  </section>
  <div className="dashboard-grid review-grid">{groups.map(([title,Icon,items,description])=>{
   const visible=items.filter(matches).sort((a,b)=>(a.due||'').localeCompare(b.due||'')||a.title.localeCompare(b.title,'pt-BR'))
   return <section key={title} className="card panel">
    <div className="panel-head"><div><h2>{title}</h2><p>{description}</p></div><Tag tone={visible.length?'amber':'green'}>{visible.length}</Tag></div>
    {visible.length?visible.map(item=><div className="review-row" key={item.id}><button className="agenda-entry" onClick={()=>open(item)}>
     <span className="tile mint"><Icon size={17}/></span>
     <span className="agenda-entry-text"><b>{item.title}</b><small>{item.detail}</small><small>{[item.target!=='lead'&&leadNames.get(item.leadId),item.owner||'Sem responsável',item.due&&dateLabel(item.due)].filter(Boolean).join(' · ')}</small></span>
     {item.amount!==undefined&&<strong>{money(item.amount)}</strong>}<ArrowUpRight className="muted" size={16}/>
    </button><button className="button compact review-action" onClick={()=>createAction(item)}>{pendingReviewAction(actions,{target:item.target,id:item.id,title:item.title})?'Abrir atividade':'Criar atividade'}</button></div>):<Empty title="Nenhuma pendência nesta visão"/>}
   </section>
  })}</div>
 <section className="card panel"><div className="panel-head"><div><h2>Ações da revisão</h2><p>Acompanhe o que foi combinado, mesmo após resolver a pendência de origem.</p></div><select aria-label="Situação das ações da revisão" value={actionStatus} onChange={e=>setActionStatus(e.target.value)}>{['Todas','Abertas','Concluída','Cancelada'].map(status=><option key={status}>{status}</option>)}</select></div>
 {visibleActions.length?visibleActions.sort((a,b)=>Number(pending(b))-Number(pending(a))||a.due.localeCompare(b.due)).map(a=><div className="review-row" key={a.id}><button className="agenda-entry" onClick={()=>openActivity(a.id)}>
 <span className="agenda-entry-text"><b>{a.title}</b><small>{a.owner} · {dateLabel(a.due)} · {a.reviewSource?.title}</small></span>
 <Tag tone={pending(a)&&a.due<day()?'rose':'neutral'}>{pending(a)&&a.due<day()?'Vencida':a.status}</Tag><ArrowUpRight size={16}/>
 </button>{a.reviewSource&&<button className="button compact review-action" onClick={()=>{if(a.reviewSource)open(a.reviewSource)}}>Abrir registro de origem</button>}</div>):<Empty title="Nenhuma atividade de revisão nesta visão"/>}
 </section>
 <ReviewClosurePanel data={data} save={saveClosure} openActivity={openActivity}/>
 </Page>
}
