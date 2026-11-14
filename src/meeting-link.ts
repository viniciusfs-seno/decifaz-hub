export function meetingLink(value?:string):string|null {
 if(!value?.trim()) return null
 try {
  const url=new URL(value.trim())
  return url.protocol==='https:'&&!url.username&&!url.password?url.href:null
 } catch {
  return null
 }
}
