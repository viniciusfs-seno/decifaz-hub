import {createClient} from 'npm:@supabase/supabase-js@2.119.0'
import {verifyNoticeEvent} from '../_shared/notice-webhook.mjs'
Deno.serve(async request=>{
 const response=(status:number)=>new Response(null,{status,headers:{'Cache-Control':'no-store'}})
 if(request.method!=='POST')return response(405)
 if(Deno.env.get('HUB_NOTICE_MODE')!=='resend')return response(503)
 if(Number(request.headers.get('content-length'))>65536)return response(413)
 try{
  const raw=await request.text();if(raw.length>65536)return response(413)
  const event=await verifyNoticeEvent(raw,request.headers,Deno.env.get('HUB_NOTICE_WEBHOOK_SECRET'))
  if(!event)return response(204)
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}})
  const result=await client.rpc('hub_notice_delivery',event)
  return response(result.error?503:204)
 }catch{return response(401)}
})
