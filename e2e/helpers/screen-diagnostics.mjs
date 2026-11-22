// Injected only by tests. Whitelist scalar observations; never retain SDP,
// candidates, addresses, credentials, URLs, track labels or raw error messages.
export function installScreenDiagnostics(){
 const Native=window.RTCPeerConnection,peers=[]
 const allowedNames=new Set(['OperationError','InvalidStateError','TypeError','SyntaxError','NotSupportedError'])
 const type=c=>c?.candidate?.match(/\btyp (host|srflx|prflx|relay)\b/)?.[1]??'unknown'
 const failure=e=>({name:allowedNames.has(e?.name)?e.name:'Error',reason:/ufrag|username fragment/i.test(e?.message??'')?'ufrag':/mid|m-line/i.test(e?.message??'')?'mid':/remote description/i.test(e?.message??'')?'remote-description':/pars|syntax/i.test(e?.message??'')?'parse':'other'})
 window.RTCPeerConnection=class extends Native{
  constructor(...args){super(...args);const row={generation:peers.length+1,remoteDescriptions:0,localDescriptions:0,iceAttempted:0,iceAccepted:0,iceRejected:0,ufragMismatch:0,midMismatch:0,types:{},errors:[],states:[],samples:[]};peers.push(row);if(peers.length>8)peers.shift();this.proof=row
   window.__screenControlledDisconnect=()=>this.close()
   window.__screenDecodedFrames=async()=>[...(await this.getStats()).values()].filter(s=>s.type==='inbound-rtp'&&s.kind==='video').reduce((n,s)=>n+(s.framesDecoded??0),0)
   const state=()=>{if(row.states.length<30)row.states.push({connection:this.connectionState,ice:this.iceConnectionState,signaling:this.signalingState})};this.addEventListener('connectionstatechange',state);this.addEventListener('iceconnectionstatechange',state)
   const timer=setInterval(async()=>{if(this.connectionState==='closed'){clearInterval(timer);return}try{const all=[...(await this.getStats()).values()],inbound=all.filter(s=>s.type==='inbound-rtp'),outbound=all.filter(s=>s.type==='outbound-rtp'),pairs=all.filter(s=>s.type==='candidate-pair');const sample={connection:this.connectionState,ice:this.iceConnectionState,pairs:pairs.length,succeeded:pairs.filter(s=>s.state==='succeeded').length,localTypes:[...new Set(all.filter(s=>s.type==='local-candidate').map(s=>s.candidateType))],remoteTypes:[...new Set(all.filter(s=>s.type==='remote-candidate').map(s=>s.candidateType))],framesDecoded:inbound.reduce((n,s)=>n+(s.framesDecoded??0),0),framesEncoded:outbound.reduce((n,s)=>n+(s.framesEncoded??0),0)};row.samples.push(sample);if(row.samples.length>12)row.samples.shift()}catch{/* closed during sampling */}},1000)
  }
  async setRemoteDescription(...args){try{const r=await super.setRemoteDescription(...args);this.proof.remoteDescriptions++;return r}catch(e){this.proof.errors.push({phase:'remote-description',...failure(e)});throw e}}
  async setLocalDescription(...args){try{const r=await super.setLocalDescription(...args);this.proof.localDescriptions++;return r}catch(e){this.proof.errors.push({phase:'local-description',...failure(e)});throw e}}
  async addIceCandidate(candidate){const row=this.proof;row.iceAttempted++;const t=type(candidate);row.types[t]=(row.types[t]??0)+1
   const sdp=this.remoteDescription?.sdp??'',ufrags=[...sdp.matchAll(/^a=ice-ufrag:(.+)$/gm)].map(m=>m[1].trim()),mids=[...sdp.matchAll(/^a=mid:(.+)$/gm)].map(m=>m[1].trim())
   if(candidate?.usernameFragment&&!ufrags.includes(candidate.usernameFragment))row.ufragMismatch++
   if(candidate?.sdpMid!=null&&!mids.includes(candidate.sdpMid))row.midMismatch++
   try{const r=await super.addIceCandidate(candidate);row.iceAccepted++;return r}catch(e){row.iceRejected++;if(row.errors.length<16)row.errors.push({phase:'add-ice',...failure(e)});throw e}
  }
 }
 window.__screenSafeDiagnostics=()=>JSON.parse(JSON.stringify(peers))
}
