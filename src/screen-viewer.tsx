import {screenRpc} from './screen-rpc'
import {useEffect,useRef,useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {screenDescription,receiveIce,screenIce} from './screen-peer'
import './shared-workspace.css'
import './workbench.css'

export default function ScreenViewer({invite}:{invite:{id:string;credential:string}|null}){
 const [name,setName]=useState(''),[joined,setJoined]=useState(false),[status,setStatus]=useState(invite?'Informe seu nome e solicite entrada.':'Convite inválido. Peça um novo link ao apresentador.'),[audio,setAudio]=useState(false)
 const [dark,setDark]=useState(()=>{try{return localStorage.getItem('decifaz-theme')==='dark'}catch{return false}})
 useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';try{localStorage.setItem('decifaz-theme',dark?'dark':'light')}catch{/* tema funciona em memória */}},[dark])
 const [client]=useState(()=>import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false,storageKey:'decifaz-screen-viewer'}}):null)
 const [viewer]=useState(()=>crypto.randomUUID()),video=useRef<HTMLVideoElement>(null),peer=useRef<RTCPeerConnection|undefined>(undefined)
 useEffect(()=>{if(!joined||!client||!invite)return;let live=true,timer:ReturnType<typeof setTimeout>,epoch=-1,failedAt=0,confirmed=Date.now(),ice:RTCIceCandidateInit[]=[],seen=new Set<string>()
  const request=(args:Record<string,unknown>)=>screenRpc(client,'hub_screen_watch',args).then(r=>{if(!r.error)confirmed=Date.now();return r})
  const watchdog=setInterval(()=>{if(live&&Date.now()-confirmed>15000){live=false;clearTimeout(timer);peer.current?.close();setStatus('Sem confirmação de autorização por 15 segundos. A recepção foi interrompida; peça um novo convite.')}},500)
  async function poll(){if(!live||!client||!invite)return;let negotiating=false;try{
   const r=await request({s:invite.id,credential:invite.credential,viewer,display_name:name});if(r.error)throw Error('network');if(!live)return
   if(['unavailable','denied'].includes(r.data.state)){live=false;clearInterval(watchdog);peer.current?.close();setStatus('Sessão encerrada, convite expirado ou entrada recusada. Peça um novo convite ao apresentador.');return}
   if(r.data.state==='approved'&&peer.current?.connectionState==='connected')setStatus('Recebendo a tela compartilhada.');
   if(r.data.state==='pending')setStatus('Aguardando o apresentador permitir sua entrada…')
   if(r.data.state==='approved'&&r.data.offer&&r.data.epoch!==epoch){
    negotiating=true;epoch=r.data.epoch;peer.current?.close();const p=new RTCPeerConnection(screenIce);peer.current=p;ice=[];seen=new Set()
    p.onicecandidate=e=>{if(live&&peer.current===p&&e.candidate?.candidate)ice.push(e.candidate.toJSON())}
    p.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0];void video.current.play().catch(()=>setStatus('Toque em Reproduzir para assistir.'))}}
    p.onconnectionstatechange=()=>{if(live&&peer.current===p)setStatus(p.connectionState==='connected'?'Recebendo a tela compartilhada.':p.connectionState==='disconnected'||p.connectionState==='failed'?'Conexão interrompida. Aguardando reconexão; a rede pode exigir uma chamada externa.':'Conectando à tela…')}
    await p.setRemoteDescription(r.data.offer);await p.setLocalDescription(await p.createAnswer());if(!live)return
    const saved=await request({s:invite.id,credential:invite.credential,viewer,answer:screenDescription(p),offer_epoch:epoch});if(saved.error){epoch=-1;throw Error('answer')}
   }
   if(r.data.state==='approved'&&peer.current&&epoch===r.data.epoch){await receiveIce(peer.current,r.data.candidates??[],seen);if(ice.length){const batch=ice.slice(0,40);const sent=await request({s:invite.id,credential:invite.credential,viewer,offer_epoch:epoch,candidates:batch});if(sent.error)throw Error('ice');ice.splice(0,batch.length)}}
   failedAt=0
  }catch{if(!live)return;if(negotiating){epoch=-1;peer.current?.close()}if(!failedAt)failedAt=Date.now();setStatus('Sem confirmação da rede. Tentando reconectar…');if(Date.now()-failedAt>12000){live=false;clearInterval(watchdog);peer.current?.close();setStatus('Conexão perdida. Peça um novo convite se o apresentador já encerrou.');return}}
  if(live)timer=setTimeout(()=>{void poll()},2000)
  }void poll();return()=>{live=false;clearInterval(watchdog);clearTimeout(timer);peer.current?.close()}
 },[joined,client,invite,viewer,name])
 return <main className="screen-viewer"><img className="screen-brand" src="/identidade/assinatura-horizontal-escuro-selo.svg" alt="Decifaz"/><button type="button" className="button" aria-label={dark?'Ativar tema claro':'Ativar tema escuro'} onClick={()=>setDark(v=>!v)}>{dark?'Tema claro':'Tema escuro'}</button><h1>Assistir à tela</h1><p>Você recebe apenas a fonte escolhida pelo apresentador. Este convite não concede acesso ao Hub.</p><p className="view-hint">Um espectador por sessão, até 30 minutos. Sem retransmissão TURN; a conexão pode não funcionar nesta rede. Áudio somente quando a fonte e o navegador permitirem.</p>
 {!joined&&<form onSubmit={e=>{e.preventDefault();setJoined(true)}}><label className="field"><span>Seu nome para o apresentador</span><input value={name} maxLength={60} required onChange={e=>setName(e.target.value)}/></label><button className="button primary" disabled={!invite||!client||!name.trim()}>Solicitar entrada</button></form>}
 <p role="status">{status}</p>{joined&&<><video ref={video} autoPlay muted={!audio} playsInline controls aria-label="Tela recebida do apresentador"/><div className="actions"><button className="button" type="button" onClick={()=>setAudio(v=>!v)}>{audio?'Silenciar áudio':'Ativar áudio quando disponível'}</button><button type="button" className="button" onClick={()=>{setJoined(false);peer.current?.close();if(video.current)video.current.srcObject=null;setStatus('Você saiu. O convite pode continuar válido até o apresentador encerrar.')}}>Sair da transmissão</button></div></>}
 </main>
}
