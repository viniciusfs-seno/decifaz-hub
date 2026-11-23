import type {SupabaseClient} from '@supabase/supabase-js'
// A black-holed HTTP request must not keep capture or authorization alive.
export async function screenRpc(client:SupabaseClient,name:string,args:Record<string,unknown>){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000)
 try{return await client.rpc(name,args).abortSignal(controller.signal)}finally{clearTimeout(timer)}
}
