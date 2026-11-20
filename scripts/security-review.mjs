import {execFileSync} from 'node:child_process'
import {readFileSync,statSync,existsSync} from 'node:fs'
// Deliberately report locations/categories only: never echo matching values.
const patterns={private_key:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,provider_token:/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sb_secret_[A-Za-z0-9_-]{15,}|sbp_[a-f0-9]{30,}|re_[A-Za-z0-9]{25,})\b/,auth_link:/https?:\/\/[^\s"<>]+(?:verify\?[^\s"<>]*token=|[?&#](?:access_token|refresh_token|token_hash)=)[A-Za-z0-9_-]{15,}/,jwt:/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,real_email:/[A-Za-z0-9._%+-]+@(?:gmail\.com|hotmail\.com|outlook\.com|decifaz\.com\.br)/i,preview_secret:/(?:password|senha|HUB_HML_REVIEW_PASSWORD)\s*[:=]\s*['"][A-Za-z0-9_-]{12,}['"]/i}
const paths=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),findings=[]
function scan(s,file,history=false){if(s.includes('\0'))return;s.split('\n').forEach((line,i)=>{for(const [kind,re] of Object.entries(patterns))if(re.test(line))findings.push({file,line:history?undefined:i+1,history,kind})})}
for(const p of paths)if(existsSync(p)&&statSync(p).size<2e6)scan(readFileSync(p,'utf8'),p)
if(process.argv.includes('--history')){
 const patch=execFileSync('git',['log','--all','-p','--format=','--','*.md','*.mjs','*.yml','*.toml','*.json','*.ts','*.tsx','*.sql','.env*'],{encoding:'utf8',maxBuffer:100e6})
 let path='historical patch';for(const line of patch.split('\n')){if(line.startsWith('+++ b/'))path=line.slice(6);else if(/^[+-][^+-]/.test(line))scan(line.slice(1),path,true)}
}
console.log(JSON.stringify({files:paths.length,validationTracked:paths.filter(p=>p.startsWith('.validation/')).length,findings},null,2))
if(findings.length)process.exitCode=1
