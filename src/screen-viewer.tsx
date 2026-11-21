import {useEffect,useRef,useState} from 'react'
import {createClient} from '@supabase/supabase-js'
import {gathered,screenIce} from './screen-peer'
import './shared-workspace.css'
import './workbench.css'

export default function ScreenViewer({invite}:{invite:{id:string;credential:string}|null}){
 const [name,setName]=useState(''),[joined,setJoined]=useState(false),[status,setStatus]=useState(invite?'Informe seu nome e solicite entrada.':'Convite inválido. Peça um novo link ao apresentador.'),[audio,setAudio]=useState(false)
 const [client]=useState(()=>import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false,storageKey:'decifaz-screen-viewer'}}):null)
 const [viewer]=useState(()=>crypto.randomUUID()),video=useRef<HTMLVideoElement>(null),peer=useRef<RTCPeerConnection|undefined>(undefined)
 useEffect(()=>{if(!joined||!client||!invite)return;let live=true,timer:ReturnType<typeof setTimeout>,epoch=-1,failedAt=0
  async function poll(){if(!live||!client||!invite)return;let negotiating=false;try{
   const r=await client.rpc('hub_screen_watch',{s:invite.id,credential:invite.credential,viewer,display_name:name});if(r.error)throw Error('network');if(!live)return
   if(['unavailable','denied'].includes(r.data.state)){peer.current?.close();setStatus('Sessão encerrada, convite expirado ou entrada recusada. Peça um novo convite ao apresentador.');return}
   if(r.data.state==='approved'&&peer.current?.connectionState==='connected')setStatus('Recebendo a tela compartilhada.');
   if(r.data.state==='pending')setStatus('Aguardando o apresentador permitir sua entrada…')
   if(r.data.state==='approved'&&r.data.offer&&r.data.epoch!==epoch){
    negotiating=true;epoch=r.data.epoch;peer.current?.close();const p=new RTCPeerConnection(screenIce);peer.current=p
    p.ontrack=e=>{if(video.current){video.current.srcObject=e.streams[0];void video.current.play().catch(()=>setStatus('Toque em Reproduzir para assistir.'))}}
    p.onconnectionstatechange=()=>{if(live&&peer.current===p)setStatus(p.connectionState==='connected'?'Recebendo a tela compartilhada.':p.connectionState==='disconnected'||p.connectionState==='failed'?'Conexão interrompida. Aguardando reconexão; a rede pode exigir uma chamada externa.':'Conectando à tela…')}
    await p.setRemoteDescription(r.data.offer);await p.setLocalDescription(await p.createAnswer());await gathered(p);if(!live)return
    const saved=await client.rpc('hub_screen_watch',{s:invite.id,credential:invite.credential,viewer,answer:p.localDescription?.toJSON(),offer_epoch:epoch});if(saved.error){epoch=-1;throw Error('answer')}
   }
   failedAt=0
  }catch{if(negotiating){epoch=-1;peer.current?.close()}if(!failedAt)failedAt=Date.now();setStatus('Sem confirmação da rede. Tentando reconectar…');if(Date.now()-failedAt>12000){peer.current?.close();setStatus('Conexão perdida. Peça um novo convite se o apresentador já encerrou.');return}}
  if(live)timer=setTimeout(()=>{void poll()},2000)
  }void poll();return()=>{live=false;clearTimeout(timer);peer.current?.close()}
 },[joined,client,invite,viewer,name])
 return <main className="screen-viewer"><img className="screen-brand" src="/identidade/assinatura-horizontal-escuro-selo.svg" alt="Decifaz"/><h1>Assistir à tela</h1><p>Você recebe apenas a fonte escolhida pelo apresentador. Este convite não concede acesso ao Hub.</p><p className="view-hint">Um espectador por sessão, até 30 minutos. Sem retransmissão TURN; a conexão pode não funcionar nesta rede. Áudio somente quando a fonte e o navegador permitirem.</p>
 {!joined&&<form onSubmit={e=>{e.preventDefault();setJoined(true)}}><label className="field"><span>Seu nome para o apresentador</span><input value={name} maxLength={60} required onChange={e=>setName(e.target.value)}/></label><button className="button primary" disabled={!invite||!client||!name.trim()}>Solicitar entrada</button></form>}
 <p role="status">{status}</p>{joined&&<><video ref={video} autoPlay muted={!audio} playsInline controls aria-label="Tela recebida do apresentador"/><div className="actions"><button className="button" type="button" onClick={()=>setAudio(v=>!v)}>{audio?'Silenciar áudio':'Ativar áudio quando disponível'}</button><button type="button" className="button" onClick={()=>{setJoined(false);peer.current?.close();if(video.current)video.current.srcObject=null;setStatus('Você saiu. O convite pode continuar válido até o apresentador encerrar.')}}>Sair da transmissão</button></div></>}
 </main>
}
