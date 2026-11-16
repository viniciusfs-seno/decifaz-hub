import test from 'node:test'
import assert from 'node:assert/strict'
import {meetingLink} from '../src/meeting-link.ts'
import {parseBackup} from '../src/backup.ts'
import {agendaEntries} from '../src/agenda-data.ts'
import {emptyLead} from '../src/domain.ts'

const meeting={id:'m',leadId:'l',date:'2026-11-13',participants:'Teste',state:'Agendada',answers:{},checked:[],summary:'',tools:'',objections:'',budget:'',next:'',owner:'Equipe',due:''}
const data={version:1,leads:[{...emptyLead('Equipe'),id:'l'}],team:['Equipe'],triages:[],activities:[],meetings:[meeting],proposals:[],projects:[],finance:[]}

test('link da chamada exige HTTPS e rejeita credenciais no endereço',()=>{
 assert.equal(meetingLink(' https://example.com/sala '),'https://example.com/sala')
 for(const url of ['javascript:alert(1)','http://example.com','https://u:p@example.com','sala']) assert.equal(meetingLink(url),null)
})

test('backup antigo é compatível e a agenda recebe o link persistido',()=>{
 assert.equal(parseBackup(JSON.stringify(data)).data.meetings[0].callUrl,undefined)
 const linked={...data,meetings:[{...meeting,callUrl:'https://example.com/sala'}]}
 const restored=parseBackup(JSON.stringify(linked)).data
 assert.equal(agendaEntries(restored)[0].callUrl,'https://example.com/sala')
 assert.ok(parseBackup(JSON.stringify({...data,meetings:[{...meeting,callUrl:'javascript:alert(1)'}]})).error)
})
test('backup da demo preserva pauta e soluções opcionais do editor reutilizado',()=>{
 const restored=parseBackup(JSON.stringify({...data,meetings:[{...meeting,agenda:'Pauta fictícia',selectedSolutions:['Automações']}]})).data
 assert.equal(restored.meetings[0].agenda,'Pauta fictícia')
 assert.deepEqual(restored.meetings[0].selectedSolutions,['Automações'])
})
