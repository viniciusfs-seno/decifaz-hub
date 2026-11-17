import {createContext,useContext,useRef,useState,type ReactNode} from 'react'

// Only view preferences live here. Records, permissions and credentials never do.
// The provider is recreated when the workspace changes or the session ends.
const Views=createContext<Map<string,unknown>|null>(null)
export function ViewStateProvider({children}:{children:ReactNode}){
 const cache=useRef(new Map<string,unknown>())
 return <Views.Provider value={cache.current}>{children}</Views.Provider>
}
export function useViewState<T,>(key:string,initial:T){
 const cache=useContext(Views)
 const [value,setValue]=useState<T>(()=>cache?.has(key)?cache.get(key) as T:initial)
 const current=useRef(value)
 function update(next:T|((previous:T)=>T)){
  const result=typeof next==='function'?(next as (v:T)=>T)(current.current):next
  current.current=result
  cache?.set(key,result)
  setValue(result)
 }
 return [value,update] as const
}
