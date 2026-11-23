import {createClient} from 'npm:@supabase/supabase-js@2.119.0'
import {processNotices,sameSecret,workerConfig} from '../_shared/notice-worker.mjs'

Deno.serve(async request=>{
 const response=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}})
 if(request.method!=='POST')return response({error:'Método inválido'},405)
 if(!sameSecret(request.headers.get('x-hub-worker-secret'),Deno.env.get('HUB_NOTICE_WORKER_SECRET')))return response({error:'Acesso negado'},401)
 try{
  const config=workerConfig(Deno.env.toObject())
  if(config.mode==='off')return response({state:'disabled'})
  const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}})
  return response(await processNotices(client,config))
 }catch{return response({error:'Processamento indisponível; consulte o monitor administrativo'},503)}
})
