// Local controller for a fictitious gateway only. Configuration arrives on stdin;
// never place the password/capability in arguments, files, logs or screenshots.
import {chromium,expect} from '@playwright/test'
import {installScreenDiagnostics} from '../e2e/helpers/screen-diagnostics.mjs'
import {recordTab} from '../e2e/helpers/portal-ui.mjs'
import {sql} from '../e2e/helpers/local-db.mjs'
import fs from 'node:fs'
let input='';for await(const chunk of process.stdin)input+=chunk
const {origin,password,expectedSha}=JSON.parse(input);input=''
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin)||password.length<20)throw Error('Gateway isolado obrigatório')
const browser=await chromium.launch({channel:'chromium',args:['--auto-select-tab-capture-source-by-title=Decifaz fonte externa ficticia','--enable-usermedia-screen-capturing','--autoplay-policy=no-user-gesture-required']}),context=await browser.newContext({permissions:['clipboard-read','clipboard-write']})
let page,source,sessions=[],workspace
async function progress(){return (await(await context.request.get(origin+'/__review/screen-progress')).json()).phase}
async function setPhase(phase){await context.request.post(origin+'/__review/screen-progress',{data:{phase}})}
async function wait(phase){await expect.poll(progress,{timeout:180000,intervals:[1000]}).toBe(phase)}
async function begin(){
 source=await context.newPage();await source.setContent('<title>Decifaz fonte externa ficticia</title><body style="margin:0;min-height:100vh;color:white;font:24px sans-serif"><h1>HOMOLOGAÇÃO · FONTE FICTÍCIA</h1><script>let n=0;setInterval(()=>document.body.style.background=++n%2?"#3a4a6f":"#ff6a13",300)</script>')
 await page.getByRole('button',{name:'Compartilhar tela por link',exact:true}).click();await page.getByRole('button',{name:'Copiar convite para assistir',exact:true}).click()
 const text=await page.evaluate(()=>navigator.clipboard.readText()),parts=new URL(text).hash.slice(1).split('.')
 if(!/^[0-9a-f-]{36}$/.test(parts[0]))throw Error('Identificador fictício inválido')
 // Bind all deadline edits to this local, synthetic workspace.
 if(sql(`select count(*) from hub_private.screen_sessions where id='${parts[0]}' and workspace_id='${workspace}'`)!=='1')throw Error('Sessão fora da fixture')
 sessions.push(parts[0]);await context.request.post(origin+'/__review/screen-probe',{data:{id:parts[0],credential:parts[1]}})
 await expect(page.getByRole('button',{name:'Permitir assistir',exact:true})).toBeVisible({timeout:600000});await page.getByRole('button',{name:'Permitir assistir',exact:true}).click()
 await expect(page.getByRole('status').filter({hasText:'Transmitindo para o espectador aprovado.'})).toBeVisible({timeout:100000})
}
try{
 page=await context.newPage();await page.addInitScript(installScreenDiagnostics);await page.addInitScript(()=>{const capture=navigator.mediaDevices.getDisplayMedia;navigator.mediaDevices.getDisplayMedia=async(...args)=>{const stream=await capture.apply(navigator.mediaDevices,args);window.__proofCapture=()=>({liveTracks:stream.getTracks().filter(t=>t.readyState==='live').length,audioTracks:stream.getAudioTracks().length});return stream}});await page.goto(origin)
 await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click()
 const health=await(await context.request.get(origin+'/__health')).json();if(health.candidate!==expectedSha||!health.isolated)throw Error('Candidato/ambiente divergente')
 workspace=(await(await context.request.get(origin+'/__review/fixtures')).json()).workspace;if(!/^[0-9a-f-]{36}$/.test(workspace))throw Error('Fixture inválida')
 await setPhase('waiting');await page.goto(origin+'/__review/persona/admin');await page.getByRole('navigation').getByRole('button',{name:'Projetos e entregas',exact:true}).click();await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await recordTab(page,'Reuniões');await page.getByRole('button',{name:'Preparar / registrar ata',exact:true}).first().click()
 await begin();console.log('Primeira sessão: apresentador nativo conectado.')
 await wait('expire-invite');sql(`update hub_private.screen_sessions set invite_until=clock_timestamp()-interval '1 second' where id='${sessions[0]}' and workspace_id='${workspace}'`);await expect(page.getByRole('button',{name:'Copiar convite para assistir',exact:true})).toBeDisabled();await setPhase('invite-expired')
 await wait('stop');await source.close();await expect(page.getByRole('button',{name:'Compartilhar tela por link',exact:true})).toBeVisible();await setPhase('ended')
 await wait('second');await begin();console.log('Segunda sessão: nova captura nativa conectada.')
 await wait('expire-session');sql(`update hub_private.screen_sessions set ends_at=clock_timestamp()-interval '1 second' where id='${sessions[1]}' and workspace_id='${workspace}'`)
 await expect(page.getByRole('button',{name:'Compartilhar tela por link',exact:true})).toBeVisible({timeout:10000});expect((await page.evaluate(()=>window.__proofCapture())).liveTracks).toBe(0);await setPhase('session-expired');await wait('done')
 const diagnostics=await page.evaluate(()=>window.__screenSafeDiagnostics?.()??[]);fs.mkdirSync('.validation/screen-presenter',{recursive:true});fs.writeFileSync('.validation/screen-presenter/result.json',JSON.stringify({candidate:expectedSha,nativeCapture:true,secondAttempt:true,browserEnd:true,controlledDeadlines:true,diagnostics},null,2));console.log('Captura nativa, encerramento e nova tentativa aprovados; prazos induzidos somente na fixture local.')
}catch{
 const diagnostics=await page?.evaluate(()=>window.__screenSafeDiagnostics?.()??[]).catch(()=>[]);fs.mkdirSync('.validation/screen-presenter',{recursive:true});fs.writeFileSync('.validation/screen-presenter/diagnostic.json',JSON.stringify(diagnostics,null,2));console.log(JSON.stringify({diagnostics}));await setPhase('failed').catch(()=>{});process.exitCode=1
}finally{await context.request.delete(origin+'/__review/screen-probe').catch(()=>{});await context.close();await browser.close()}
