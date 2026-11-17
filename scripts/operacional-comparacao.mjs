import {spawnSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium} from '@playwright/test'
import {operationalFixture} from '../e2e/helpers/operational-fixture.mjs'

const shell=process.platform==='win32'
const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell})
if(status.status!==0)throw Error('Inicie a pilha local')
const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
const env={VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
if(env.VITE_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('Somente pilha local')
const root=resolve('.validation/operacional-before');await mkdir(root,{recursive:true})
const archive=spawnSync('git',['archive','--format=tar','4e59c14d08b5080936d38668c6643e0fc1c0cedf','src','public','index.html','package.json','tsconfig.json'],{maxBuffer:20*1024*1024})
if(archive.status!==0)throw Error('Base comparativa indisponível')
await writeFile(resolve('.validation/operacional-before.tar'),archive.stdout)
if(spawnSync('tar',['-xf',resolve('.validation/operacional-before.tar'),'-C',root]).status!==0)throw Error('Falha ao extrair base')
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const f=await operationalFixture(env),servers=[],browser=await chromium.launch()
await mkdir('docs/operacional/capturas',{recursive:true})
try{
 for(const [version,source,port] of [['antes',root,4182],['depois',process.cwd(),4183]]){
  const server=await createServer({root:source,configFile:false,base:'./',server:{host:'127.0.0.1',port,strictPort:true}});servers.push(server);await server.listen()
  for(const [device,width,height] of [['desktop',1440,1000],['celular',390,844]]){
   const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Fortaleza'}),page=await context.newPage()
   await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session)
   await page.goto('http://127.0.0.1:'+port)
   await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'})
   await page.getByRole('button',{name:'Atualizar',exact:true}).waitFor()
   await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).waitFor({state:'attached'})
   const nav=async(name)=>{const toggle=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
   // Wait for real loaded data, then capture the exact same fixture in both versions.
   await nav('Captação e CRM');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).waitFor()
   await nav('Dashboard');await page.screenshot({path:`docs/operacional/capturas/dashboard-${version}-${device}.png`,fullPage:true})
   await nav('Agenda operacional');await page.screenshot({path:`docs/operacional/capturas/agenda-${version}-${device}.png`,fullPage:true})
   await nav('Captação e CRM');await page.getByRole('button',{name:'Café Horizonte · fictício',exact:true}).click();await page.getByRole('heading',{name:'Jornada comercial de Café Horizonte · fictício'}).waitFor()
   await page.getByText('Acompanhar implantação do cardápio',{exact:false}).first().waitFor()
   await page.screenshot({path:`docs/operacional/capturas/ficha-${version}-${device}.png`,fullPage:true})
   if(version==='depois'&&device==='desktop'){await nav('Dashboard');await page.getByRole('button',{name:'Ativar tema escuro'}).click();await page.screenshot({path:'docs/operacional/capturas/dashboard-escuro-desktop.png',fullPage:true})}
   await context.close()
  }
 }
 console.log('13 capturas comparativas geradas com a mesma fixture local.')
}finally{await browser.close();for(const s of servers)await s.close();await f.cleanup()}
