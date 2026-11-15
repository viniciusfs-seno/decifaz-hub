import {spawn,spawnSync} from 'node:child_process'
export const container='supabase_db_decifaz-hub-e2e'
const args=['exec','-i',container,'psql','-X','-q','-t','-A','-U','postgres','-v','ON_ERROR_STOP=1']
export const literal=value=>"'"+String(value).replaceAll("'","''")+"'"
export function sql(input){
 const result=spawnSync('docker',args,{input,encoding:'utf8'})
 if(result.status!==0)throw Error(result.stderr||'Falha no SQL local')
 return result.stdout.trim()
}
export function session(){
 const child=spawn('docker',args,{stdio:['pipe','pipe','pipe']})
 let output='',error=''
 child.stdout.on('data',chunk=>{output+=chunk})
 child.stderr.on('data',chunk=>{error+=chunk})
 const done=new Promise((resolve,reject)=>{
  child.on('error',reject)
  child.on('close',code=>code===0?resolve(output):reject(Error(error)))
 })
 // Register immediately so failures do not become unhandled while coordinating.
 done.catch(()=>{})
 return {child,done,output:()=>output,error:()=>error}
}
export const authenticate=id=>`set local role authenticated; select set_config('request.jwt.claim.sub',${literal(id)},true);`
