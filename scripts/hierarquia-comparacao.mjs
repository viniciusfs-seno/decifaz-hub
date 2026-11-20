import {spawnSync} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createServer} from 'vite'
import {chromium,expect} from '@playwright/test'
import {commercialFixture} from './commercial-preview-fixture.mjs'
import {registryFixture} from './registry-preview-fixture.mjs'

const base='da3fd8abe8da56db6fdc2482eabb015a3b45ba0f'
const status=spawnSync('npx',['--yes','supabase@3.0.0','status','-o','env'],{encoding:'utf8',shell:process.platform==='win32'})
if(status.status!==0)throw Error('Inicie o Supabase local')
const values=Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}))
const env={VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:values.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:values.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:values.SECRET_KEY||values.SERVICE_ROLE_KEY}
if(env.VITE_SUPABASE_URL!=='http://127.0.0.1:54321')throw Error('Somente ambiente local isolado')
const root=resolve('.validation/hierarchy-before'),out='docs/hierarquia/capturas'
await mkdir(root,{recursive:true});await mkdir(out,{recursive:true})
const archive=spawnSync('git',['archive','--format=tar',base,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:20*1024*1024})
if(archive.status!==0)throw Error('Base indisponível')
await writeFile('.validation/hierarchy-before.tar',archive.stdout)
if(spawnSync('tar',['-xf',resolve('.validation/hierarchy-before.tar'),'-C',root]).status!==0)throw Error('Extração falhou')
Object.assign(process.env,{VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:env.VITE_SUPABASE_URL,VITE_SUPABASE_PUBLISHABLE_KEY:env.VITE_SUPABASE_PUBLISHABLE_KEY})
const f=await commercialFixture(env);await registryFixture(f)
const browser=await chromium.launch(),servers=[],measurements=[]
try{
 for(const [version,source,port] of [['antes',root,4182],['depois',process.cwd(),4183]]){
  const server=await createServer({root:source,configFile:false,base:'./',server:{host:'127.0.0.1',port,strictPort:true}});servers.push(server);await server.listen()
  for(const [device,width,height] of [['desktop',1440,1000],['celular',390,844]]){
   const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Fortaleza',locale:'pt-BR'}),page=await context.newPage();page.setDefaultTimeout(15000)
   await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session)
   await page.goto('http://127.0.0.1:'+port)
   const nav=async name=>{const toggle=page.getByRole('button',{name:'Abrir navegação',exact:true});if(await toggle.isVisible())await toggle.click();await page.getByRole('navigation').getByRole('button',{name,exact:true}).click()}
   const shot=async name=>{await page.screenshot({path:`${out}/${name}-${version}-${device}.png`,fullPage:true});if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Rolagem horizontal em '+name+' '+version+' '+device)}
   await page.getByRole('heading',{name:'Fila de ações',exact:true}).waitFor()
   await nav('Contratos');await page.getByRole('button',{name:'Contrato fictício · Café Horizonte',exact:true}).waitFor()
   await nav('Dashboard');await expect(page.getByText('Contrato fictício · Café Horizonte',{exact:false}).first()).toBeVisible();await shot('dashboard')
   await nav('Projetos e entregas');await page.getByRole('button',{name:'Pedidos digitais · Horizonte',exact:true}).click();await page.getByRole('dialog').waitFor();await shot('projeto')
   measurements.push({version,device,width,height,projectVisibleControls:await page.getByRole('dialog').locator('input:visible,select:visible,textarea:visible,button:visible').count()})
   await page.getByRole('dialog').getByRole('button',{name:'Fechar',exact:true}).click()
   await nav('Contratos');await page.getByRole('button',{name:'Contrato fictício · Café Horizonte',exact:true}).click();await page.getByLabel(/^Título do contrato/).waitFor();await shot('contrato');await page.getByRole('button',{name:'Fechar contrato',exact:true}).click()
   await nav('Obrigações da Decifaz');await page.getByRole('table').getByRole('button',{name:'Ferramenta mensal · fictícia',exact:true}).waitFor();await shot('obrigacoes')
   await nav('Indicadores');await page.getByRole('heading',{name:'Indicadores gerenciais',exact:true}).waitFor();await shot('indicadores')
   if(version==='depois'){await page.getByRole('button',{name:'Ativar tema escuro',exact:true}).click();await shot('indicadores-escuro');await nav('Dashboard');await shot('dashboard-escuro')}
   await context.close()
  }
 }
 await writeFile('docs/hierarquia/medicoes.json',JSON.stringify({base,method:'Mesma fixture fictícia, sem alterações de negócio entre versões; controles visíveis na primeira seção do projeto. Não mede tempo de tarefa ou satisfação.',measurements},null,2))
 console.log('24 capturas comparativas geradas com dados fictícios, sem rolagem horizontal na página.')
}finally{await browser.close();for(const s of servers)await s.close();await f.cleanup()}
