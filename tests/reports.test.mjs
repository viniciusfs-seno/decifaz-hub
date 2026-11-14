import test from 'node:test'
import assert from 'node:assert/strict'
import {reportScope} from '../src/report-scope.ts'
import {reportCsv} from '../src/report-export.ts'

const data = {
 version: 1, team: ['Ana', 'Bia'],
 leads: [
  {id:'a', owner:'Ana', created:'2026-11-01', stage:'Ganho'},
  {id:'b', owner:'Bia', created:'2026-11-01', stage:'Perdido'},
  {id:'c', owner:'Ana', created:'2026-11-02', stage:'Identificado'},
 ],
 projects: [{id:'p', leadId:'a', status:'Em andamento'}],
 meetings: [{id:'m', leadId:'a', state:'Agendada'}],
 activities: [{id:'t', projectId:'p', leadId:'a', status:'Pendente', due:'2026-11-20'}],
 triages: [], proposals: [],
 finance: [
  {id:'f1', projectId:'p', leadId:'a', kind:'Receita', state:'Previsto', amount:150},
  {id:'f2', projectId:'p', leadId:'a', kind:'Receita', state:'Realizado', amount:90},
  {id:'f3', projectId:'', leadId:'', kind:'Receita', state:'Realizado', amount:70},
 ],
}
const filters = {from:'', to:'', owner:'', segment:'', region:'', origin:''}

test('relatório filtra datas inclusivas e mantém os vínculos do lead selecionado',()=>{
 assert.equal(reportScope(data, filters), data)
 const scope = reportScope(data, {...filters, owner:'Ana', from:'2026-11-01', to:'2026-11-01'})
 assert.deepEqual(scope.leads.map(lead=>lead.id), ['a'])
 assert.deepEqual(scope.meetings.map(row=>row.id), ['m'])
 assert.deepEqual(scope.activities.map(row=>row.id), ['t'])
 assert.deepEqual(scope.finance.map(row=>row.id), ['f1','f2'])
})

test('CSV usa o mesmo recorte e separa receitas previstas e realizadas',()=>{
 const scope = reportScope(data, {...filters, owner:'Ana'})
 const csv = reportCsv(scope)
 assert.match(csv, /^\uFEFFIndicador;Valor\r\n/)
 assert.match(csv, /Leads cadastrados;2\r\n/)
 assert.match(csv, /Receita prevista \(R\$\);150,00\r\n/)
 assert.match(csv, /Receita realizada \(R\$\);90,00\r\n/)
 const empty = reportCsv(reportScope(data, {...filters, owner:'Inexistente'}))
 assert.match(empty, /Taxa de conversão \(%\);\r\n/)
 assert.match(empty, /Receita realizada \(R\$\);\r\n/)
})

test('período anterior é consecutivo e tem a mesma duração',async()=>{
 const {previousRange}=await import('../src/report-scope.ts')
 assert.deepEqual(previousRange('2026-11-01','2026-11-07'),{from:'2026-10-25',to:'2026-10-31'})
 assert.deepEqual(previousRange('2026-03-01','2026-03-01'),{from:'2026-02-28',to:'2026-02-28'})
 assert.equal(previousRange('','2026-11-07'),null)
})
