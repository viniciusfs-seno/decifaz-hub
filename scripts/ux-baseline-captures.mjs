import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
const baseline='8af891436decbcd80e6b00820f0c13c0e663c6b6',root=resolve('.validation/ux-before44')
fs.mkdirSync(root,{recursive:true})
const archive=spawnSync('git',['archive',baseline,'src','public','index.html','package.json','tsconfig.json'],{maxBuffer:100e6});if(archive.status)throw Error('Baseline Git unavailable')
const extracted=spawnSync('tar',['-xf','-','-C',root],{input:archive.stdout});if(extracted.status)throw Error('Baseline extraction failed')
if(!fs.existsSync(root+'/node_modules'))fs.symlinkSync(resolve('node_modules'),root+'/node_modules',process.platform==='win32'?'junction':'dir')
const config=resolve('.validation/ux-before.config.mjs')
fs.writeFileSync(config,`import {defineConfig} from '@playwright/test';import {resolve} from 'node:path';export default defineConfig({testDir:resolve('e2e'),use:{baseURL:'http://127.0.0.1:4182',timezoneId:'America/Fortaleza'},webServer:{cwd:${JSON.stringify(resolve('.'))},command:'node node_modules/vite/bin/vite.js .validation/ux-before44 --host 127.0.0.1 --port 4182 --strictPort',url:'http://127.0.0.1:4182'}})`)
const r=spawnSync(process.execPath,['scripts/local-validation.mjs','ux-daily-real.spec.mjs','--workers=1','--grep','inventário','--config',config],{env:{...process.env,HUB_UX_CAPTURE_PHASE:'before'},stdio:'inherit'});if(r.status)throw Error('Baseline capture failed')
const before=JSON.parse(fs.readFileSync('.validation/ux-daily/before/inventory.json')),after=JSON.parse(fs.readFileSync('.validation/ux-daily/after/inventory.json'))
const comparison=after.map(a=>{const b=before.find(b=>b.name===a.name&&b.width===a.width&&b.theme===a.theme);return {screen:a.name,width:a.width,theme:a.theme,before:b?.visibleFields,after:a.visibleFields}})
fs.writeFileSync('.validation/ux-daily/comparison.json',JSON.stringify({baseline,measurement:'Visible editable controls in dialog/form, or main for dashboard/finance; identical fictional fixture values and widths',comparison},null,2));console.log('Before/after captured from actual baseline and candidate; comparison saved without credentials.')
