// Passive, bounded failure metadata only. Never log sessions, URLs, response
// bodies, emails, account IDs, request headers or authentication links.
export async function bootDiagnostics(page,action){
 const responses=[],failures=[],errors=[]
 const response=r=>{const path=new URL(r.url()).pathname;if(path==='/functions/v1/hub-workspaces'||path.startsWith('/auth/v1/'))responses.push({kind:path.startsWith('/auth/')?'auth':'memberships',status:r.status()})}
 const failed=r=>failures.push({kind:r.resourceType()})
 const error=()=>errors.push('pageerror')
 page.on('response',response);page.on('requestfailed',failed);page.on('pageerror',error)
 try{return await action()}catch(failure){
  let dom;try{dom=await page.evaluate(()=>({ready:document.readyState,bodyLength:document.body.innerText.length,headings:document.querySelectorAll('h1').length,sessionPresent:Boolean(localStorage.getItem('sb-127-auth-token')),dialogs:document.querySelectorAll('dialog[open]').length}))}catch{dom={unavailable:true}}
  console.log('Abertura isolada: diagnóstico sem dados pessoais',JSON.stringify({viewport:page.viewportSize(),dom,responses:responses.slice(-8),failures:failures.slice(-5),scriptErrors:errors.length}));throw failure
 }finally{page.off('response',response);page.off('requestfailed',failed);page.off('pageerror',error)}
}
