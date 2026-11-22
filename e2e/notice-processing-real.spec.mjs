import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
import fs from 'node:fs'
test('Monitor: acesso administrativo, leitura de falhas e confirmação de reprocessamento',async({page,browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1');test.setTimeout(90000)
 const f=await operationalFixture();await registryFixture(f)
 try{
  await checked(f.owner.client.rpc('hub_notice_prefs',{w:f.workspace,body:{internal_enabled:true,email_enabled:true,lead_days:[30,7,1,0],daily_digest:false,digest_hour:9,watch_scope:'space'},expected_revision:0}))
  sql(`select hub_private.generate_notices('${f.workspace}',clock_timestamp());update hub_private.notice_outbox set state='uncertain',error_code='network_unknown',total_attempts=1,attempts=1 where workspace_id='${f.workspace}'`)
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/?central=1')
  await page.getByRole('tab',{name:'Processamento',exact:true}).click();await expect(page.getByRole('heading',{name:'Processamento de avisos',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Revisar reprocessamento',exact:true}).first().click()
  const dialog=page.getByRole('dialog');await expect(dialog.getByRole('button',{name:'Autorizar nova tentativa',exact:true})).toBeDisabled()
  await dialog.getByLabel('Motivo da nova tentativa').fill('Revisado no Mailpit fictício');await dialog.getByLabel('Revisei o provedor e aceito o risco de mensagem duplicada',{exact:true}).check();await dialog.getByRole('button',{name:'Autorizar nova tentativa',exact:true}).click();await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status').filter({hasText:'Reprocessamento autorizado'})).toBeVisible()
  fs.mkdirSync('.validation/dues-captures',{recursive:true});await page.screenshot({path:'.validation/dues-captures/processamento-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'.validation/dues-captures/processamento-celular.png',fullPage:true})
  const restricted=await browser.newContext();try{const p=await restricted.newPage();await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.restricted.session);await p.goto('/?central=1');await expect(p.getByRole('tab',{name:'Preferências',exact:true})).toBeVisible();await expect(p.getByRole('tab',{name:'Processamento',exact:true})).toHaveCount(0)}finally{await restricted.close()}
 }finally{sql(`delete from hub_private.notice_outbox where workspace_id='${f.workspace}';delete from hub_private.notice_runs where workspace_id='${f.workspace}';delete from public.hub_notices where workspace_id='${f.workspace}';delete from public.hub_notice_preferences where workspace_id='${f.workspace}';`);await f.cleanup()}
})
