import {spawnSync} from 'node:child_process'
import {mkdir} from 'node:fs/promises'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import {commercialFixture} from './commercial-preview-fixture.mjs'
const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell:process.platform==='win32'})
if(status.status!==0)throw Error('Inicie a pilha local')
const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
if(values.API_URL!=='http://127.0.0.1:54321')throw Error('Somente pilha local')
const env={VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const f=await commercialFixture(env),server=await createServer({server:{host:'127.0.0.1',port:4192,strictPort:true}}),browser=await chromium.launch()
await mkdir('docs/comercial-gerencial/capturas',{recursive:true});await server.listen()
try{
 for(const [device,width,height] of [['desktop',1440,1000],['celular',390,844]]){
  const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Fortaleza'}),page=await context.newPage()
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session)
  await page.goto('http://127.0.0.1:4192');await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'})
  const nav=async name=>{const toggle=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
  await page.getByRole('heading',{name:'Fila de ações'}).waitFor();await nav('Catálogo de soluções');await page.getByRole('heading',{name:'Cardápio digital',exact:true}).waitFor();await page.screenshot({path:`docs/comercial-gerencial/capturas/catalogo-${device}.png`,fullPage:true})
  await nav('Indicadores');await page.getByRole('button',{name:/Receita prevista/}).waitFor();await page.screenshot({path:`docs/comercial-gerencial/capturas/indicadores-${device}.png`,fullPage:true})
  await nav('Revisão semanal');await page.getByText('Nenhuma semana fechada neste espaço').waitFor({state:'hidden'});await page.getByRole('heading',{name:'Histórico de fechamentos',exact:true}).waitFor();await page.getByText('Semana fictícia: oportunidade qualificada e implantação em andamento.',{exact:true}).waitFor({state:'attached'});await page.screenshot({path:`docs/comercial-gerencial/capturas/fechamento-${device}.png`,fullPage:true})
  await nav('Captação e CRM');await page.getByRole('button',{name:'Mercado Sol · fictício',exact:true}).click();await page.getByRole('button',{name:'Editar reunião',exact:true}).click()
  await page.getByRole('dialog').getByLabel('Pauta da reunião').waitFor();await page.screenshot({path:`docs/comercial-gerencial/capturas/reuniao-${device}.png`,fullPage:true})
  const studio=page.getByRole('dialog').locator('.client-presentation');await studio.getByLabel('Cardápio digital',{exact:true}).check();await studio.getByLabel('Automações',{exact:true}).check()
  const pop=context.waitForEvent('page');await studio.getByRole('button',{name:'Abrir visão do cliente'}).click();const client=await pop;await client.getByRole('heading',{name:'Cardápio digital',exact:true}).waitFor();await client.screenshot({path:`docs/comercial-gerencial/capturas/apresentacao-${device}.png`,fullPage:true});await client.close();await context.close()
 }
 console.log('10 capturas geradas: catálogo, reunião, apresentação, indicadores e fechamento; desktop/celular, somente fixtures locais.')
}finally{await browser.close();await server.close();await f.cleanup()}
