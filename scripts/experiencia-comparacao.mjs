import {spawnSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import {commercialFixture} from './commercial-preview-fixture.mjs'

const shell=process.platform==='win32'
const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell})
if(status.status!==0)throw Error('Inicie a pilha local')
const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
const env={VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
if(env.VITE_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('Somente pilha local')
const root=resolve('.validation/experiencia-before');await mkdir(root,{recursive:true})
const archive=spawnSync('git',['archive','--format=tar','4558ba48b65a46fe40d96e74091c2fc3b377a046','src','public','index.html','package.json','tsconfig.json'],{maxBuffer:20*1024*1024})
if(archive.status!==0)throw Error('Base comparativa indisponível')
await writeFile(resolve('.validation/experiencia-before.tar'),archive.stdout)
if(spawnSync('tar',['-xf',resolve('.validation/experiencia-before.tar'),'-C',root]).status!==0)throw Error('Falha ao extrair base')
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const f=await commercialFixture(env),servers=[],browser=await chromium.launch(),measurements=[]
await mkdir('docs/experiencia/capturas',{recursive:true})
try{
 for(const [version,source,port] of [['antes',root,4182],['depois',process.cwd(),4183]]){
  const server=await createServer({root:source,configFile:false,base:'./',server:{host:'127.0.0.1',port,strictPort:true}});servers.push(server);await server.listen()
  for(const [device,width,height] of [['desktop',1440,1000],['celular',390,844]]){
   const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Fortaleza'}),page=await context.newPage()
   await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session)
   await page.goto('http://127.0.0.1:'+port)
   await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'})
   await page.getByRole('button',{name:'Atualizar',exact:true}).waitFor()
   await page.locator('nav button').filter({hasText:'Captação e CRM'}).waitFor({state:'attached'})
   let steps=0
   const nav=async(name)=>{const toggle=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible()){await toggle.click();steps++}await page.getByRole('navigation').getByRole('button',{name,exact:true}).click();steps++}
   // Wait for real loaded data, then capture the exact same fixture in both versions.
   await nav('Captação e CRM');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).waitFor()
   await nav('Dashboard');await page.screenshot({path:`docs/experiencia/capturas/dashboard-${version}-${device}.png`,fullPage:true})
   const queueTop=Math.round((await page.locator('.op-queue').boundingBox()).y)
   await nav('Agenda operacional');await page.screenshot({path:`docs/experiencia/capturas/agenda-${version}-${device}.png`,fullPage:true})
   await nav('Captação e CRM');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).click();await page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício'}).waitFor()
   await page.getByText('Acompanhar implantação do cardápio',{exact:false}).first().waitFor()
   await page.screenshot({path:`docs/experiencia/capturas/ficha-${version}-${device}.png`,fullPage:true})
   await nav('Indicadores');await page.getByRole('heading',{name:'Indicadores gerenciais'}).waitFor();await page.screenshot({path:`docs/experiencia/capturas/indicadores-${version}-${device}.png`,fullPage:true})
   if(version==='depois'){await nav('Dashboard');await page.getByRole('button',{name:'Ativar tema escuro'}).click();await page.screenshot({path:`docs/experiencia/capturas/dashboard-escuro-${device}.png`,fullPage:true})}
   await nav('Agenda operacional');await page.getByRole('button',{name:'Vencidas',exact:true}).click();await page.getByLabel('Buscar na agenda').fill('Enviar diagnóstico');await page.getByRole('button',{name:'Enviar diagnóstico revisado',exact:true}).click()
   steps=0
   if(version==='depois'){await page.getByRole('button',{name:'← Voltar à agenda',exact:true}).click();steps++}
   else{await nav('Agenda operacional');await page.getByRole('button',{name:'Vencidas',exact:true}).click();steps++;await page.getByLabel('Buscar na agenda').fill('Enviar diagnóstico');steps++}
   if(await page.getByLabel('Buscar na agenda').inputValue()!=='Enviar diagnóstico'||await page.getByRole('button',{name:'Vencidas',exact:true}).getAttribute('aria-pressed')!=='true')throw Error('Contexto não restaurado')
   measurements.push({version,device,width,height,queueTop,returnFilteredAgendaSteps:steps})
   await context.close()
  }
 }
 await writeFile('docs/experiencia/medicoes.json',JSON.stringify({base:'4558ba48b65a46fe40d96e74091c2fc3b377a046',method:'Cliques e entradas explícitos para retornar da ficha ao mesmo recorte vencidas + busca, sem contar scroll; posição da fila no Dashboard em pixels CSS.',measurements},null,2))
 console.log('18 capturas comparativas e medições geradas com a mesma fixture local, base 4558ba4 e candidato de trabalho.')
}finally{await browser.close();for(const s of servers)await s.close();await f.cleanup()}
