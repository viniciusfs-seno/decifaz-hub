import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {FinancialItem} from './financial-week-types'
import {Dialog,Empty} from './ui'
import {AuditChanges} from './audit-changes'
import {RegistryTimeline} from './registry'
import {memberOwner,type WorkspacePerson} from './workspace-people'
import {allRows} from './load-all'
import {dateLabel,money} from './domain'
type Payment={id:string;actor_id:string|null;paid_on:string;amount:number;created_at:string;reversed_at:string|null;reversal_reason:string|null}
type Audit={id:string;occurred_at:string;actor_id:string|null;operation:string;before_record:Record<string,unknown>|null;after_record:Record<string,unknown>|null}
export function FinancialPaymentTrace({client,workspace,item,people,onClose}:{client:SupabaseClient;workspace:string;item:FinancialItem;people:WorkspacePerson[];onClose:()=>void}){
 const [payments,setPayments]=useState<Payment[]>([]),[audit,setAudit]=useState<Audit[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{let live=true;void(async()=>{try{
  if(item.kind==='bill'){const r=await allRows(client.from('hub_internal_payments').select('id,actor_id,paid_on,amount,created_at,reversed_at,reversal_reason').eq('workspace_id',workspace).eq('bill_id',item.key).order('created_at').order('id'));if(r.error)throw Error();if(live)setPayments(r.data as Payment[])}
  else{const r=await allRows(client.from('hub_finance_audit').select('id,occurred_at,actor_id,operation,before_record,after_record').eq('workspace_id',workspace).eq('entity',item.kind==='receipt'?'hub_receipts':'hub_expenses').eq('after_record->>id',item.key).order('occurred_at').order('id'));if(r.error)throw Error();if(live)setAudit(r.data as Audit[])}
 }catch{if(live)setError('Não foi possível consultar a rastreabilidade. Confira seu acesso e reabra o registro.')}finally{if(live)setLoading(false)}})();return()=>{live=false}},[client,workspace,item.kind,item.key])
 const timestamp=(value:string)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Fortaleza',dateStyle:'short',timeStyle:'short'}).format(new Date(value))
 return <Dialog title={'Rastreabilidade da baixa · '+item.title} onClose={onClose} wide><div className="dialog-body"><p>Origem atual: {item.title} · responsável: {memberOwner(item.owner,people,item.owner_id)}. O autor da baixa é mostrado separadamente; não atribuímos registros antigos por inferência.</p>{loading&&<p role="status">Carregando rastreabilidade…</p>}{error&&<p role="alert">{error}</p>}
  {payments.map(p=><article key={p.id}><h3>{p.reversed_at?'Pagamento com estorno registrado':'Pagamento registrado'}</h3><p>Autor: {p.actor_id?memberOwner('Integrante anterior',people,p.actor_id):'Autor não disponível'} · data efetiva: {dateLabel(p.paid_on)} · {money(Number(p.amount))}</p><p>Data do registro: {timestamp(p.created_at)}</p>{p.reversed_at&&<p>Estorno: {timestamp(p.reversed_at)} · {p.reversal_reason||'Motivo não informado'}</p>}</article>)}
  {audit.map(a=><article key={a.id}><h3>{a.operation==='INSERT'?'Registro original':'Correção ou atualização registrada'}</h3><p>Autor: {a.actor_id?memberOwner('Integrante anterior',people,a.actor_id):'Autor não disponível'} · registro: {timestamp(a.occurred_at)}</p><p>Data efetiva registrada: {dateLabel(String(a.after_record?.received_on??a.after_record?.paid_on??''))}</p><AuditChanges before={a.before_record} after={a.after_record}/></article>)}
  {!loading&&!payments.length&&!audit.length&&!error&&<Empty title="Sem registro de baixa disponível" detail="A auditoria pode não cobrir registros antigos. Ausência não identifica autor nem data de registro."/>}
  <p className="view-hint">Esta consulta não corrige nem duplica pagamentos. Estornos de recebimentos usam o Financeiro existente; não foi criado estorno de obrigações nesta entrega. A linha do tempo conserva as alterações observadas desde sua implantação.</p>
  {item.kind!=='receipt'&&<RegistryTimeline client={client} workspace={workspace} record={item.origin}/>}
 </div><div className="dialog-foot"><button className="button" onClick={onClose}>Voltar à revisão financeira</button></div></Dialog>
}
