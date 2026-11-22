import {screenRpc} from './screen-rpc'
import {useEffect,useRef,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {screenDescription,receiveIce,screenConfiguration,screenSecret,type HostScreen} from './screen-peer'

export function ScreenHost({client,workspace,meeting}:{client:SupabaseClient;workspace:string;meeting:string}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),[session,setSession]=useState<HostScreen>(),[active,setActive]=useState(false),[notice,setNotice]=useState('')
 const current=useRef<{id:string;secret:string;stream:MediaStream;config?:RTCConfiguration;peer?:RTCPeerConnection;viewer?:string;epoch?:number;answered?:boolean;retryAt:number;failAt:number;confirmed:number;ice:RTCIceCandidateInit[];seen:Set<string>;closed:boolean}|undefined>(undefined)
 const rpc=(name:string,args:Record<string,unknown>)=>screenRpc(client,name,args).then(r=>{if(!r.error&&current.current)current.current.confirmed=Date.now();return r})
 const mounted=useRef(true)
 const video=useRef<HTMLVideoElement>(null)
 const inviteExpired=Boolean(session&&Date.parse(session.invite_until)<Date.now())
 const supported=typeof navigator.mediaDevices?.getDisplayMedia==='function'&&typeof RTCPeerConnection!=='undefined'
 async function stop(){const c=current.current;if(!c||c.closed)return;c.closed=true;c.peer?.close();c.stream.getTracks().forEach(t=>t.stop());current.current=undefined;setActive(false);setSession(undefined);setStatus('Compartilhamento encerrado. O link não pode ser reutilizado.');const r=await rpc('hub_screen_host',{s:c.id,action:'stop'});if(r.error)setNotice('A captura foi encerrada. Sem rede, o convite expira no servidor após até 45 segundos sem confirmação.')}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;const c=current.current;if(c&&!c.closed){c.closed=true;c.peer?.close();c.stream.getTracks().forEach(t=>t.stop());void rpc('hub_screen_host',{s:c.id,action:'stop'}).then(()=>{})}current.current=undefined}},[client,workspace,meeting])
 useEffect(()=>{if(video.current)video.current.srcObject=current.current?.stream??null},[active])
 async function start(){
  if(busy||current.current)return;setBusy(true);setNotice('');setStatus('Escolha a tela, janela ou aba no navegador.');let stream:MediaStream|undefined
  try{stream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:true});if(!mounted.current){stream.getTracks().forEach(t=>t.stop());return}const id=crypto.randomUUID(),secret=screenSecret();const r=await rpc('hub_screen_start',{w:workspace,m:meeting,s:id,credential:secret});if(r.error)throw Error('server');if(!stream.getVideoTracks().some(t=>t.readyState==='live')){stream.getTracks().forEach(t=>t.stop());await rpc('hub_screen_host',{s:id,action:'stop'});setStatus('A fonte foi encerrada antes de iniciar. Escolha uma nova fonte para compartilhar.');return}if(!mounted.current){stream.getTracks().forEach(t=>t.stop());void rpc('hub_screen_host',{s:id,action:'stop'}).then(()=>{});return}current.current={id,secret,stream,retryAt:0,failAt:0,confirmed:Date.now(),ice:[],seen:new Set(),closed:false};stream.getVideoTracks()[0].addEventListener('ended',()=>{void stop()},{once:true});setActive(true);setStatus('Captura local iniciada. Copie o convite e aprove quem vai assistir.');setSession({...r.data,state:'open',viewers:[],epoch:0})}
  catch(e){stream?.getTracks().forEach(t=>t.stop());setStatus(e instanceof DOMException&&e.name==='NotAllowedError'?'Seleção cancelada ou permissão recusada. Você pode tentar novamente.':'Não foi possível iniciar. Confira navegador, sessão, acesso à reunião e conexão. Nenhuma transmissão está ativa.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{if(!active)return;let alive=true,timer:ReturnType<typeof setTimeout>
  async function poll(){const c=current.current;if(!alive||!c||c.closed)return;let negotiating=false
   try{
    const r=await rpc('hub_screen_host',{s:c.id});if(r.error)throw Error('network');if(!alive||current.current!==c)return
    if(r.data.state==='ended'){await stop();return}const data=r.data as HostScreen;setSession(data)
    if(c.peer?.connectionState==='connected')setStatus('Transmitindo para o espectador aprovado.');
    const viewer=data.viewers.find(v=>v.state==='approved')
    if(!viewer){c.peer?.close();c.peer=undefined;c.viewer=undefined;setStatus('Captura local ativa. Aguardando aprovação de um espectador.')}
    else if(!c.peer||c.viewer!==viewer.id||((['failed','disconnected','closed'].includes(c.peer.connectionState)||!c.answered)&&Date.now()>c.retryAt)){
     negotiating=true;c.peer?.close();if(!c.config){const relay=await screenConfiguration(client,{s:c.id});if(!alive||c.closed||current.current!==c)return;c.config=relay.config;setNotice(relay.relay?'Retransmissão disponível para esta sessão; o navegador escolhe a rota.':'Conexão direta, sem retransmissão configurada. Se esta rede impedir, use a chamada externa.')}
     const peer=new RTCPeerConnection(c.config);c.peer=peer;c.viewer=viewer.id;c.answered=false;c.ice=[];c.seen=new Set();peer.onicecandidate=e=>{if(c.peer===peer&&e.candidate?.candidate)c.ice.push(e.candidate.toJSON())};c.retryAt=Date.now()+30000
     c.stream.getTracks().forEach(track=>peer.addTrack(track,c.stream));setStatus('Conectando ao espectador…')
     peer.onconnectionstatechange=()=>{if(!alive||c.peer!==peer)return;setStatus(peer.connectionState==='connected'?'Transmitindo para o espectador aprovado.':peer.connectionState==='failed'||peer.connectionState==='disconnected'?'Conexão interrompida. Tentando reconectar; use a chamada externa se a rede impedir a transmissão.':'Conectando ao espectador…')}
     await peer.setLocalDescription(await peer.createOffer());if(!alive||c.closed||c.peer!==peer)return
     const offered=await rpc('hub_screen_host',{s:c.id,action:'offer',payload:screenDescription(peer)});if(offered.error)throw Error('offer');c.epoch=offered.data.epoch
    }else if(viewer.answer&&viewer.epoch===c.epoch&&!c.answered){await c.peer.setRemoteDescription(viewer.answer);c.answered=true}
    if(c.peer&&c.epoch){if(c.ice.length){const batch=c.ice.slice(0,40);const sent=await rpc('hub_screen_host',{s:c.id,action:'ice',payload:{epoch:c.epoch,candidates:batch}});if(sent.error)throw Error('ice');c.ice.splice(0,batch.length)}if(viewer?.epoch===c.epoch)await receiveIce(c.peer,viewer.candidates??[],c.seen)}
    c.failAt=0
   }catch{if(!alive||c.closed)return;if(negotiating){c.peer?.close();c.peer=undefined}if(c.failAt===0)c.failAt=Date.now();setStatus('Sem confirmação do servidor. Tentando recuperar a conexão…');if(Date.now()-c.failAt>12000){await stop();return}}
   if(alive)timer=setTimeout(()=>{void poll()},2000)
  }void poll();return()=>{alive=false;clearTimeout(timer)}
 },[active,client])
 useEffect(()=>{if(!active)return;const watchdog=setInterval(()=>{const c=current.current;if(c&&!c.closed&&Date.now()-c.confirmed>15000){setNotice('Sem confirmação de autorização por 15 segundos. A captura foi interrompida.');void stop()}},500);return()=>clearInterval(watchdog)},[active,client])
 async function decide(viewer:string,action:'approve'|'deny'){const c=current.current;if(!c||busy)return;setBusy(true);setNotice('');try{const r=await rpc('hub_screen_host',{s:c.id,action,viewer});if(r.error){setNotice('Não foi possível alterar a entrada. Atualize a sessão ou gere um novo convite.');return}setSession(r.data)}finally{setBusy(false)}}
 async function copy(){const c=current.current;if(!c)return;try{await navigator.clipboard.writeText(location.origin+'/assistir#'+c.id+'.'+c.secret);setNotice('Convite copiado. Envie apenas à pessoa que vai assistir; o link é uma credencial.')}catch{setNotice('O navegador não permitiu copiar. Autorize a área de transferência e tente novamente.')}}
 return <section className="screen-share panel" aria-label="Compartilhar tela por link"><h4>Tela por link <span className="tag">1 espectador</span></h4><p>Uma pessoa assiste à fonte que você escolher, sem acesso ao portal. Confira a fonte antes de transmitir: uma tela inteira pode mostrar notas internas e notificações. Prefira uma aba preparada. Aprove a entrada somente depois de confirmar com ela. O nome informado não comprova identidade.</p><p className="view-hint">Algumas redes impedem conexão direta. Retransmissão só está disponível quando confirmada para esta sessão; use a chamada externa como alternativa. Áudio ainda não homologado.</p>
 {!supported&&<p role="status">Este navegador não permite iniciar captura aqui. Use Chrome ou Edge no computador com HTTPS, ou a chamada externa.</p>}
 <div className="actions">{active?<><button type="button" className="button" disabled={inviteExpired} onClick={()=>void copy()}>Copiar convite para assistir</button><button type="button" className="button danger" onClick={()=>void stop()}>Encerrar compartilhamento</button></>:<button type="button" className="button primary" disabled={!supported||busy} onClick={()=>void start()}>{busy?'Iniciando…':'Compartilhar tela por link'}</button>}</div>
 {inviteExpired&&<p role="status">Convite expirado. Quem já foi aprovado pode continuar; encerre e inicie novamente para convidar outra pessoa.</p>}{status&&<p role="status">{status}</p>}{notice&&<p role="status">{notice}</p>}
 {active&&<><video className="screen-preview" ref={video} autoPlay muted playsInline aria-label="Prévia local da fonte escolhida"/><p className="view-hint">Prévia local; só há transmissão quando o estado acima confirmar conexão. Convite: 10 minutos. Sessão: até 30 minutos. Sair desta ficha encerra a captura.</p><ul>{session?.viewers.filter(v=>v.state!=='denied').map(v=><li key={v.id}><strong>{v.name}</strong> · {v.state==='pending'?'Solicitou entrada':Date.now()-Date.parse(v.seen_at)<15000?'Aprovado · conectado à sala':'Aprovado · sem confirmação recente'} <div className="actions">{v.state==='pending'&&<button type="button" className="button" disabled={busy||inviteExpired} onClick={()=>void decide(v.id,'approve')}>Permitir assistir</button>}<button type="button" className="button" disabled={busy} onClick={()=>void decide(v.id,'deny')}>{v.state==='pending'?'Recusar':'Remover espectador'}</button></div></li>)}</ul></>}
 </section>
}
