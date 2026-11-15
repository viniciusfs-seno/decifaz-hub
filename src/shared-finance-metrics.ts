export type Charge={proposal_id:string;kind:string;period:string;amount:number}
export type Forecast=Charge&{due_on:string}
export type Receipt=Charge&{id:string;received_on:string;reversed_at:string|null;reversal_reason:string|null}
export type Expense={id:string;title:string;due_on:string;amount:number;paid_on:string|null;paid_amount:number|null}
export const chargeKey=(item:Charge)=>[item.proposal_id,item.kind,item.period].join('/')
export const cents=(value:number)=>Math.round(value*100)

export function financeScope(forecasts:Forecast[],receipts:Receipt[],expenses:Expense[],month=''){
 const inMonth=(date:string)=>!month||date.slice(0,7)===month
 return {
  forecasts:forecasts.filter(item=>inMonth(item.due_on)),
  receipts:receipts.filter(item=>inMonth(item.received_on)),
  expenses:expenses.filter(item=>inMonth(item.due_on)),
  payments:expenses.filter(item=>item.paid_on&&inMonth(item.paid_on)),
 }
}

export function financeMetrics(forecasts:Forecast[],receipts:Receipt[],expenses:Expense[],today:string,month=''){
 const scope=financeScope(forecasts,receipts,expenses,month)
 const active=receipts.filter(item=>!item.reversed_at)
 const paid=new Map<string,number>()
 for(const item of active)paid.set(chargeKey(item),(paid.get(chargeKey(item))??0)+cents(item.amount))
 const outstanding=(item:Forecast)=>Math.max(0,cents(item.amount)-(paid.get(chargeKey(item))??0))
 const due=scope.forecasts
 return {
  outstanding,
  scope,
  forecast:due.reduce((sum,item)=>sum+cents(item.amount),0),
  received:scope.receipts.filter(item=>!item.reversed_at).reduce((sum,item)=>sum+cents(item.amount),0),
  overdue:due.filter(item=>item.due_on<today).reduce((sum,item)=>sum+outstanding(item),0),
  balance:due.reduce((sum,item)=>sum+outstanding(item),0),
  expenses:scope.expenses.reduce((sum,item)=>sum+cents(item.amount),0),
  paidExpenses:scope.payments.reduce((sum,item)=>sum+cents(item.paid_amount??0),0),
 }
}
