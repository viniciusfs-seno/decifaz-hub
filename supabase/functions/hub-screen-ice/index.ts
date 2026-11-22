import {createClient} from 'npm:@supabase/supabase-js@2.119.0'
import {issueTurn,turnHandler} from '../_shared/screen-turn.mjs'

// Disabled unless separately configured after cost approval. No production
// deployment or provider activation is part of PR #40's current homologation.
Deno.serve(turnHandler({
 enabled:Deno.env.get('HUB_TURN_ENABLED')==='true',
 authorize:async(request:Request,args:{s:string;credential:string|null;viewer:string|null})=>{
  const authorization=request.headers.get('Authorization')
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
   auth:{persistSession:false,autoRefreshToken:false},
   ...(!args.viewer&&authorization?.startsWith('Bearer ')?{global:{headers:{Authorization:authorization}}}:{}),
  })
  return await client.rpc('hub_screen_relay',args)
 },
 issue:(ttl:number)=>issueTurn({keyId:Deno.env.get('HUB_TURN_KEY_ID'),apiToken:Deno.env.get('HUB_TURN_API_TOKEN'),ttl}),
}))
