import {createClient} from 'npm:@supabase/supabase-js@2.119.0'
import {issueTurn,turnHandler} from '../_shared/screen-turn.mjs'

// Disabled unless separately configured. Free Xirsys Developer only after
// account hard-cap/no-card verification; other providers need cost approval.
// No production
// deployment or provider activation is part of PR #40's current homologation.
Deno.serve(turnHandler({
 enabled:Deno.env.get('HUB_TURN_ENABLED')==='true'&&(Deno.env.get('HUB_TURN_PROVIDER')==='xirsys'&&Deno.env.get('HUB_TURN_FREE_PLAN_CONFIRMED')==='true'||Deno.env.get('HUB_TURN_PROVIDER')==='cloudflare'&&Deno.env.get('HUB_TURN_BILLING_APPROVED')==='true'),
 authorize:async(request:Request,args:{s:string;credential:string|null;viewer:string|null})=>{
  const authorization=request.headers.get('Authorization')
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{
   auth:{persistSession:false,autoRefreshToken:false},
   ...(!args.viewer&&authorization?.startsWith('Bearer ')?{global:{headers:{Authorization:authorization}}}:{}),
  })
  return await client.rpc('hub_screen_relay',args)
 },
 issue:(ttl:number)=>issueTurn({provider:Deno.env.get('HUB_TURN_PROVIDER'),keyId:Deno.env.get('HUB_TURN_KEY_ID'),apiToken:Deno.env.get('HUB_TURN_API_TOKEN'),ident:Deno.env.get('HUB_TURN_XIRSYS_IDENT'),secret:Deno.env.get('HUB_TURN_XIRSYS_SECRET'),channel:Deno.env.get('HUB_TURN_XIRSYS_CHANNEL'),ttl}),
}))
