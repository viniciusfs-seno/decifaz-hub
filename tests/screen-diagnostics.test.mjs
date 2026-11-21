import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {installScreenDiagnostics} from '../e2e/helpers/screen-diagnostics.mjs'

test('Diagnóstico de tela preserva apenas contagens/estados e classifica erros sem conteúdo privado',async()=>{
 const sensitive='TOKEN_FICTICIO_QUE_NAO_PODE_SAIR',timers=[]
 class Peer{
  connectionState='new';iceConnectionState='new';signalingState='stable';remoteDescription=null
  addEventListener(){}
  async setRemoteDescription(value){this.remoteDescription=value}
  async setLocalDescription(){}
  async addIceCandidate(){throw new DOMException('ufrag '+sensitive+' 192.0.2.99','OperationError')}
  async getStats(){return new Map([['candidate',{type:'remote-candidate',candidateType:'host',address:'192.0.2.99',url:sensitive}]])}
 }
 const sandbox={window:{RTCPeerConnection:Peer},setInterval:fn=>{timers.push(fn);return 1},clearInterval(){}}
 vm.runInNewContext('('+installScreenDiagnostics.toString()+')()',sandbox)
 const p=new sandbox.window.RTCPeerConnection();await p.setRemoteDescription({type:'offer',sdp:'a=ice-ufrag:'+sensitive+'\r\na=mid:0\r\n'});await p.setLocalDescription()
 await assert.rejects(p.addIceCandidate({candidate:'candidate:1 1 udp 1 192.0.2.99 5000 typ host',usernameFragment:sensitive,sdpMid:'0'}));await timers[0]()
 const result=sandbox.window.__screenSafeDiagnostics(),json=JSON.stringify(result)
 assert.equal(result[0].iceRejected,1);assert.equal(result[0].errors[0].reason,'ufrag');assert.equal(result[0].ufragMismatch,0)
 assert.ok(!json.includes(sensitive));assert.ok(!json.includes('192.0.2.99'));assert.ok(!json.includes('candidate:'));assert.ok(!json.includes('sdp'))
})
