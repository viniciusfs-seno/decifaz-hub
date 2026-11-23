import http from 'node:http'
import fs from 'node:fs'
import {chromium,expect} from '@playwright/test'
// Native getDisplayMedia -> RTCPeerConnection -> video in another browser.
// SDP/ICE remain in memory and are never printed or written as evidence.
const sourceTitle='Decifaz captura ficticia'
const html=kind=>`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${kind==='source'?sourceTitle:'Protótipo isolado Decifaz'}</title><body style="margin:0;background:#3a4a6f;color:white;font:24px sans-serif"><h1>Conteúdo fictício de homologação</h1><p id="counter">0</p><button id="start">Compartilhar fonte fictícia</button><video autoplay playsinline muted style="width:100%;max-height:80vh"></video><script>
 window.state={};
 if('${kind}'==='source'){let n=0;setInterval(()=>{document.getElementById('counter').textContent=String(++n);document.body.style.background=n%2?'#3a4a6f':'#ff6a13'},300)}
 window.gather=pc=>new Promise(resolve=>{if(pc.iceGatheringState==='complete')return resolve();const timer=setTimeout(resolve,6000);pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timer);resolve()} })});
 document.getElementById('start').onclick=async()=>{try{window.stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:true});window.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});for(const track of stream.getTracks())pc.addTrack(track,stream);stream.getVideoTracks()[0].onended=()=>{state.ended=true;pc.close()};await pc.setLocalDescription(await pc.createOffer());await gather(pc);state.ready=true}catch(e){state.error=e.name}};
 </script></body></html>`
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html(req.url==='/source'?'source':'peer'))})
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port
const host=await chromium.launch({channel:'chromium',args:['--auto-select-tab-capture-source-by-title='+sourceTitle,'--enable-usermedia-screen-capturing','--autoplay-policy=no-user-gesture-required']}),viewer=await chromium.launch({args:['--autoplay-policy=no-user-gesture-required']})
try{
 const source=await host.newPage({viewport:{width:960,height:720}}),presenter=await host.newPage(),audience=await viewer.newPage()
 await source.goto(origin+'/source');await presenter.goto(origin+'/host');await audience.goto(origin+'/viewer')
 await presenter.getByRole('button',{name:'Compartilhar fonte fictícia'}).click()
 await expect.poll(()=>presenter.evaluate(()=>state.error||state.ready),{timeout:15000}).toBe(true)
 const offer=await presenter.evaluate(()=>({type:pc.localDescription.type,sdp:pc.localDescription.sdp}))
 const answer=await audience.evaluate(async offer=>{window.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});pc.ontrack=e=>document.querySelector('video').srcObject=e.streams[0];await pc.setRemoteDescription(offer);await pc.setLocalDescription(await pc.createAnswer());await gather(pc);return {type:pc.localDescription.type,sdp:pc.localDescription.sdp}},offer)
 await presenter.evaluate(answer=>pc.setRemoteDescription(answer),answer)
 await expect.poll(()=>audience.evaluate(async()=>{const stats=await pc.getStats();return [...stats.values()].find(s=>s.type==='inbound-rtp'&&s.kind==='video')?.framesDecoded??0}),{timeout:20000}).toBeGreaterThan(5)
 async function pixel(){return audience.evaluate(()=>{const v=document.querySelector('video'),c=document.createElement('canvas');c.width=1;c.height=1;c.getContext('2d').drawImage(v,v.videoWidth/2,v.videoHeight/2,1,1,0,0,1,1);return [...c.getContext('2d').getImageData(0,0,1,1).data].slice(0,3)})}
 const first=await pixel();await expect.poll(async()=>{const next=await pixel();return next.some((v,i)=>Math.abs(v-first[i])>30)},{timeout:5000}).toBe(true)
 const result=await audience.evaluate(async()=>{const values=[...(await pc.getStats()).values()],video=values.find(s=>s.type==='inbound-rtp'&&s.kind==='video'),pair=values.find(s=>s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated);return {framesDecoded:video.framesDecoded,width:video.frameWidth,height:video.frameHeight,candidateType:values.find(s=>s.id===pair?.remoteCandidateId)?.candidateType}})
 const audioTracks=await presenter.evaluate(()=>stream.getAudioTracks().length)
 await source.close();await expect.poll(()=>presenter.evaluate(()=>state.ended===true),{timeout:10000}).toBe(true)
 fs.mkdirSync('.validation/screen-prototype',{recursive:true});fs.writeFileSync('.validation/screen-prototype/result.json',JSON.stringify({nativeCapture:true,separateBrowserProcesses:true,sameComputer:true,crossNetwork:false,receivedChangingPixels:true,browserSourceClosed:true,audioTracks,...result},null,2))
 console.log({nativeCapture:true,separateBrowserProcesses:true,sameComputer:true,crossNetwork:false,receivedChangingPixels:true,browserSourceClosed:true,audioTracks,...result})
}finally{await host.close();await viewer.close();await new Promise(r=>server.close(r))}
