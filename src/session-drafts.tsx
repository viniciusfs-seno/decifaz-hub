import {createContext,useContext,useRef,useState,type ReactNode,type SetStateAction} from 'react'

// Volatile form drafts only. Never write records or credentials to browser storage.
// The provider is recreated on workspace/permission changes and sign-out.
const Drafts=createContext<Map<string,unknown>|null>(null)
export function SessionDrafts({children}:{children:ReactNode}){
 const drafts=useRef(new Map<string,unknown>())
 return <Drafts.Provider value={drafts.current}>{children}</Drafts.Provider>
}
export function useSessionDraft<T,>(key:string,initial:()=>T){
 const cache=useContext(Drafts)
 const [value,setValue]=useState<T>(()=>cache?.has(key)?cache.get(key) as T:initial())
 const current=useRef(value)
 function update(action:SetStateAction<T>){
  const next=typeof action==='function'?(action as (v:T)=>T)(current.current):action
  current.current=next;cache?.set(key,next);setValue(next)
 }
 return [value,update,()=>cache?.delete(key)] as const
}
