import {backupSections} from './backup.ts'
import {dateLabel,money,type Data} from './domain.ts'

function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical)
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,entry])=>[key,canonical(entry)]))
 return value
}

export function backupDiff(current:Data,incoming:Data){
 return backupSections.map(([key,label])=>{
  const index=(data:Data)=>new Map((data[key]??[]).map(row=>{
   const id=typeof row==='string'?row:'id'in row?row.id:'week'in row?row.week:row.leadId
   const name=typeof row==='string'?row:'name'in row?row.name:'title'in row?row.title:'week'in row?dateLabel(row.week):data.leads.find(lead=>lead.id===row.leadId)?.name??id
   return [id,{id,name,record:row,value:JSON.stringify(canonical(row))}] as const
  }))
  const before=index(current),after=index(incoming)
  const added=[...after.values()].filter(row=>!before.has(row.id))
  const removed=[...before.values()].filter(row=>!after.has(row.id))
  const changed=[...after.values()].flatMap(row=>{
   const old=before.get(row.id)
   return old&&old.value!==row.value?[{...row,fields:changedFields(old.record,row.record),name:old.name===row.name?row.name:old.name+' → '+row.name}]:[]
  })
  return {key,label,added,removed,changed}
 })
}

const fieldLabels:Record<string,string>={name:'Nome',title:'Título',owner:'Responsável',due:'Prazo',status:'Situação',state:'Situação',amount:'Valor',setup:'Implantação',monthly:'Mensalidade',stage:'Etapa',validity:'Validade',notes:'Observações',next:'Próxima ação',result:'Resultado',paid:'Data da baixa',completedOn:'Data de conclusão',closedOn:'Data de fechamento',leadId:'ID do lead',projectId:'ID do projeto',proposalId:'ID da proposta',history:'Histórico',actions:'Atividades',services:'Serviços',at:'Data e hora',actor:'Autor',text:'Descrição'}

function changedFields(before:unknown,after:unknown){
 const fields:{key:string;label:string;before:string;after:string}[]=[]
 function walk(previous:unknown,next:unknown,path:string[],labels:string[]){
  if(JSON.stringify(canonical(previous))===JSON.stringify(canonical(next)))return
  const sample=next??previous
  if(Array.isArray(sample)){
   const left=Array.isArray(previous)?previous:[]
   const right=Array.isArray(next)?next:[]
   const keyed=path.at(-1)==='actions'
   const index=(items:unknown[])=>new Map(items.map((item,i)=>[keyed&&(item as {id?:string})?.id||String(i),item]))
   const old=index(left),updated=index(right)
   for(const key of new Set([...old.keys(),...updated.keys()])){
    const item=(updated.get(key)??old.get(key)) as {title?:string}
    walk(old.get(key),updated.get(key),[...path,key],[...labels,item?.title??'Item '+(Number(key)+1)])
   }
   if(!left.length&&!right.length)fields.push({key:path.join('.'),label:labels.join(' › '),before:previous===undefined?'—':'Lista vazia',after:next===undefined?'—':'Lista vazia'})
   return
  }
  if(sample&&typeof sample==='object'){
   const left=(previous??{}) as Record<string,unknown>
   const right=(next??{}) as Record<string,unknown>
   for(const key of new Set([...Object.keys(left),...Object.keys(right)])){
    walk(left[key],right[key],[...path,key],[...labels,fieldLabels[key]??key])
   }
   return
  }
  fields.push({key:path.join('.'),label:labels.join(' › '),before:fieldValue(path.at(-1)??'',previous),after:fieldValue(path.at(-1)??'',next)})
 }
 walk(before,after,[],[])
 return fields
}

function fieldValue(key:string,value:unknown):string{
 if(value===undefined||value===null||value==='')return '—'
 if(typeof value==='boolean')return value?'Sim':'Não'
 if(typeof value==='number'&&['amount','setup','monthly'].includes(key))return money(value)
 if(typeof value==='string')return /^\d{4}-\d{2}-\d{2}$/.test(value)?dateLabel(value):value
 return typeof value==='object'?JSON.stringify(value,null,2):String(value)
}
