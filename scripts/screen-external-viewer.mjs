import {chromium,expect} from '@playwright/test'
import fs from 'node:fs'
const origin=process.env.HUB_HML_PREVIEW_URL,password=process.env.HUB_HML_REVIEW_PASSWORD
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin??'')||!password)throw Error('Prévia isolada protegida obrigatória')
const browser=await chromium.launch(),context=await browser.newContext()
try{
 const page=await context.newPage();await page.goto(origin);await page.getByLabel('Senha de revisão').fill(password);await page.getByRole('button',{name:'Entrar na homologação',exact:true}).click()
 let invite;await expect.poll(async()=>{const r=await context.request.get(origin+'/__review/screen-probe');if(r.status()===200){invite=await r.json();return true}return false},{timeout:120000,intervals:[2000]}).toBe(true)
 await page.addInitScript(invite=>{if(location.pathname==='/assistir')history.replaceState(null,'','/assistir#'+invite.id+'.'+invite.credential)},invite)
 await page.goto(origin+'/assistir');await page.getByLabel('Seu nome para o apresentador').fill('Participante remoto fictício');await page.getByRole('button',{name:'Solicitar entrada',exact:true}).click()
 await expect(page.getByRole('status')).toContainText('Recebendo a tela compartilhada',{timeout:90000})
 await expect.poll(()=>page.locator('video').evaluate(v=>v.getVideoPlaybackQuality().totalVideoFrames),{timeout:15000}).toBeGreaterThan(5)
 fs.mkdirSync('.validation/screen-external',{recursive:true});await page.screenshot({path:'.validation/screen-external/recepcao.png',fullPage:true})
 fs.writeFileSync('.validation/screen-external/result.json',JSON.stringify({candidate:process.env.HUB_HML_EXPECTED_SHA,externalRunner:true,crossNetwork:true,receivedFrames:true,audio:'não comprovado'},null,2))
 console.log('Tela recebida em navegador remoto; frames decodificados. Convite e dados de rede omitidos.')
 await expect(page.getByRole('status')).toContainText('Sessão encerrada',{timeout:90000})
}catch{throw Error('Recepção externa não comprovada. Conferir sinalização e conectividade STUN; não publicar transmissão sem homologação. Credenciais omitidas.')}finally{await context.close();await browser.close()}
