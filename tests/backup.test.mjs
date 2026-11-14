import test from 'node:test'
import assert from 'node:assert/strict'
import {parseBackup} from '../src/backup.ts'
import {createBackupStorage,StaleDataError} from '../src/backup-storage.ts'
import {emptyLead} from '../src/domain.ts'

const data={version:1,team:['Ana'],leads:[{...emptyLead('Ana'),id:'lead'}],triages:[],activities:[],meetings:[],proposals:[],projects:[],finance:[]}
const replacement={...data,leads:[]}
const parse=value=>parseBackup(JSON.stringify(value))

function fakeStorage(raw=null){
 return {
  raw,fail:false,
  getItem(){return this.raw},
  setItem(key,value){if(this.fail)throw new Error('Quota excedida');this.raw=value},
 }
}

test('backup antigo sem fechamentos mantém os dados e é aceito',()=>{
 assert.deepEqual(parse(data),{data})
 assert.ok(parse({...data,version:2}).error)
})

test('IDs duplicados e vínculos inválidos são rejeitados',()=>{
 assert.match(parse({...data,leads:[...data.leads,...data.leads]}).error,/duplicados/)
 const project={id:'p',leadId:'lead',proposalId:'ausente',title:'Projeto',owner:'Ana',stage:'Descoberta',due:'2026-11-20',tasks:'',deliverables:'',status:'Planejado'}
 assert.match(parse({...data,projects:[project]}).error,/proposta vinculada inválida/)
})

test('restauração guarda dados anteriores e desfazer consome a cópia',()=>{
 const storage=fakeStorage(JSON.stringify(data))
 const repo=createBackupStorage(()=>storage)
 assert.deepEqual(repo.load().data,data)
 let restored=repo.restore(repo.read(),replacement)
 assert.deepEqual(restored.undo,data)
 restored=repo.save(restored.raw,{...replacement,team:['Bia']})
 assert.deepEqual(repo.load().undo,data)
 assert.deepEqual(repo.undo(restored.raw).data,data)
 assert.throws(()=>repo.undo(repo.read()),/Sem restauração/)
})

test('falha de gravação preserva dados e cópia para desfazer',()=>{
 const storage=fakeStorage(JSON.stringify(data))
 const repo=createBackupStorage(()=>storage)
 const initial=repo.read()
 storage.fail=true
 assert.throws(()=>repo.restore(initial,replacement),/Quota/)
 assert.equal(repo.read(),initial)
 storage.fail=false
 const restored=repo.restore(initial,replacement)
 storage.fail=true
 assert.throws(()=>repo.undo(restored.raw),/Quota/)
 assert.equal(repo.read(),restored.raw)
 assert.deepEqual(repo.load().undo,data)
})

test('uma aba com versão antiga não sobrescreve uma alteração já gravada',()=>{
 const storage=fakeStorage(JSON.stringify(data))
 const first=createBackupStorage(()=>storage)
 const second=createBackupStorage(()=>storage)
 const old=second.read()
 const restored=first.restore(old,replacement)
 for(const operation of [()=>second.save(old,data),()=>second.restore(old,data),()=>second.undo(old)]){
  assert.throws(operation,StaleDataError)
 }
 assert.equal(first.read(),restored.raw)
})

test('restauração recupera armazenamento ilegível e aceita primeira utilização',()=>{
 const storage=fakeStorage('{')
 const repo=createBackupStorage(()=>storage)
 assert.equal(repo.restore(repo.read(),replacement,data).undo,undefined)
 storage.raw=null
 assert.deepEqual(repo.restore(null,replacement,data).undo,data)
})

test('prévia identifica adições, alterações e remoções por ID e ignora ordem das chaves',async()=>{
 const {backupDiff}=await import('../src/backup-diff.ts')
 const same={...data.leads[0],id:'same'}
 const reordered=Object.fromEntries(Object.entries(same).reverse())
 const old={...data,leads:[{...same,id:'change',name:'Antigo'},{...same,id:'remove'},same]}
 const next={...data,leads:[reordered,{...same,id:'change',name:'Novo'},{...same,id:'add'}]}
 const leads=backupDiff(old,next).find(section=>section.key==='leads')
 assert.deepEqual(leads.added.map(x=>x.id),['add'])
 assert.deepEqual(leads.changed.map(x=>x.name),['Antigo → Novo'])
 assert.deepEqual(leads.removed.map(x=>x.id),['remove'])
})

test('exportação identifica versão e data, preservando a leitura de backups antigos',async()=>{
 const {serializeBackup}=await import('../src/backup.ts')
 const exportedAt='2026-11-13T15:30:00.000Z'
 assert.deepEqual(parseBackup(serializeBackup(data,exportedAt)),{data,metadata:{formatVersion:1,exportedAt}})
 assert.ok(parse({...data,backup:{formatVersion:2,exportedAt}}).error)
 assert.ok(parse({...data,backup:{formatVersion:1,exportedAt:'inválida'}}).error)
})

test('compara responsáveis de atividades históricas pelo ID',async()=>{
 const {backupDiff}=await import('../src/backup-diff.ts')
 const closure={week:'2026-11-09',closedOn:'2026-11-13',notes:'Revisão',actions:[
  {id:'a',title:'Contato',owner:'Ana',due:'2026-11-20',status:'Pendente'},
  {id:'b',title:'Visita',owner:'Bia',due:'2026-11-20',status:'Pendente'},
 ]}
 const before={...data,reviewClosures:[closure]}
 const after={...data,reviewClosures:[{...closure,actions:[closure.actions[1],{...closure.actions[0],owner:'Caio'}]}]}
 assert.deepEqual(backupDiff(before,after).find(section=>section.key==='reviewClosures').changed[0].fields,[
  {key:'actions.a.owner',label:'Atividades › Contato › Responsável',before:'Ana',after:'Caio'},
 ])
})
