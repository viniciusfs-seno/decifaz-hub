import test from 'node:test'
import assert from 'node:assert/strict'
import {financeMetrics,financeScope} from '../src/shared-finance-metrics.ts'

test('separa competência, recebimento efetivo, estorno e despesa paga',()=>{
 const base={proposal_id:'p',kind:'Implantação',period:'0001-01-01'}
 const forecasts=[{...base,amount:100,due_on:'2026-10-10'}]
 const receipts=[
  {...base,id:'a',amount:30,received_on:'2026-11-02',reversed_at:null,reversal_reason:null},
  {...base,id:'b',amount:40,received_on:'2026-10-10',reversed_at:'2026-11-01T00:00:00Z',reversal_reason:'Erro'},
 ]
 const expenses=[{id:'e',title:'Licença',amount:20,due_on:'2026-10-02',paid_on:'2026-11-03',paid_amount:25}]
 const october=financeMetrics(forecasts,receipts,expenses,'2026-11-14','2026-10')
 assert.deepEqual([october.forecast,october.received,october.balance,october.overdue,october.expenses,october.paidExpenses],
  [10000,0,7000,7000,2000,0])
 const november=financeMetrics(forecasts,receipts,expenses,'2026-11-14','2026-11')
 assert.deepEqual([november.forecast,november.received,november.overdue,november.expenses,november.paidExpenses],[0,3000,0,0,2500])
 assert.deepEqual(november.scope,financeScope(forecasts,receipts,expenses,'2026-11'))
 assert.equal(november.scope.forecasts.length,0)
 assert.equal(november.scope.receipts.length,1)
 assert.equal(november.scope.expenses.length,0)
 assert.equal(november.scope.payments.length,1)
 assert.deepEqual(financeScope(forecasts,receipts,expenses,'').receipts,receipts)
})
