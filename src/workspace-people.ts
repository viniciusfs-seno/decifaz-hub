import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
export type WorkspacePerson={id:string;name:string;active:boolean}
export function useWorkspacePeople(client:SupabaseClient,workspace:string,revision=0){
 const [result,setResult]=useState<{workspace:string;people:WorkspacePerson[]}>()
 useEffect(()=>{let current=true;setResult(undefined);if(workspace)void client.rpc('hub_registry_people',{w:workspace}).then(r=>{if(current&&!r.error)setResult({workspace,people:r.data??[]})});return()=>{current=false}},[client,workspace,revision])
 return result?.workspace===workspace?result.people:[]
}
export function memberOwner(owner:string,people:WorkspacePerson[],id?:string|null){
 // Resolve only explicit IDs or the exact technical fallback emitted by the old
 // server. Do not match human names or rewrite persisted assignment snapshots.
 if(id){const person=people.find(p=>p.id===id);if(person)return person.name+(person.active?'':' (desativado)')}
 const matches=people.filter(p=>owner==='Integrante '+p.id.slice(0,8))
 return matches.length===1?matches[0].name+(matches[0].active?'':' (desativado)'):owner
}
