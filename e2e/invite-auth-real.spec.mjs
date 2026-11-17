import {test,expect} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID} from 'node:crypto'
import {spawnSync} from 'node:child_process'

test('Auth: retorno canônico conserva convite; cadastro direto verificado não concede espaço',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Auth, banco e Mailpit locais.')
 test.setTimeout(90000)
 const endpoint='http://127.0.0.1:54321',origin='http://127.0.0.1:4181',canonical='https://decifaz-hub.vercel.app'
 const isolated='http://127.0.0.1:54329',mailbox='http://127.0.0.1:54324'
 if(process.env.VITE_SUPABASE_URL!==endpoint)throw Error('Local only')
 const settings={auth:{persistSession:false,autoRefreshToken:false}},key=process.env.VITE_SUPABASE_PUBLISHABLE_KEY
 const service=createClient(endpoint,process.env.HUB_TEST_ADMIN_KEY,settings)
 const checked=async op=>{const {data,error}=await op;if(error)throw Error('Local fixture operation failed');return data}
 const docker=(args,options={})=>spawnSync('docker',args,{encoding:'utf8',...options})
 const inspected=docker(['inspect','supabase_auth_decifaz-hub-e2e'])
 if(inspected.status!==0)throw Error('Local Auth unavailable')
 const source=JSON.parse(inspected.stdout)[0]
 const network=Object.keys(source.NetworkSettings.Networks).find(n=>n==='supabase_network_decifaz-hub-e2e')
 if(!network)throw Error('Local network unavailable')
 const name='hub-auth-canonical-'+randomUUID(),ids=[],contexts=[]
 // Clone only local Auth; credentials stay in process environment, never in command arguments or artifacts.
 const env=Object.fromEntries(source.Config.Env.filter(line=>/^(GOTRUE_|API_EXTERNAL_URL=)/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)]}))
 Object.assign(env,{GOTRUE_SITE_URL:canonical+'/',GOTRUE_URI_ALLOW_LIST:canonical+'/',API_EXTERNAL_URL:isolated,
  GOTRUE_MAILER_URLPATHS_CONFIRMATION:'/verify',GOTRUE_MAILER_URLPATHS_RECOVERY:'/verify',
  GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_MAILER_OTP_LENGTH:'8',GOTRUE_MAILER_OTP_EXP:'3600',GOTRUE_SMTP_MAX_FREQUENCY:'1m'})
 try{
  // Node's spawn env passes local values to docker; --env NAME copies them without exposing values in argv.
  const args=['run','--detach','--name',name,'--network',network,'-p','127.0.0.1:54329:9999']
  for(const k of Object.keys(env))args.push('--env',k)
  args.push(source.Config.Image)
  const start=docker(args,{env:{...process.env,...env}})
  if(start.status!==0){
   let diagnostic=String(start.error?.code??start.stderr??'')
   for(const value of Object.values(env).filter(v=>v.length>3).sort((a,b)=>b.length-a.length))diagnostic=diagnostic.split(value).join('[local value]')
   throw Error('Isolated local Auth failed to start: '+diagnostic.slice(0,500))
  }
  await expect.poll(async()=>{try{return (await fetch(isolated+'/health')).ok}catch{return false}},{timeout:20000}).toBe(true)
  const ownerEmail=randomUUID()+'@example.invalid',password=randomUUID(),w=randomUUID()
  const {user}=await checked(service.auth.admin.createUser({email:ownerEmail,password,email_confirm:true}));ids.push(user.id)
  const owner=createClient(endpoint,key,settings)
  await checked(owner.auth.signInWithPassword({email:ownerEmail,password}))
  await checked(service.from('hub_workspaces').insert({id:w,name:'Homologação Auth fictícia'}))
  await checked(service.from('hub_members').insert({workspace_id:w,user_id:user.id,role:'admin'}))
  const authRequest=async(email,redirect)=>{
   const r=await fetch(isolated+'/signup?redirect_to='+encodeURIComponent(redirect),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:randomUUID()})})
   expect(r.ok).toBe(true)
   const data=await r.json(),id=data.id??data.user?.id
   if(!id)throw Error('Local signup missing user');ids.push(id)
   expect(Boolean(data.access_token)).toBe(false)
   expect(Boolean((await checked(service.auth.admin.getUserById(id))).user.email_confirmed_at)).toBe(false)
   const throttled=await fetch(isolated+'/otp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true})})
   expect(throttled.status).toBe(429)
   let messageId
   await expect.poll(async()=>{
    const {messages}=await(await fetch(mailbox+'/api/v1/messages')).json()
    messageId=messages?.find(m=>m.To?.some(to=>to.Address===email))?.ID
    return Boolean(messageId)
   },{timeout:15000}).toBe(true)
   const {HTML}=await(await fetch(mailbox+'/api/v1/message/'+encodeURIComponent(messageId))).json()
   const context=await browser.newContext();contexts.push(context)
   const page=await context.newPage()
   // No request to the real canonical domain: every asset/document is fulfilled from the local Vite server.
   await context.route(canonical+'/**',async route=>{
    const url=new URL(route.request().url())
    const response=await route.fetch({url:origin+url.pathname+url.search})
    await route.fulfill({response})
   })
   // HTTPS canonical page uses a loopback backend in this harness; proxy it through Node to avoid public-to-private browser network policy.
   await context.route(endpoint+'/**',async route=>route.fulfill({response:await route.fetch()}))
   const href=await page.evaluate(html=>{const doc=new DOMParser().parseFromString(html,'text/html');return [...doc.querySelectorAll('a[href]')].find(a=>a.href.includes('/verify?'))?.href},HTML)
   if(!href||new URL(href).origin!==isolated)throw Error('Unexpected local verification destination')
   expect(new URL(href).searchParams.get('redirect_to')===redirect).toBe(true)
   const verified=await fetch(href,{redirect:'manual'})
   expect(verified.status).toBe(303)
   const returned=new URL(verified.headers.get('location'))
   expect(returned.origin===canonical).toBe(true)
   expect(returned.search===new URL(redirect).search).toBe(true)
   expect(returned.hash.includes('access_token=')).toBe(true)
   const token=new URLSearchParams(returned.hash.slice(1)).get('access_token')
   expect(Boolean((await checked(service.auth.admin.getUserById(id))).user.email_confirmed_at)).toBe(true)
   const edge=await fetch(endpoint+'/functions/v1/hub-workspaces',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}'})
   expect(edge.status).toBe(403)
   expect(await checked(service.from('hub_members').select('workspace_id').eq('user_id',id))).toHaveLength(0)
   const client=createClient(endpoint,key,settings)
   await checked(client.auth.setSession({access_token:token,refresh_token:new URLSearchParams(returned.hash.slice(1)).get('refresh_token')}))
   expect(await checked(client.from('hub_workspaces').select('id'))).toHaveLength(0)
   await page.goto(returned.href)
   await expect(page.getByRole('heading',{name:'Meus convites',exact:true})).toBeVisible({timeout:15000})
   await expect(page.getByRole('button',{name:'Captação e CRM',exact:true})).toHaveCount(0)
   return {id,page,client}
  }
  const recipient=randomUUID()+'@example.com'
  const invitation=await checked(owner.rpc('hub_create_invite',{w,e:recipient,r:['operations']}))
  const invited=await authRequest(recipient,canonical+'/?convite='+invitation.id)
  expect(new URL(invited.page.url()).searchParams.get('convite')===invitation.id).toBe(true)
  expect(await checked(service.from('hub_members').select('workspace_id').eq('user_id',invited.id))).toHaveLength(0)
  await invited.page.getByRole('button',{name:'Aceitar convite',exact:true}).click()
  await expect(invited.page.getByRole('article',{name:'Convite de Homologação Auth fictícia'})).toContainText('Aceito')
  await expect(invited.page.getByRole('paragraph').filter({hasText:/^Homologação Auth fictícia$/})).toBeVisible()
  expect(await checked(service.from('hub_members').select('workspace_id').eq('user_id',invited.id))).toHaveLength(1)
  const direct=await authRequest(randomUUID()+'@example.com',canonical+'/')
  await expect(direct.page.getByText('Nenhum convite para este e-mail.',{exact:true})).toBeVisible()
  expect(await checked(direct.client.rpc('hub_my_invites'))).toHaveLength(0)
  expect(await checked(direct.client.rpc('hub_can',{w,module:'operations'}))).toBe(false)
  expect(await checked(owner.from('hub_role_audit').select('id').eq('member_id',direct.id))).toHaveLength(0)
 }finally{
  for(const context of contexts)await context.close().catch(()=>{})
  docker(['rm','--force',name])
  for(const id of ids)await service.auth.admin.deleteUser(id)
 }
})
