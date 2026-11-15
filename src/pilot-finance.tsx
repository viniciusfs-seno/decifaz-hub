import {useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,day,money,uid} from './domain'
import type {SharedProject} from './pilot-projects'
import {chargeKey as key,cents,financeMetrics,type Forecast,type Receipt,type Expense} from './shared-finance-metrics'
import {Empty,Field,Page} from './ui'

type Write=(op:()=>PromiseLike<{error:unknown;data:unknown}>,success?:()=>void)=>Promise<boolean>
const kinds=['Implantação','Mensalidade']
type Audit={id:string;occurred_at:string;actor_id:string|null;entity:string;operation:string;before_record:Record<string,unknown>|null;after_record:Record<string,unknown>}
export function financeCsv(rows:string[][]){
 return rows.map(row=>row.map(value=>'"'+(/^[\s]*[=+@-]|^[\t\r\n]/.test(value)?"'":'')+value.replaceAll('"','""')+'"').join(';')).join('\r\n')
}

export function loadFinance(client:SupabaseClient,workspace:string){
 return Promise.all([
  client.from('hub_receivables').select('proposal_id,kind,period,amount,due_on').eq('workspace_id',workspace)
   .order('due_on').order('proposal_id').order('kind').returns<Forecast[]>(),
  client.from('hub_receipts').select('proposal_id,kind,period,amount,id,received_on,reversed_at,reversal_reason').eq('workspace_id',workspace)
   .order('received_on',{ascending:false}).order('id').returns<Receipt[]>(),
  client.from('hub_expenses').select('id,title,due_on,amount,paid_on,paid_amount').eq('workspace_id',workspace).order('due_on').order('id').returns<Expense[]>(),
  client.from('hub_finance_audit').select('id,occurred_at,actor_id,entity,operation,before_record,after_record')
   .eq('workspace_id',workspace).order('occurred_at',{ascending:false}).order('id').limit(30).returns<Audit[]>(),
 ])
}

export function SharedFinance({client,workspace,projects,forecasts,receipts,expenses,audit,busy,write,month,setMonth}:{
 client:SupabaseClient;workspace:string;projects:SharedProject[];forecasts:Forecast[];receipts:Receipt[];expenses:Expense[];audit:Audit[];month:string;setMonth:(month:string)=>void;busy:boolean;write:Write
}){
 const [project,setProject]=useState('')
 const [kind,setKind]=useState(kinds[0])
 const [due,setDue]=useState(day())
 const [charge,setCharge]=useState('')
 const [received,setReceived]=useState(day())
 const [amount,setAmount]=useState('')
 const [receiptId,setReceiptId]=useState(uid)
 const [overdueOnly,setOverdueOnly]=useState(false)
 const [reverseId,setReverseId]=useState('')
 const [reason,setReason]=useState('')
 const summary=financeMetrics(forecasts,receipts,expenses,day(),month)
 const {outstanding}=summary
 const shownForecasts=summary.scope.forecasts.filter(item=>!overdueOnly||(item.due_on<day()&&outstanding(item)>0))
 const shownReceipts=summary.scope.receipts
 const current=forecasts.find(item=>key(item)===charge)
 const selected=projects.find(item=>item.proposal_id===project)
 const value=kind==='Implantação'?selected?.approved.setup:selected?.approved.monthly
 const label=(id:string)=>projects.find(item=>item.proposal_id===id)?.approved.title??'Projeto vinculado'

 function exportReport(){
  const rows=[['Registro','Descrição','Data','Valor','Situação']]
  const format=(amount:number)=>amount.toFixed(2).replace('.',',')
  for(const item of summary.scope.forecasts)rows.push(['Receita prevista',label(item.proposal_id)+' · '+item.kind,dateLabel(item.due_on),format(item.amount),''])
  for(const item of shownReceipts)rows.push(['Recebimento',label(item.proposal_id)+' · '+item.kind,dateLabel(item.received_on),format(item.amount),item.reversed_at?'Estornado':'Realizado'])
  for(const item of summary.scope.expenses)rows.push(['Despesa prevista',item.title,dateLabel(item.due_on),format(item.amount),''])
  for(const item of summary.scope.payments)rows.push(['Despesa paga',item.title,dateLabel(item.paid_on!),format(item.paid_amount!), 'Realizado'])
  const url=URL.createObjectURL(new Blob(['\uFEFF',financeCsv(rows)],{type:'text/csv;charset=utf-8'}))
  const link=document.createElement('a')
  link.href=url
  link.download='decifaz-financeiro-'+(month||'todos')+'.csv'
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <Page title="Financeiro" description="Acompanhe previsões e registre os valores que a Decifaz já recebeu." actions={<button className="button" onClick={exportReport}>Exportar relatório CSV</button>}>
  <div className="toolbar"><Field label="Mês de referência" type="month" value={month} on={setMonth}/><button className="button" onClick={()=>setMonth('')}>Todos os meses</button><label><input type="checkbox" checked={overdueOnly} onChange={e=>setOverdueOnly(e.target.checked)}/> Só previsões atrasadas</label></div>
  <div className="kpis">
   {[['Receita prevista',summary.forecast],['Recebido',summary.received],['Saldo a receber',summary.balance],['Saldo atrasado',summary.overdue],['Despesas previstas',summary.expenses],['Despesas pagas',summary.paidExpenses]].map(([name,value])=>
    <article className="metric card" key={name}><h2>{name}</h2><strong>{money(Number(value)/100)}</strong></article>)}
  </div>
  <div className="dashboard-grid">
   <section className="card panel"><h2>Nova previsão</h2>
    {projects.length?<form className="pilot-fields" onSubmit={event=>{
     event.preventDefault()
     if(project&&due&&value&&!busy)void write(()=>client.rpc('hub_forecast',{w:workspace,p:project,k:kind,d:due}))
    }}>
     <label className="field">Projeto<select aria-label="Projeto" required value={project} onChange={event=>setProject(event.target.value)}>
      <option value="">Selecione</option>{projects.map(item=><option key={item.proposal_id} value={item.proposal_id}>{item.approved.title}</option>)}
     </select></label>
     <Field label="Tipo" value={kind} options={kinds} on={setKind}/>
     <Field label="Vencimento" type="date" required value={due} on={setDue}/>
     {selected&&<p>Valor aprovado · {money(value??0)}</p>}
     <button className="button primary" disabled={busy||!project||!value}>Registrar previsão</button>
    </form>:<Empty title="Nenhum projeto disponível" detail="Abra um projeto a partir de uma proposta aceita."/>}
   </section>
   <section className="card panel"><h2>Registrar recebimento</h2>
    {forecasts.some(item=>outstanding(item)>0)?<form className="pilot-fields" onSubmit={event=>{
     event.preventDefault()
     if(!current||busy||!Number(amount)||cents(Number(amount))>outstanding(current)||received>day())return
     void write(()=>client.rpc('hub_receive',{w:workspace,p:current.proposal_id,k:current.kind,m:current.period,i:receiptId,d:received,a:Number(amount)}),
      ()=>{setCharge('');setAmount('');setReceiptId(uid())})
    }}>
     <label className="field">Previsão<select aria-label="Previsão" required value={charge} onChange={event=>{setCharge(event.target.value);setReceiptId(uid())}}>
      <option value="">Selecione</option>{forecasts.filter(item=>outstanding(item)>0).map(item=><option key={key(item)} value={key(item)}>
       {label(item.proposal_id)} · {item.kind} · {dateLabel(item.due_on)}
      </option>)}
     </select></label>
     <Field label="Data do recebimento" type="date" required value={received} on={setReceived}/>
     <Field label="Valor recebido (R$)" type="number" required min={0.01} step="0.01" value={amount} on={setAmount}/>
     {current&&<p>Saldo desta previsão · {money(outstanding(current)/100)}</p>}
     {current&&cents(Number(amount))>outstanding(current)&&<p role="alert">O valor informado excede o saldo.</p>}
     {received>day()&&<p role="alert">A data do recebimento deve ser hoje ou anterior.</p>}
     <button className="button primary" disabled={busy||!current}>Salvar recebimento</button>
    </form>:<Empty title="Nenhuma previsão em aberto"/>}
   </section>
  </div>
  <section className="card panel"><h2>Previsões</h2>{shownForecasts.length?<div className="table-wrap"><table>
   <thead><tr><th>Projeto</th><th>Tipo</th><th>Vencimento</th><th>Previsto</th><th>Saldo</th></tr></thead>
   <tbody>{shownForecasts.map(item=><tr key={key(item)}><td>{label(item.proposal_id)}</td><td>{item.kind}</td>
    <td>{dateLabel(item.due_on)}</td><td>{money(item.amount)}</td><td>{money(outstanding(item)/100)}</td></tr>)}</tbody>
  </table></div>:<Empty title="Nenhuma previsão registrada"/>}</section>
  <section className="card panel"><h2>Recebimentos</h2>{shownReceipts.length?<div className="table-wrap"><table>
   <thead><tr><th>Projeto</th><th>Tipo</th><th>Data efetiva</th><th>Valor original</th><th>Estorno</th></tr></thead>
   <tbody>{shownReceipts.map(item=><tr key={key(item)+item.id}><td>{label(item.proposal_id)}</td><td>{item.kind}</td>
    <td>{dateLabel(item.received_on)}</td><td>{money(item.amount)}</td><td>{item.reversed_at?
    <span>Estornado em {dateLabel(item.reversed_at)} · {item.reversal_reason}</span>:reverseId===item.id?
    <form onSubmit={e=>{e.preventDefault();if(reason.trim()&&!busy)void write(()=>client.rpc('hub_reverse_receipt',{
     w:workspace,p:item.proposal_id,k:item.kind,m:item.period,i:item.id,reason:reason.trim()
    }),()=>{setReverseId('');setReason('')})}}>
     <Field label="Motivo do estorno" value={reason} on={setReason} required/>
     <button className="button" disabled={busy||!reason.trim()}>Confirmar estorno</button>
     <button className="button" type="button" onClick={()=>setReverseId('')}>Cancelar</button>
    </form>:<button className="button" disabled={busy} onClick={()=>{setReason('');setReverseId(item.id)}}>Estornar</button>}</td></tr>)}</tbody>
  </table></div>:<Empty title="Nenhum recebimento registrado"/>}</section>
  <ExpensePanel client={client} workspace={workspace} expenses={expenses} month={month} busy={busy} write={write}/>
  <section className="card panel"><h2>Últimas alterações financeiras</h2>
   {audit.length?<ul>{audit.map(item=><li key={item.id}><details>
    <summary>{dateLabel(item.occurred_at)} · {item.entity==='hub_expenses'?'Despesa':item.entity==='hub_receipts'?'Recebimento':'Previsão'} · {item.operation==='INSERT'?'Registro criado':item.after_record.reversed_at?'Estorno':'Baixa'}</summary>
    <p>Conta responsável · {item.actor_id??'Sistema'}</p>
    <pre className="details-line">{JSON.stringify({antes:item.before_record,depois:item.after_record},null,2)}</pre>
   </details></li>)}</ul>:<Empty title="Nenhuma alteração registrada"/>}
  </section>
 </Page>
}

function ExpensePanel({client,workspace,expenses,month,busy,write}:{
 client:SupabaseClient;workspace:string;expenses:Expense[];month:string;busy:boolean;write:Write
}){
 const [title,setTitle]=useState('')
 const [due,setDue]=useState(day())
 const [value,setValue]=useState('')
 const [selected,setSelected]=useState('')
 const [paidOn,setPaidOn]=useState(day())
 const [paidAmount,setPaidAmount]=useState('')
 const shown=expenses.filter(item=>!month||item.due_on.slice(0,7)===month||item.paid_on?.slice(0,7)===month)
 return <section className="card panel"><h2>Despesas</h2>
  <form className="fields" onSubmit={e=>{
   e.preventDefault()
   if(!title.trim()||Number(value)<=0||busy)return
   void write(()=>client.from('hub_expenses').insert({workspace_id:workspace,id:uid(),title:title.trim(),due_on:due,amount:Number(value)}).select('id').single(),()=>{setTitle('');setValue('')})
  }}>
   <Field label="Descrição" value={title} on={setTitle} required/>
   <Field label="Vencimento da despesa" type="date" value={due} on={setDue} required/>
   <Field label="Valor previsto (R$)" type="number" min={0.01} step="0.01" value={value} on={setValue} required/>
   <button className="button primary" disabled={busy}>Registrar despesa prevista</button>
  </form>
  {shown.length?<div className="table-wrap"><table><thead><tr><th>Despesa</th><th>Vencimento</th><th>Previsto</th><th>Pagamento</th></tr></thead><tbody>
   {shown.map(item=><tr key={item.id}><td>{item.title}</td><td>{dateLabel(item.due_on)}</td><td>{money(item.amount)}</td><td>{item.paid_on?
    dateLabel(item.paid_on)+' · '+money(item.paid_amount??0):selected===item.id?
    <form onSubmit={e=>{
     e.preventDefault()
     if(busy||paidOn>day()||Number(paidAmount)<=0)return
     void write(()=>client.from('hub_expenses').update({paid_on:paidOn,paid_amount:Number(paidAmount)}).eq('workspace_id',workspace).eq('id',item.id).select('id').single(),()=>setSelected(''))
    }}>
     <Field label="Data efetiva" type="date" value={paidOn} on={setPaidOn} required/>
     <Field label="Valor pago (R$)" type="number" min={0.01} step="0.01" value={paidAmount} on={setPaidAmount} required/>
     {paidOn>day()&&<p role="alert">Informe hoje ou uma data anterior.</p>}
     <button className="button" disabled={busy||paidOn>day()}>Registrar pagamento</button>
     <button className="button" type="button" onClick={()=>setSelected('')}>Cancelar</button>
    </form>:<button className="button" onClick={()=>{setSelected(item.id);setPaidOn(day());setPaidAmount(String(item.amount))}}>Dar baixa</button>}</td></tr>)}
  </tbody></table></div>:<Empty title="Nenhuma despesa no período"/>}
 </section>
}
