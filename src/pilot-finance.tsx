import {useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,day,money,uid} from './domain'
import type {SharedProject} from './pilot-projects'
import {Empty,Field,Page} from './ui'

type Charge={proposal_id:string;kind:string;period:string;amount:number}
type Forecast=Charge&{due_on:string}
type Receipt=Charge&{id:string;received_on:string}
type Write=(op:()=>PromiseLike<{error:unknown;data:unknown}>,success?:()=>void)=>Promise<boolean>
const kinds=['Implantação','Mensalidade']
const key=(item:Charge)=>[item.proposal_id,item.kind,item.period].join('/')
const cents=(value:number)=>Math.round(value*100)

export function loadFinance(client:SupabaseClient,workspace:string){
 return Promise.all([
  client.from('hub_receivables').select('proposal_id,kind,period,amount,due_on').eq('workspace_id',workspace)
   .order('due_on').order('proposal_id').order('kind').returns<Forecast[]>(),
  client.from('hub_receipts').select('proposal_id,kind,period,amount,id,received_on').eq('workspace_id',workspace)
   .order('received_on',{ascending:false}).order('id').returns<Receipt[]>(),
 ])
}

export function SharedFinance({client,workspace,projects,forecasts,receipts,busy,write}:{
 client:SupabaseClient;workspace:string;projects:SharedProject[];forecasts:Forecast[];receipts:Receipt[];busy:boolean;write:Write
}){
 const [project,setProject]=useState('')
 const [kind,setKind]=useState(kinds[0])
 const [due,setDue]=useState(day())
 const [charge,setCharge]=useState('')
 const [received,setReceived]=useState(day())
 const [amount,setAmount]=useState('')
 const [receiptId,setReceiptId]=useState(uid)
 const paid=new Map<string,number>()
 for(const receipt of receipts)paid.set(key(receipt),(paid.get(key(receipt))??0)+cents(receipt.amount))
 const total=(entries:Charge[])=>entries.reduce((sum,item)=>sum+cents(item.amount),0)
 const outstanding=(item:Forecast)=>cents(item.amount)-(paid.get(key(item))??0)
 const current=forecasts.find(item=>key(item)===charge)
 const selected=projects.find(item=>item.proposal_id===project)
 const value=kind==='Implantação'?selected?.approved.setup:selected?.approved.monthly
 const label=(id:string)=>projects.find(item=>item.proposal_id===id)?.approved.title??'Projeto vinculado'

 return <Page title="Financeiro" description="Acompanhe previsões e registre os valores que a Decifaz já recebeu.">
  <div className="kpis">
   {[['Total previsto',total(forecasts)],['Recebido',total(receipts)],['Saldo a receber',Math.max(0,total(forecasts)-total(receipts))]].map(([name,value])=>
    <article className="metric card" key={name}><h2>{name}</h2><strong>{money(Number(value)/100)}</strong></article>)}
  </div>
  <div className="dashboard-grid">
   <section className="card panel"><h2>Nova previsão</h2>
    {projects.length?<form className="pilot-fields" onSubmit={event=>{
     event.preventDefault()
     if(project&&due&&value&&!busy)void write(()=>client.rpc('hub_forecast',{w:workspace,p:project,k:kind,d:due}))
    }}>
     <label className="field">Projeto<select required value={project} onChange={event=>setProject(event.target.value)}>
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
     <label className="field">Previsão<select required value={charge} onChange={event=>{setCharge(event.target.value);setReceiptId(uid())}}>
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
  <section className="card panel"><h2>Previsões</h2>{forecasts.length?<div className="table-wrap"><table>
   <thead><tr><th>Projeto</th><th>Tipo</th><th>Vencimento</th><th>Previsto</th><th>Saldo</th></tr></thead>
   <tbody>{forecasts.map(item=><tr key={key(item)}><td>{label(item.proposal_id)}</td><td>{item.kind}</td>
    <td>{dateLabel(item.due_on)}</td><td>{money(item.amount)}</td><td>{money(outstanding(item)/100)}</td></tr>)}</tbody>
  </table></div>:<Empty title="Nenhuma previsão registrada"/>}</section>
  <section className="card panel"><h2>Recebimentos</h2>{receipts.length?<div className="table-wrap"><table>
   <thead><tr><th>Projeto</th><th>Tipo</th><th>Data efetiva</th><th>Recebido</th></tr></thead>
   <tbody>{receipts.map(item=><tr key={key(item)+item.id}><td>{label(item.proposal_id)}</td><td>{item.kind}</td>
    <td>{dateLabel(item.received_on)}</td><td>{money(item.amount)}</td></tr>)}</tbody>
  </table></div>:<Empty title="Nenhum recebimento registrado"/>}</section>
 </Page>
}
