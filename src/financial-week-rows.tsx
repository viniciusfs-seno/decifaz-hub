import type {ReactNode} from 'react'
import type {FinancialItem} from './financial-week-types'
import {dateLabel,money} from './domain'
import {memberOwner,type WorkspacePerson} from './workspace-people'
export function FinancialRows({items,people=[],frozen=false,actions}:{items:FinancialItem[];people?:WorkspacePerson[];frozen?:boolean;actions?:(i:FinancialItem)=>ReactNode}){
 return <div className="table-wrap"><table className="record-table"><thead><tr><th>Origem</th><th>Responsável</th><th>Vencimento</th><th>Previsto</th><th>Realizado</th>{actions&&<th>Ação</th>}</tr></thead><tbody>{items.map(i=><tr key={i.kind+i.key}><td data-label="Origem"><div>{i.title}<p className="view-hint">{i.category} · {i.status}{i.contract_id?' · Contrato vinculado':''}</p></div></td><td data-label="Responsável">{frozen?i.owner:memberOwner(i.owner,people,i.owner_id)}</td><td data-label="Vencimento"><div>{dateLabel(i.due_on)}{i.paid_on&&<p>Realização: {dateLabel(i.paid_on)}</p>}</div></td><td data-label="Previsto">{money(Number(i.expected))}</td><td data-label="Realizado">{i.paid_on?money(Number(i.actual)):'—'}</td>{actions&&<td data-label="Ação">{actions(i)}</td>}</tr>)}</tbody></table></div>
}
