import test from 'node:test'
import assert from 'node:assert/strict'
import {businessDay,filterWork,workEntries} from '../src/shared-operational.ts'

test('agenda usa Fortaleza na virada UTC, recorte inclusivo de sete dias e exclui concluídos',()=>{
 assert.equal(businessDay(new Date('2026-11-16T02:59:59Z')),'2026-11-15')
 assert.equal(businessDay(new Date('2026-11-16T03:00:00Z')),'2026-11-16')
 const rows=['2026-11-14','2026-11-15','2026-11-21','2026-11-22',''].map((date,i)=>({key:String(i),date,status:'Pendente',kind:'activity',owner:'Ana',title:'Ação',detail:''}))
 rows.push({...rows[1],key:'done',status:'Concluída'})
 assert.deepEqual(filterWork(rows,{period:'week'},'2026-11-15').map(r=>r.key),['1','2'])
 assert.deepEqual(filterWork(rows,{period:'overdue'},'2026-11-15').map(r=>r.key),['0'])
 assert.equal(filterWork(rows,{period:'today',state:'all'},'2026-11-15').length,2)
 assert.equal(filterWork(rows,{period:'undated'},'2026-11-15').length,1)
 assert.equal(filterWork(rows,{owner:'Outro'},'2026-11-15').length,0)
})
test('próximo contato não duplica atividade persistida e agenda mantém vínculos de entrega',()=>{
 const lead={id:'l',next:'Contatar',due:'2026-11-15',stage:'Qualificado',owner:'Ana'}
 const activities=[{id:'a',lead_id:'l',title:'Contatar',due_on:lead.due,status:'Pendente',owner:'Ana'}]
 const projects=[{proposal_id:'p',lead_id:'l',approved:{title:'Entrega'},due_on:'2026-11-16',status:'Em andamento',owner:'Bia'}]
 const rows=workEntries([lead],activities,[],projects)
 assert.equal(rows.length,2)
 assert.equal(rows[1].projectId,'p')
 assert.equal(rows.filter(r=>r.kind==='contact').length,0)
})
