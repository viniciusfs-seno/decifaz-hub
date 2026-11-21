import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Prévia isolada protegida obrigatória')
const browser=await chromium.launch(),context=await browser.newContext()
try{
 const health=await context.request.get(origin+'/__health');expect(health.status()).toBe(200);expect((await health.json()).candidate).toBe(process.env.HUB_HML_EXPECTED_SHA)
 const page=await context.newPage();const rpcResponses=[];page.on('response',r=>{if(new URL(r.url()).pathname.endsWith('/rpc/hub_screen_watch'))rpcResponses.push(r.status())});globalThis.screenResponseCounts=rpcResponses;await page.addInitScript(()=>{const Native=window.RTCPeerConnection;window.RTCPeerConnection=class extends Native{constructor(...args){super(...args);window.__screenProofPeer=this}async setRemoteDescription(...args){try{return await super.setRemoteDescription(...args)}catch(e){window.__screenProofFailure={phase:'remote-description',name:e.name};throw e}}async setLocalDescription(...args){try{return await super.setLocalDescription(...args)}catch(e){window.__screenProofFailure={phase:'local-description',name:e.name};throw e}}}});await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click()
 let invite;await expect.poll(async()=>{const r=await context.request.get(origin+'/__review/screen-probe');if(r.status()===200){invite=await r.json();return true}return false},{timeout:120000,intervals:[2000]}).toBe(true)
 await page.addInitScript(invite=>{if(location.pathname==='/assistir')history.replaceState(null,'','/assistir#'+invite.id+'.'+invite.credential)},invite)
 await page.goto(origin+'/assistir');await page.getByLabel('Seu nome para o apresentador').fill('Participante remoto fictício');await page.getByRole('button',{name:'Solicitar entrada',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Recebendo a tela compartilhada',{timeout:90000})
 await expect.poll(()=>page.locator('video').evaluate(v=>v.getVideoPlaybackQuality().totalVideoFrames),{timeout:15000}).toBeGreaterThan(5)
 fs.mkdirSync('.validation/screen-external',{recursive:true});await page.screenshot({path:'.validation/screen-external/recepcao.png',fullPage:true})
 fs.writeFileSync('.validation/screen-external/result.json',JSON.stringify({candidate:process.env.HUB_HML_EXPECTED_SHA,externalRunner:true,crossNetwork:true,receivedFrames:true,audio:'não comprovado'},null,2))
 console.log('Tela recebida em navegador remoto; frames decodificados. Convite e dados de rede omitidos.')
 await expect(page.getByRole('status')).toContainText('Sessão encerrada',{timeout:90000})
}catch{
 const page=context.pages().at(-1)
 if(page){const safe=await page.evaluate(async()=>{const p=window.__screenProofPeer,stats=p?[...(await p.getStats()).values()]:[];return {state:document.querySelector('[role="status"]')?.textContent,connection:p?.connectionState,signaling:p?.signalingState,ice:p?.iceConnectionState,gathering:p?.iceGatheringState,localCandidateTypes:[...new Set(stats.filter(s=>s.type==='local-candidate').map(s=>s.candidateType))],remoteCandidateTypes:[...new Set(stats.filter(s=>s.type==='remote-candidate').map(s=>s.candidateType))],failure:window.__screenProofFailure}}).catch(()=>({diagnostic:'indisponível'}));console.log(JSON.stringify({...safe,rpcStatuses:[...new Set(globalThis.screenResponseCounts??[])]}))}
 throw Error('Recepção externa não comprovada. Conferir sinalização e conectividade STUN; não publicar transmissão sem homologação. Credenciais omitidas.')
}finally{await context.close();await browser.close()}
