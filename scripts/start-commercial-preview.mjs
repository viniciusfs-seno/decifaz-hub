import {spawn,spawnSync} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import fs from 'node:fs'
import {createGateway} from '../scripts/hml-gateway.mjs'
import {commercialFixture} from '../scripts/commercial-preview-fixture.mjs'
import {registryFixture} from '../scripts/registry-preview-fixture.mjs'
import {weekStart} from '../src/management-data.ts'
const cwd=process.cwd(),binary=process.argv[process.argv.indexOf('--tunnel')+1];if(!process.argv.includes('--tunnel')||!fs.existsSync(binary))throw Error('Informe --tunnel com o binário cloudflared local.');fs.mkdirSync('.validation',{recursive:true});const tunnel=spawn(binary,['tunnel','--url','http://127.0.0.1:4201','--no-autoupdate'],{windowsHide:true,stdio:['ignore','pipe','pipe']})
const origin=await new Promise((resolve,reject)=>{let data='';const timer=setTimeout(()=>reject(Error('Tunnel unavailable')),45000);const read=x=>{data+=x;const m=data.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(m){clearTimeout(timer);resolve(m[0])}};tunnel.stdout.on('data',read);tunnel.stderr.on('data',read)})
const run=(bin,args,extra={})=>{const r=spawnSync(bin,args,{encoding:'utf8',shell:bin==='npx',...extra});if(r.status)throw Error('Preview step failed; private output omitted');return r.stdout}
const v=Object.fromEntries(run('npx',['--yes','supabase@3.0.0','status','-o','env']).split(/\r?\n/).flatMap(l=>{const m=l.match(/^([A-Z_]+)="(.*)"$/);return m?[[m[1],m[2]]]:[]}));if(v.API_URL!=='http://127.0.0.1:54321')throw Error('Local only')
const sha=run('git',['rev-parse','HEAD'],{cwd}).trim(),password=randomBytes(24).toString('base64url'),expires=Date.now()+86400000,root=cwd+'/.validation/commercial-dist'
run('npx',['vite','build','--outDir',root],{cwd,env:{...process.env,VITE_HUB_MODE:'shared',VITE_SUPABASE_URL:origin+'/__supabase',VITE_SUPABASE_PUBLISHABLE_KEY:v.PUBLISHABLE_KEY}})
const fixture=await commercialFixture({VITE_SUPABASE_URL:v.API_URL,VITE_SUPABASE_PUBLISHABLE_KEY:v.PUBLISHABLE_KEY,HUB_TEST_ADMIN_KEY:v.SECRET_KEY||v.SERVICE_ROLE_KEY});await registryFixture(fixture)
for(const [u,name] of [[fixture.owner,'Marina Fictícia'],[fixture.second,'Caio Fictício'],[fixture.restricted,'Comercial Fictício']])await fixture.admin.auth.admin.updateUserById(u.id,{user_metadata:{name}})
// Fictitious volume makes both kinds of pagination reviewable without real data.
const entries=await fixture.owner.client.from('hub_expenses').insert(Array.from({length:125},(_,n)=>({workspace_id:fixture.workspace,id:crypto.randomUUID(),title:'Despesa de homologação fictícia '+String(n+1).padStart(3,'0'),due_on:fixture.today,amount:1})));if(entries.error)throw Error('Fictional preview setup failed')
for(let i=0;i<22;i++){const r=await fixture.owner.client.rpc('hub_close_financial_week',{w:fixture.workspace,start_on:weekStart(fixture.today),expected_revision:i,operation_id:crypto.randomUUID(),notes_text:'Conferência fictícia de homologação '+(i+1)});if(r.error||r.data.status!=='saved')throw Error('Fictional closure setup failed')}
const server=createGateway({origin,password,sha,expires,root,fixture,publicKey:v.PUBLISHABLE_KEY});await new Promise(r=>server.listen(4201,'127.0.0.1',r))
run('powershell.exe',['-NoProfile','-File','scripts/protect-commercial-preview.ps1'])
fs.writeFileSync('.validation/commercial-preview-access.json',JSON.stringify({origin,password,sha,expires:new Date(expires).toISOString(),instructions:'Entrar na homologação → Administração ou Comercial fictício → CRM, Triagem e Registrar interação. Não usar dados reais.'},null,2))
run('gh',['variable','set','HUB_COMMERCIAL_PREVIEW_URL','--body',origin]);run('gh',['secret','set','HUB_COMMERCIAL_REVIEW_PASSWORD'],{input:password})
fs.writeFileSync('.validation/commercial-preview-public.json',JSON.stringify({origin,sha,expires:new Date(expires).toISOString(),isolated:true}));console.log(JSON.stringify({origin,sha,expires:new Date(expires).toISOString(),isolated:true,accessFile:'.validation/commercial-preview-access.json'}))
setTimeout(()=>{tunnel.kill();server.close();void fixture.cleanup()},86400000).unref()
