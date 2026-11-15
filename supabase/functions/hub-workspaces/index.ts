import {createClient} from 'npm:@supabase/supabase-js@2.119.0'

const headers = {
 'Access-Control-Allow-Origin': '*',
 'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
 'Access-Control-Allow-Methods': 'POST, OPTIONS',
 'Cache-Control': 'no-store',
}

Deno.serve(async request => {
 if (request.method === 'OPTIONS') return new Response(null, {headers})
 const json = (body: unknown, status = 200) => Response.json(body, {headers, status})
 if (request.method !== 'POST') return json({error:'Método inválido.'}, 405)

 const authorization = request.headers.get('Authorization')
 if (!authorization?.startsWith('Bearer ')) return json({error:'Sessão necessária.'}, 401)
 const key = request.headers.get('apikey')
 if (!key?.startsWith('sb_publishable_')) return json({error:'Chave publicável necessária.'}, 401)
 const client = createClient(Deno.env.get('SUPABASE_URL')!, key, {
  global:{headers:{Authorization:authorization}},
  auth:{persistSession:false,autoRefreshToken:false},
 })
 const {data:claims,error:authError} = await client.auth.getClaims(authorization.slice(7))
 if (authError || !claims?.claims.sub) return json({error:'Sessão inválida.'}, 401)

 const {data,error} = await client.from('hub_workspaces').select('id,name').order('name')
 if (error) return json({error:'Não foi possível consultar o espaço de trabalho.'}, 500)
 if (!data.length) return json({error:'Conta sem acesso a um espaço de trabalho.'}, 403)
 const {data:members,error:roleError}=await client.from('hub_members').select('workspace_id,role,extra_roles').eq('user_id',claims.claims.sub)
 if(roleError)return json({error:'Não foi possível consultar as permissões.'},500)
 const workspaces=data.flatMap(space=>{
  const member=members?.find(item=>item.workspace_id===space.id)
  return member?[{...space,role:member.role,roles:[member.role,...member.extra_roles]}]:[]
 })
 if(!workspaces.length)return json({error:'Conta sem acesso a um espaço de trabalho.'},403)
 return json({workspaces})
})
