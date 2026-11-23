import {screenRpc} from './screen-rpc'
import {useEffect,useRef,useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {screenDescription,receiveIce,screenConfiguration} from './screen-peer'
import './shared-workspace.css'
import './workbench.css'

export default function ScreenViewer({invite}:{invite:{id:string;credential:string}|null}){
 const [name,setName]=useState(''),[joined,setJoined]=useState(false),[status,setStatus]=useState(invite?'Informe seu nome e solicite entrada.':'Convite inválido. Peça um novo link ao apresentador.')
 const [network,setNetwork]=useState('Conexão direta; retransmissão ainda não confirmada para esta sessão.')
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem('decifaz-theme')==='dark'}catch{return false}})
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('decifaz-theme',dark?'dark':'light')}catch{/* tema funciona em memória */}},[dark])
 const [client]=useState(()=>import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false,storageKey:'decifaz-screen-viewer'}}):null)
 const [viewer]=useState(()=>crypto.randomUUID()),video=useRef<HTMLVideoElement>(null),peer=useRef<RTCPeerConnection|undefined>(undefined)
 useEffect(()=>{if(!joined||!client||!invite)return;let live=true,timer:ReturnType<typeof setTimeout>,epoch=-1,failedAt=0,confirmed=Date.now(),ice:RTCIceCandidateInit[]=[],seen=new Set<string>(),config:RTCConfiguration|undefined
  const request=(args:Record<string,unknown>)=>screenRpc(client,'hub_screen_watch',args).then(r=>{if(!r.error)confirmed=Date.now();return r})
  let endsAt=Infinity
  function release(){peer.current?.close();if(video.current){const stream=video.current.srcObject as MediaStream|null;stream?.getTracks().forEach(t=>t.stop());video.current.srcObject=null}}
  const watchdog=setInterval(()=>{if(live&&(Date.now()>=endsAt||Date.now()-confirmed>15000)){live=false;clearTimeout(timer);release();setStatus(Date.now()>=endsAt?'Sessão encerrada: limite de duração atingido. Peça um novo convite.':'Sem confirmação de autorização por 15 segundos. A recepção foi interrompida; peça um novo convite.')}},500)
  async function poll(){if(!live||!client||!invite)return;let negotiating=false;try{
   const r=await request({s:invite.id,credential:invite.credential,viewer,display_name:name});if(r.error)throw Error('network');if(!live)return
   if(['unavailable','denied'].includes(r.data.state)){live=false;clearInterval(watchdog);release();setStatus('Sessão encerrada, convite expirado ou entrada recusada. Peça um novo convite ao apresentador.');return}
   if(r.data.ends_at)endsAt=Date.parse(r.data.ends_at)
   if(r.data.state==='approved'&&peer.current?.connectionState==='connected')setStatus('Recebendo a tela compartilhada.');
   if(r.data.state==='pending')setStatus('Aguardando o apresentador permitir sua entrada…')
   if(r.data.state==='approved'&&r.data.offer&&r.data.epoch!==epoch){
    negotiating=true;epoch=r.data.epoch;peer.current?.close();if(!config){const relay=await screenConfiguration(client,{s:invite.id,credential:invite.credential,viewer});if(!live)return;config=relay.config;setNetwork(relay.relay?'Retransmissão disponível; o navegador escolhe a rota.':'Conexão direta, sem retransmissão configurada. Se esta rede impedir, peça a chamada externa.')}
    const p=new RTCPeerConnection(config);peer.current=p;ice=[];seen=new Set()
    p.onicecandidate=e=>{if(live&&peer.current===p&&e.candidate?.candidate)ice.push(e.candidate.toJSON())}
    p.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0];void video.current.play().catch(()=>setStatus('Toque em Reproduzir para assistir.'))}}
    p.onconnectionstatechange=()=>{if(live&&peer.current===p)setStatus(p.connectionState==='connected'?'Recebendo a tela compartilhada.':p.connectionState==='disconnected'||p.connectionState==='failed'?'Conexão interrompida. Aguardando reconexão; a rede pode exigir uma chamada externa.':'Conectando à tela…')}
    await p.setRemoteDescription(r.data.offer);await p.setLocalDescription(await p.createAnswer());if(!live)return
    const saved=await request({s:invite.id,credential:invite.credential,viewer,answer:screenDescription(p),offer_epoch:epoch});if(saved.error){epoch=-1;throw Error('answer')}
   }
   if(r.data.state==='approved'&&peer.current&&epoch===r.data.epoch){await receiveIce(peer.current,r.data.candidates??[],seen);if(ice.length){const batch=ice.slice(0,40);const sent=await request({s:invite.id,credential:invite.credential,viewer,offer_epoch:epoch,candidates:batch});if(sent.error)throw Error('ice');ice.splice(0,batch.length)}}
   failedAt=0
  }catch{if(!live)return;if(negotiating){epoch=-1;peer.current?.close()}if(!failedAt)failedAt=Date.now();setStatus('Sem confirmação da rede. Tentando reconectar…');if(Date.now()-failedAt>12000){live=false;clearInterval(watchdog);release();setStatus('Conexão perdida. Use a chamada externa ou peça um novo convite. Não há informação de saldo do provedor.');return}}
  if(live)timer=setTimeout(()=>{void poll()},2000)
  }void poll();return()=>{live=false;clearInterval(watchdog);clearTimeout(timer);release()}
 },[joined,client,invite,viewer,name])
 return <main className="screen-viewer"><img className="screen-brand" src="/identidade/assinatura-horizontal-escuro-selo.svg" alt="Decifaz"/><button type="button" className="button" aria-label={dark?'Ativar tema claro':'Ativar tema escuro'} onClick={()=>setDark(v=>!v)}>{dark?'Tema claro':'Tema escuro'}</button><h1>Assistir à tela · Experimental</h1><p>Você recebe apenas a fonte escolhida pelo apresentador. Este convite não concede acesso ao Hub.</p><p className="view-hint">Perfil econômico: um espectador, sessão de até 5 minutos, vídeo até 1280 × 720 e 5 FPS. {network} Áudio ainda não homologado e não é capturado neste perfil. Não há informação de saldo do provedor.</p>
 {!joined&&<form onSubmit={e=>{e.preventDefault();setJoined(true)}}><label className="field"><span>Seu nome para o apresentador</span><input value={name} maxLength={60} required onChange={e=>setName(e.target.value)}/></label><button className="button primary" disabled={!invite||!client||!name.trim()}>Solicitar entrada</button></form>}
 <p role="status">{status}</p>{joined&&<><video ref={video} autoPlay muted playsInline controls aria-label="Tela recebida do apresentador"/><div className="actions"><button type="button" className="button" onClick={()=>{setJoined(false);peer.current?.close();if(video.current)video.current.srcObject=null;setStatus('Você saiu. O convite pode continuar válido até o apresentador encerrar.')}}>Sair da transmissão</button></div></>}
 </main>
}
