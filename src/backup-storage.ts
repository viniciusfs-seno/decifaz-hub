import type {Data} from './domain.ts'

export const storageKey='decifaz-hub-v1'
type StoragePort=Pick<Storage,'getItem'|'setItem'>
type Stored={data:Data;undo?:Data}
export class StaleDataError extends Error {}

function decode(raw:string|null):Stored|undefined{
 if(raw===null)return
 const value=JSON.parse(raw)
 const stored:Stored=value?.format==='decifaz-storage-1'?value:{data:value}
 if(stored.data?.version!==1||!Array.isArray(stored.data.leads))throw new Error('Armazenamento inválido.')
 return stored
}

export function createBackupStorage(storage:()=>StoragePort){
 const read=()=>storage().getItem(storageKey)
 function write(expected:string|null,value:Stored){
  const next=JSON.stringify({format:'decifaz-storage-1',...value})
  if(read()!==expected)throw new StaleDataError()
  storage().setItem(storageKey,next)
  return {raw:next,...value}
 }
 return {
  read,
  load(raw=read()){return decode(raw)},
  save(expected:string|null,data:Data){return write(expected,{data,undo:decode(expected)?.undo})},
  restore(expected:string|null,data:Data,fallback?:Data){
   let undo:Data|undefined
   try{undo=decode(expected)?.data??fallback}catch{/* dados ilegíveis não formam uma cópia restaurável */}
   return write(expected,{data,undo})
  },
  undo(expected:string|null){
   if(read()!==expected)throw new StaleDataError()
   const previous=decode(expected)?.undo
   if(!previous)throw new Error('Sem restauração para desfazer.')
   return write(expected,{data:previous})
  },
 }
}
