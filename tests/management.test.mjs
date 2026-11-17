import test from 'node:test'
import assert from 'node:assert/strict'
import {managementData,managementCsv,weekStart} from '../src/management-data.ts'
test('semana de Fortaleza cruza mês/ano e coorte usa criação no fuso do negócio',()=>{
 assert.equal(weekStart('2026-11-01'),'2026-10-26');assert.equal(weekStart('2026-01-01'),'2025-12-29');assert.equal(weekStart('2026-11-16'),'2026-11-16')
 const data={leads:[{id:'a',name:'Ganho A',stage:'Ganho',owner:'Ana',created:'2026-11-01T02:30:00Z'},{id:'b',name:'Perdido B',stage:'Perdido',owner:'Ana',created:'2026-10-30'},{id:'c',name:'Aberto',stage:'Qualificado',owner:'Ana',created:'2026-10-29'}],meetings:[],proposals:[]}
 const f={from:'2026-10-01',to:'2026-10-31',owner:'Ana',stage:''},r=managementData(data,[],[],[],[],false,f)
 assert.equal(r.groups.funnel.length,3);assert.equal(r.won,1);assert.equal(r.denominator,2)
 const november=managementData(data,[],[],[],[],false,{...f,from:'2026-11-01',to:'2026-11-30'});assert.equal(november.groups.funnel.length,0)
 const csv=managementCsv(r,f,false);assert.match(csv,/Ganho A/);assert.match(csv,/Perdido B/);assert.doesNotMatch(csv,/Receita prevista/)
 const filtered=managementData(data,[],[],[],[],false,{...f,stage:'Ganho'});assert.equal(filtered.groups.funnel.length,1)
})
test('receitas usam datas próprias, excluem estornos e respeitam responsável e etapa',()=>{
 const data={leads:[{id:'l',stage:'Ganho',created:'2026-10-01',owner:'Ana'}],meetings:[],proposals:[]},projects=[{proposal_id:'p',lead_id:'l',approved:{title:'Entrega'},owner:'Bia',due_on:'2026-11-01',status:'Em andamento'}]
 const forecast=[{proposal_id:'p',kind:'Implantação',period:'0001-01-01',due_on:'2026-10-31',amount:100}],receipts=[{...forecast[0],id:'r',received_on:'2026-11-01',amount:30},{...forecast[0],id:'x',received_on:'2026-11-02',amount:50,reversed_at:'2026-11-03'}]
 const f={from:'2026-11-01',to:'2026-11-30',owner:'Bia',stage:'Ganho'},r=managementData(data,projects,[],forecast,receipts,true,f)
 assert.equal(r.groups.forecast.length,0);assert.equal(r.groups.received.length,1);assert.equal(r.groups.received[0].amount,30)
 assert.match(managementCsv(r,f,true),/30,00/);assert.doesNotMatch(managementCsv(r,f,true),/50,00/)
})
