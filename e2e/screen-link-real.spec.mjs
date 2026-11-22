import {test,expect,chromium} from '@playwright/test'
import {createClient} from '@supabase/supabase-js'
import {randomUUID,randomBytes} from 'node:crypto'
import fs from 'node:fs'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
import {recordTab} from './helpers/portal-ui.mjs'

test('Tela: cancelamento e navegador incompatível não iniciam sessão nem evento',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(90000);const f=await operationalFixture();await meeting(f)
 try{for(const supported of [true,false]){
  const context=await browser.newContext();try{await context.addInitScript(({session,supported})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));navigator.mediaDevices.getDisplayMedia=supported?()=>Promise.reject(new DOMException('Cancelamento fictício','NotAllowedError')):undefined},{session:f.owner.session,supported});const page=await context.newPage();await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Projetos e entregas',exact:true}).click();await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões');await page.getByRole('button',{name:'Preparar / registrar ata',exact:true}).click();const start=page.getByRole('button',{name:'Compartilhar tela por link',exact:true});if(supported){await start.click();await expect(page.getByRole('status').filter({hasText:'Seleção cancelada ou permissão recusada'})).toBeVisible();await expect(start).toBeEnabled()}else{await expect(start).toBeDisabled();await expect(page.getByText('Este navegador não permite iniciar captura aqui.',{exact:false})).toBeVisible()}}finally{await context.close()}
 }expect(await checked(f.owner.client.from('hub_registry_events').select('id').eq('workspace_id',f.workspace).like('action','Compartilhamento de tela%'))).toHaveLength(0)
 }finally{await f.cleanup()}
})

const rpc=async(client,name,args)=>{const r=await client.rpc(name,args);if(r.error)throw Error('RPC de tela recusou a operação de teste');return r.data}
async function meeting(f){const m=randomUUID();await checked(f.owner.client.rpc('hub_save_project_meeting',{w:f.workspace,p:f.proposal,m,expected_revision:null,operation_id:randomUUID(),follow:false,body:{date:f.today,state:'Agendada',participants:'Sócios fictícios',agenda:'PAUTA INTERNA RESERVADA',summary:'ATA INTERNA RESERVADA',decisions:'',owner:'Marina fictícia',next:'',due:'',callUrl:''}}));return m}
const secret=()=>randomBytes(32).toString('base64url')

test('Tela: fonte encerrada durante a gravação e HTTP pendente não deixam captura ativa',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(90000);const f=await operationalFixture();await meeting(f)
 try{for(const ended of [true,false]){
  const context=await browser.newContext();try{
   await context.addInitScript(({session,ended})=>{localStorage.setItem('sb-127-auth-token',JSON.stringify(session));navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const stream=canvas.captureStream(1);window.__fakeScreenTrack=stream.getVideoTracks()[0];if(ended)setTimeout(()=>window.__fakeScreenTrack.stop(),50);return stream}},{session:f.owner.session,ended})
   const page=await context.newPage();if(ended)await page.route('**/rpc/hub_screen_start',async route=>{const response=await route.fetch();await new Promise(r=>setTimeout(r,500));await route.fulfill({response})})
   await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Projetos e entregas',exact:true}).click();await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões');await page.getByRole('button',{name:'Preparar / registrar ata',exact:true}).click();await page.getByRole('button',{name:'Compartilhar tela por link',exact:true}).click()
   if(ended)await expect(page.getByRole('status').filter({hasText:'A fonte foi encerrada antes de iniciar'})).toBeVisible()
   else{
    await expect(page.getByRole('button',{name:'Copiar convite para assistir',exact:true})).toBeVisible()
    await page.route('**/rpc/hub_screen_host',async route=>{const body=route.request().postDataJSON();if(!body.action||body.action==='poll'){await new Promise(r=>setTimeout(r,20000));await route.abort().catch(()=>{})}else await route.continue()})
    await expect(page.getByRole('status').filter({hasText:'Sem confirmação de autorização por 15 segundos'})).toBeVisible({timeout:22000})
   }
   await expect(page.getByRole('button',{name:'Compartilhar tela por link',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.__fakeScreenTrack.readyState)).toBe('ended')
  }finally{await context.close()}
 }
 expect(sql(`select count(*) from hub_private.screen_sessions where workspace_id='${f.workspace}' and ended_at is null`)).toBe('0')
 }finally{await f.cleanup()}
})

test('Tela: autorização, aprovação, expiração, encerramento, auditoria atômica e membro desativado',async()=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(90000)
 const f=await operationalFixture(),anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}}),m=await meeting(f)
 try{
  const s=randomUUID(),credential=secret(),viewer=randomUUID(),args={w:f.workspace,m,s,credential}
  const relayDisabled=await anon.functions.invoke('hub-screen-ice',{body:{s}});expect(relayDisabled.error).toBeNull();expect(relayDisabled.data).toEqual({enabled:false})
  expect((await f.restricted.client.rpc('hub_screen_start',args)).error?.code).toBe('42501');expect((await f.owner.client.rpc('hub_screen_start',{...args,w:f.other})).error?.code).toBe('42501');expect((await anon.rpc('hub_screen_start',args)).error?.code).toBe('42501')
  await rpc(f.owner.client,'hub_screen_start',args);await rpc(f.owner.client,'hub_screen_start',args)
  expect((await f.second.client.rpc('hub_screen_host',{s})).error?.code).toBe('42501')
  expect((await rpc(anon,'hub_screen_watch',{s,credential:secret(),viewer,display_name:'Fictício'})).state).toBe('unavailable')
  expect((await rpc(anon,'hub_screen_watch',{s,credential,viewer,display_name:'Pessoa fictícia'})).state).toBe('pending')
  expect((await f.owner.client.rpc('hub_screen_host',{s,action:'offer',payload:{}})).error).toBeTruthy()
  const offer={type:'offer',sdp:'Negociação fictícia, nunca mídia'}
  await rpc(f.owner.client,'hub_screen_host',{s,action:'offer',payload:offer})
  expect((await rpc(anon,'hub_screen_watch',{s,credential,viewer})).offer).toBeNull()
  expect((await f.owner.client.rpc('hub_screen_host',{s,action:'ice',payload:{epoch:999,candidates:[]}})).error).toBeTruthy()
  expect((await anon.rpc('hub_screen_relay',{s,credential,viewer})).error).toBeTruthy()
  expect((await anon.rpc('hub_screen_relay',{s})).error).toBeTruthy()
  expect((await f.restricted.client.rpc('hub_screen_relay',{s})).error).toBeTruthy()
  expect((await f.second.client.rpc('hub_screen_relay',{s})).error).toBeTruthy()
  await rpc(f.owner.client,'hub_screen_host',{s,action:'approve',viewer})
  expect((await rpc(f.owner.client,'hub_screen_relay',{s})).ttl).toBeGreaterThan(0)
  expect((await anon.rpc('hub_screen_relay',{s,credential:secret(),viewer})).error).toBeTruthy()
  const emissions=await Promise.all([anon.rpc('hub_screen_relay',{s,credential,viewer}),anon.rpc('hub_screen_relay',{s,credential,viewer})]);expect(emissions.filter(r=>!r.error)).toHaveLength(1);expect(emissions.filter(r=>r.error)).toHaveLength(1)
  const approved=await rpc(anon,'hub_screen_watch',{s,credential,viewer});expect(Object.keys(approved).sort()).toEqual(['candidates','ends_at','epoch','offer','state']);expect(approved.offer.type).toBe('offer');const candidate={candidate:'candidate:1 1 udp 1 192.0.2.1 5000 typ host',sdpMid:'0',sdpMLineIndex:0,usernameFragment:'ficticio'};await rpc(f.owner.client,'hub_screen_host',{s,action:'ice',payload:{epoch:approved.epoch,candidates:[candidate,candidate]}});expect((await rpc(anon,'hub_screen_watch',{s,credential,viewer})).candidates).toHaveLength(1);expect((await f.owner.client.rpc('hub_screen_host',{s,action:'ice',payload:{epoch:approved.epoch,candidates:Array(41).fill(candidate)}})).error).toBeTruthy()
  expect((await rpc(anon,'hub_screen_watch',{s,credential,viewer:randomUUID(),display_name:'Outro'})).state).toBe('unavailable')
  const answer={type:'answer',sdp:'Resposta fictícia'};await rpc(anon,'hub_screen_watch',{s,credential,viewer,answer,offer_epoch:approved.epoch});expect((await rpc(f.owner.client,'hub_screen_host',{s})).viewers[0].answer.type).toBe('answer')
  await rpc(anon,'hub_screen_watch',{s,credential,viewer,candidates:[candidate,candidate],offer_epoch:approved.epoch});expect((await rpc(f.owner.client,'hub_screen_host',{s})).viewers[0].candidates).toHaveLength(1)
  expect((await anon.rpc('hub_screen_watch',{s,credential,viewer,answer,offer_epoch:999})).error).toBeTruthy()
  expect((await anon.from('hub_meetings').select('record')).error?.code).toBe('42501')
  expect(sql(`select (has_table_privilege('authenticated','hub_private.screen_sessions','select') or has_table_privilege('anon','hub_private.screen_requests','insert'))::text`)).toBe('false')
  sql(`create function public.test_screen_audit_failure() returns trigger language plpgsql as $$begin if new.workspace_id='${f.workspace}' and new.action='Compartilhamento de tela encerrado' then raise exception 'Falha fictícia';end if;return new;end$$;create trigger test_screen_audit_failure before insert on public.hub_registry_events for each row execute function public.test_screen_audit_failure();`)
  try{expect((await f.owner.client.rpc('hub_screen_host',{s,action:'stop'})).error).toBeTruthy();expect((await rpc(f.owner.client,'hub_screen_host',{s})).state).toBe('open')}finally{sql('drop trigger test_screen_audit_failure on public.hub_registry_events;drop function public.test_screen_audit_failure()')}
  await rpc(f.owner.client,'hub_screen_host',{s,action:'stop'});await rpc(f.owner.client,'hub_screen_host',{s,action:'stop'});expect((await rpc(anon,'hub_screen_watch',{s,credential,viewer})).state).toBe('unavailable')
  expect((await anon.rpc('hub_screen_relay',{s,credential,viewer})).error).toBeTruthy();expect((await f.owner.client.rpc('hub_screen_relay',{s})).error).toBeTruthy()
  expect((await anon.rpc('hub_screen_relay',{s,credential,viewer})).error).toBeTruthy()
  const events=await checked(f.owner.client.from('hub_registry_events').select('action,before_record,after_record').eq('workspace_id',f.workspace).like('action','Compartilhamento de tela%'));expect(events).toHaveLength(2);expect(events.every(e=>e.before_record===null&&e.after_record===null)).toBe(true)
  const expired=randomUUID(),expiredToken=secret();await rpc(f.owner.client,'hub_screen_start',{...args,s:expired,credential:expiredToken});sql(`update hub_private.screen_sessions set invite_until=clock_timestamp()-interval '1 second' where id='${expired}'`);expect((await rpc(anon,'hub_screen_watch',{s:expired,credential:expiredToken,viewer:randomUUID(),display_name:'Fictício'})).state).toBe('unavailable')
  sql(`update hub_private.screen_sessions set heartbeat=clock_timestamp()-interval '46 seconds' where id='${expired}'`);await rpc(f.owner.client,'hub_screen_start',{...args,s:randomUUID(),credential:secret()});const swept=await checked(f.owner.client.from('hub_registry_events').select('actor_id').eq('workspace_id',f.workspace).eq('action','Compartilhamento de tela encerrado automaticamente'));expect(swept).toHaveLength(1);expect(swept[0].actor_id).toBeNull()
  const deactivated=randomUUID(),token=secret();await rpc(f.second.client,'hub_screen_start',{...args,s:deactivated,credential:token});await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:0}));expect((await rpc(anon,'hub_screen_watch',{s:deactivated,credential:token,viewer:randomUUID(),display_name:'Fictício'})).state).toBe('unavailable');expect((await rpc(f.second.client,'hub_screen_host',{s:deactivated})).state).toBe('ended');const automatic=await checked(f.owner.client.from('hub_registry_events').select('actor_id').eq('workspace_id',f.workspace).eq('action','Compartilhamento de tela encerrado automaticamente'));expect(automatic).toHaveLength(2);expect(automatic.every(e=>e.actor_id===null)).toBe(true)
 }finally{await f.cleanup()}
})

test('Tela: captura nativa chega ao espectador isolado, recupera rede e encerra pelo navegador',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(150000)
 const f=await operationalFixture(),m=await meeting(f),host=await chromium.launch({channel:'chromium',args:['--auto-select-tab-capture-source-by-title=Decifaz fonte ficticia','--enable-usermedia-screen-capturing','--autoplay-policy=no-user-gesture-required']}),context=await host.newContext({permissions:['clipboard-read','clipboard-write']}),audience=await browser.newContext()
 try{
  const source=await context.newPage();await source.setContent('<title>Decifaz fonte ficticia</title><h1>TELA FICTÍCIA</h1><script>let n=0;setInterval(()=>{document.body.style.background=++n%2?"#3a4a6f":"#ff6a13"},300)</script>')
  const page=await context.newPage();await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Projetos e entregas',exact:true}).click();await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões');await page.getByRole('button',{name:'Preparar / registrar ata',exact:true}).click();await page.getByRole('button',{name:'Compartilhar tela por link',exact:true}).click();await expect(page.getByRole('button',{name:'Copiar convite para assistir',exact:true})).toBeVisible();await page.getByRole('button',{name:'Copiar convite para assistir',exact:true}).click()
  // Read only into memory. Neither URLs nor SDP are emitted as assertions or artifacts.
  const invitation=await page.evaluate(()=>navigator.clipboard.readText()),fragment=new URL(invitation).hash,sessionId=fragment.slice(1).split('.')[0]
  const view=await audience.newPage();await view.addInitScript(()=>{const descriptor=Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype,'onicecandidate');Object.defineProperty(RTCPeerConnection.prototype,'onicecandidate',{...descriptor,set(handler){descriptor.set.call(this,handler?event=>setTimeout(()=>handler.call(this,event),7000):handler)}});const native=RTCPeerConnection.prototype.setRemoteDescription;let first=true;RTCPeerConnection.prototype.setRemoteDescription=function(...args){if(first){first=false;return Promise.reject(new DOMException('Falha fictícia única de negociação','OperationError'))}return native.apply(this,args)}});await view.addInitScript(fragment=>{if(location.pathname==='/assistir')history.replaceState(null,'','/assistir'+fragment)},fragment);await view.goto('/assistir');expect(await view.evaluate(()=>location.hash===''&&location.search==='')).toBe(true);await view.getByLabel('Seu nome para o apresentador').fill('Espectador fictício');await view.getByRole('button',{name:'Solicitar entrada',exact:true}).click();await expect(page.getByText('Espectador fictício',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Permitir assistir',exact:true}).click()
  await expect(view.getByRole('status')).toContainText('Recebendo a tela compartilhada',{timeout:30000});await expect.poll(()=>view.locator('video').evaluate(v=>v.getVideoPlaybackQuality().totalVideoFrames),{timeout:15000}).toBeGreaterThan(5)
  expect(Number(sql(`select jsonb_array_length(host_ice) from hub_private.screen_sessions where id='${sessionId}'`))).toBeGreaterThan(0);await expect.poll(()=>Number(sql(`select max(jsonb_array_length(viewer_ice)) from hub_private.screen_requests where session_id='${sessionId}'`)),{timeout:12000}).toBeGreaterThan(0);expect(sql(`select (offer->>'sdp' not like '%a=candidate:%')::text from hub_private.screen_sessions where id='${sessionId}'`)).toBe('true');expect(await view.locator('nav').count()).toBe(0);await expect(view.locator('body')).not.toContainText('PAUTA INTERNA RESERVADA');await expect(view.locator('body')).not.toContainText('ATA INTERNA RESERVADA')
  await audience.setOffline(true);await expect(view.getByRole('status')).toContainText('Sem confirmação da rede',{timeout:6000});await audience.setOffline(false);await expect(view.getByRole('status')).toContainText('Recebendo a tela compartilhada',{timeout:10000})
  fs.mkdirSync('.validation/screen-captures',{recursive:true});await view.screenshot({path:'.validation/screen-captures/espectador-desktop.png',fullPage:true});await view.setViewportSize({width:390,height:844});await view.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await view.evaluate(()=>document.documentElement.dataset.theme)).toBe('dark');expect(await view.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await view.screenshot({path:'.validation/screen-captures/espectador-celular.png',fullPage:true})
  await source.close();await expect(page.getByRole('button',{name:'Compartilhar tela por link',exact:true})).toBeVisible({timeout:10000});await expect(view.getByRole('status')).toContainText('Sessão encerrada',{timeout:10000})
  const parts=fragment.slice(1).split('.'),anon=createClient(process.env.VITE_SUPABASE_URL,process.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});expect((await rpc(anon,'hub_screen_watch',{s:parts[0],credential:parts[1],viewer:randomUUID(),display_name:'Reuso fictício'})).state).toBe('unavailable')
  fs.writeFileSync('.validation/screen-captures/result.json',JSON.stringify({nativeCapture:true,separateBrowserProcesses:true,receivedFrames:true,networkRecovery:true,browserEnded:true,credentialsScrubbed:true,sameComputer:true,crossNetwork:false,audio:'não comprovado'},null,2))
 }finally{await audience.close();await context.close();await host.close();await f.cleanup()}
})
