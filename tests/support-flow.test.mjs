import test from 'node:test'
import assert from 'node:assert/strict'
import {activityTypes, day, emptyLead, event, metrics, upsert} from '../src/domain.ts'
import {applyProposal} from '../src/proposal-rules.ts'
import {handoffItems, saveProjectRecord} from '../src/handoff.ts'
import {deliveryChecks} from '../src/delivery.ts'
import {withCompletion} from '../src/review-summary.ts'
import {agendaEntries} from '../src/agenda-data.ts'
import {parseBackup, serializeBackup} from '../src/backup.ts'
import {createBackupStorage} from '../src/backup-storage.ts'

test('aceite, entrega e suporte concluído preservam vínculos na restauração',()=>{
 const today=day()
 const lead={...emptyLead('Ana'),id:'lead',name:'Cliente fictício'}
 const proposal={id:'proposal',leadId:lead.id,title:'Site',scope:'Página inicial',services:['Site'],setup:100,monthly:0,terms:'',validity:today,version:1,status:'Rascunho'}
 let data={version:1,team:['Ana'],leads:[lead],triages:[],activities:[],meetings:[],proposals:[proposal],projects:[],finance:[]}
 for(const status of ['Enviada','Aceita']){
  const outcome=applyProposal(data,data.proposals[0],{status,date:today,note:'Evidência fictícia'})
  assert.ok(outcome.data,outcome.error)
  data=outcome.data
 }
 assert.equal(data.leads[0].stage,'Ganho')
 const project={id:'project',leadId:lead.id,proposalId:proposal.id,title:'Site',owner:'Ana',due:today,stage:'Descoberta',status:'Planejado',tasks:'',deliverables:''}
 const created=saveProjectRecord(data,project)
 assert.ok(created.data,created.error)
 data=created.data
 const delivered=saveProjectRecord(data,{
  ...data.projects[0],stage:'Entrega',status:'Entregue',
  handoff:{checks:handoffItems.map(([key])=>key),reference:'Aceite comercial',notes:''},
  delivery:{checks:deliveryChecks.map(([key])=>key),acceptedAt:today,reference:'Aceite final',notes:''},
 })
 assert.ok(delivered.data,delivered.error)
 data=delivered.data
 assert.equal(data.projects[0].approved.scope,proposal.scope)
 assert.ok(activityTypes.includes('Suporte'))
 const activity={id:'support',leadId:lead.id,projectId:project.id,title:'Botão de contato',description:'Reproduzir no celular',kind:'Suporte',owner:'Ana',due:today,priority:'Normal',status:'Pendente',result:''}
 data={...data,activities:[activity]}
 assert.equal(metrics(data).pending,1)
 assert.equal(agendaEntries(data).find(entry=>entry.id===activity.id).leadId,lead.id)
 const finished=withCompletion({...activity,status:'Concluída',result:'Reteste fictício confirmado'},activity)
 data={...data,activities:upsert(data.activities,finished),leads:data.leads.map(item=>({...item,history:[event('Atividade concluída: '+activity.title,'Ana'),...item.history]}))}
 assert.equal(finished.completedOn,today)
 assert.equal(metrics(data).pending,0)
 assert.equal(agendaEntries(data).some(entry=>entry.id===activity.id),false)
 const parsed=parseBackup(serializeBackup(data))
 assert.ok(parsed.data,parsed.error)
 const isolatedStore=new Map()
 const repository=createBackupStorage(()=>({getItem:key=>isolatedStore.get(key)??null,setItem:(key,value)=>isolatedStore.set(key,value)}))
 repository.restore(null,parsed.data)
 const restored=repository.load().data
 assert.equal(restored.activities[0].projectId,restored.projects[0].id)
 assert.equal(restored.activities[0].leadId,restored.leads[0].id)
 assert.equal(restored.projects[0].proposalId,restored.proposals[0].id)
 assert.equal(restored.activities[0].result,finished.result)
 assert.deepEqual(restored.leads[0].history,data.leads[0].history)
 assert.equal(metrics(restored).pending,0)
})
