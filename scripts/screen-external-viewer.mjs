import {installScreenDiagnostics} from '../e2e/helpers/screen-diagnostics.mjs'
import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD,sha=process.env.HUB_HML_EXPECTED_SHA,relay=process.env.HUB_SCREEN_FORCE_RELAY==='true'
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Prévia isolada protegida obrigatória')
const browser=await chromium.launch(),context=await browser.newContext(),pages=[],rpcStatuses=new Set()
const folder='.validation/screen-external';fs.mkdirSync(folder,{recursive:true})
let fixture,firstInvite,lastPhase='authorization'
async function phase(value){await context.request.post(origin+'/__review/screen-progress',{data:{phase:value}})}
async function waitPhase(value){await expect.poll(async()=>(await(await context.request.get(origin+'/__review/screen-progress')).json()).phase,{timeout:30000,intervals:[1000]}).toBe(value)}
async function invitation(previous){let value;await expect.poll(async()=>{const r=await context.request.get(origin+'/__review/screen-probe');if(r.status()!==200)return false;value=await r.json();return !previous||value.id!==previous.id},{timeout:120000,intervals:[1000]}).toBe(true);return value}
async function watch(invite){const page=await context.newPage();pages.push(page);page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('/rpc/hub_screen_watch'))rpcStatuses.add(r.status())});await page.addInitScript(installScreenDiagnostics,{relay});await page.addInitScript(invite=>{if(location.pathname==='/assistir')history.replaceState(null,'','/assistir#'+invite.id+'.'+invite.credential)},invite);await page.goto(origin+'/assistir');expect(await page.evaluate(()=>location.hash===''&&location.search==='')).toBe(true);await page.getByLabel('Seu nome para o apresentador').fill('Participante remoto fictício');await page.getByRole('button',{name:'Solicitar entrada',exact:true}).click();return page}
async function advancing(page){
 await expect(page.getByRole('status')).toContainText('Recebendo a tela compartilhada',{timeout:90000})
 const first=await page.evaluate(()=>window.__screenDecodedFrames());await expect.poll(()=>page.evaluate(()=>window.__screenDecodedFrames()),{timeout:15000}).toBeGreaterThan(first+5)
 if(relay)await expect.poll(()=>page.evaluate(()=>window.__screenSelectedRelay()),{timeout:10000}).toBe(true)
 const pixel=()=>page.locator('video').evaluate(v=>{const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d');g.drawImage(v,v.videoWidth/2,v.videoHeight/2,1,1,0,0,1,1);return [...g.getImageData(0,0,1,1).data].slice(0,3)})
 const initial=await pixel();await expect.poll(async()=>(await pixel()).some((n,i)=>Math.abs(n-initial[i])>30),{timeout:5000}).toBe(true)
}
async function rejected(invite){const r=await context.request.post(origin+'/__supabase/rest/v1/rpc/hub_screen_watch',{headers:{apikey:fixture.publicKey},data:{s:invite.id,credential:invite.credential,viewer:crypto.randomUUID(),display_name:'Nova tentativa fictícia'}});expect(r.status()).toBe(200);expect((await r.json()).state).toBe('unavailable')}
try{
 const health=await context.request.get(origin+'/__health');expect(health.status()).toBe(200);expect((await health.json()).candidate).toBe(sha)
 const login=await context.newPage();await login.goto(origin);await login.getByLabel('Senha de revisão').fill(password);await login.getByRole('button',{name:'Entrar na homologação',exact:true}).click();fixture=await(await context.request.get(origin+'/__review/fixtures')).json();await login.close()
 firstInvite=await invitation();lastPhase='first-negotiation';const page=await watch(firstInvite);await advancing(page);await phase('frames')
 expect(await page.locator('nav').count()).toBe(0);expect(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.includes('auth-token')))).toBe(false)
 // Deliberate transport shutdown, not a claim of physical-router disconnection.
 lastPhase='controlled-peer-loss';await phase('disconnect');const generation=await page.evaluate(()=>window.__screenSafeDiagnostics().at(-1).generation);await page.evaluate(()=>window.__screenControlledDisconnect())
 await expect.poll(()=>page.evaluate(()=>window.__screenSafeDiagnostics().at(-1).generation),{timeout:90000}).toBeGreaterThan(generation);await advancing(page);await phase('recovered')
 lastPhase='invitation-expiry';await phase('expire-invite');await waitPhase('invite-expired');await rejected(firstInvite);await advancing(page)
 await page.screenshot({path:folder+'/recepcao.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:folder+'/recepcao-celular.png',fullPage:true})
 lastPhase='browser-end';await phase('stop');await expect(page.getByRole('status')).toContainText('Sessão encerrada',{timeout:15000});await waitPhase('ended');await rejected(firstInvite)
 lastPhase='new-session';await phase('second');const secondInvite=await invitation(firstInvite),second=await watch(secondInvite);await advancing(second);await phase('second-frames')
 lastPhase='session-expiry';await phase('expire-session');await expect(second.getByRole('status')).toContainText('Sessão encerrada',{timeout:15000});await waitPhase('session-expired');await rejected(secondInvite);await phase('done')
 const diagnostics=await Promise.all(pages.map(p=>p.evaluate(()=>window.__screenSafeDiagnostics())))
 const result={candidate:sha,externalRunner:true,crossNetwork:true,nativeVideoSource:true,relayForced:relay,relaySelected:relay,advancingDecodedFrames:true,changingPixels:true,controlledPeerLossRecovered:true,controlledInviteExpiry:true,browserEnd:true,reuseDenied:true,newSession:true,controlledSessionExpiry:true,audio:'não homologado',diagnostics}
 fs.writeFileSync(folder+'/result.json',JSON.stringify(result,null,2));if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,'verified=true\n');console.log('PASS: vídeo nativo entre redes, frames avançando, perda controlada, encerramento, prazos controlados e nova sessão.')
}catch{
 const diagnostics=await Promise.all(pages.map(p=>p.evaluate(()=>window.__screenSafeDiagnostics?.()??[]).catch(()=>[])));const safe={candidate:sha,phase:lastPhase,rpcStatuses:[...rpcStatuses],diagnostics};fs.writeFileSync(folder+'/diagnostic.json',JSON.stringify(safe,null,2));console.log(JSON.stringify(safe));await phase('failed').catch(()=>{});throw Error('Homologação de mídia não concluída; bloqueio preservado, dados privados omitidos.')
}finally{await context.close();await browser.close()}
