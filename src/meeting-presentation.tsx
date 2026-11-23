import {WorkflowForm} from './workflow-form'
import {useEffect, useRef, useState} from 'react'
import {ExternalLink, MonitorUp, Square} from 'lucide-react'
import {dateLabel,script,type Lead,type Meeting} from './domain'

import {meetingLink} from './meeting-link'

export function MeetingPresentation({meetings,leads}:{meetings:Meeting[];leads:Lead[]}) {
 const capture = useRef<MediaStream|null>(null)
 const video = useRef<HTMLVideoElement>(null)
 const mounted = useRef(false)
 const requestId = useRef(0)
 const [sharing,setSharing] = useState(false)
 const [requesting,setRequesting] = useState(false)
 const [error,setError] = useState('')
 const [selected,setSelected] = useState('')
 const linked=meetings.filter(meeting=>meeting.state!=='Cancelada'&&meetingLink(meeting.callUrl))
 const [link,setLink] = useState('')
 const [step,setStep] = useState(0)
 const available = window.isSecureContext && typeof navigator.mediaDevices?.getDisplayMedia === 'function'

 useEffect(()=>{
  mounted.current=true
  return ()=>{
   mounted.current=false
   capture.current?.getTracks().forEach(track=>track.stop())
   capture.current=null
  }
 },[])

 function stop() {
  capture.current?.getTracks().forEach(track=>track.stop())
  capture.current=null
  if(video.current) video.current.srcObject=null
  setSharing(false)
 }

 async function start() {
  const id=++requestId.current
  setError('')
  setRequesting(true)
  try {
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false})
   if(!mounted.current||id!==requestId.current){
    stream.getTracks().forEach(track=>track.stop())
    return
   }
   capture.current=stream
   if(video.current) video.current.srcObject=stream
   stream.getVideoTracks()[0]?.addEventListener('ended',stop,{once:true})
   setSharing(true)
  } catch {
   if(mounted.current&&id===requestId.current) setError('A captura não foi iniciada. Verifique a permissão do navegador ou selecione uma tela novamente.')
  } finally {
   if(mounted.current&&id===requestId.current) setRequesting(false)
  }
 }

 function openCall(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault()
  try {
   const url=meetingLink(link)
   if(!url) throw new Error()
   window.open(url,'_blank','noopener,noreferrer')
   setError('')
  } catch {
   setError('Informe um link de reunião válido, começando com https://.')
  }
 }

 const [title,prompt]=script[step]
 return <section className="panel meeting-presentation" aria-label="Apresentação e tela">
  <div>
   <h2>Apresentação e tela</h2>
   <p>Abra a chamada em outra aba e use o compartilhamento da ferramenta de videoconferência para transmitir aos participantes.</p>
   {linked.length>0&&<label className="field"><span>Reunião cadastrada</span><select value={selected} onChange={event=>{
    const id=event.target.value
    setSelected(id)
    setLink(linked.find(meeting=>meeting.id===id)?.callUrl??'')
   }}><option value="">Selecionar reunião</option>{linked.map(meeting=><option key={meeting.id} value={meeting.id}>{dateLabel(meeting.date)} · {leads.find(lead=>lead.id===meeting.leadId)?.name}</option>)}</select></label>}
   <WorkflowForm className="toolbar" onSubmit={openCall}>
    <label className="field"><span>Link da chamada</span><input type="url" required value={link} placeholder="https://…" onChange={event=>{setSelected('');setLink(event.target.value)}}/></label>
    <button className="button" type="submit"><ExternalLink size={16}/> Abrir chamada</button>
   </WorkflowForm>
  </div>
  <div>
   <h3>Prévia da tela</h3>
   <p>A captura abaixo aparece apenas neste dispositivo. Você escolhe a aba, a janela ou a tela no seletor do navegador.</p>
   {available?(sharing?
    <button className="button" type="button" onClick={stop}><Square size={16}/> Encerrar prévia</button>:
    <button className="button" type="button" disabled={requesting} onClick={start}><MonitorUp size={16}/> {requesting?'Aguardando seleção…':'Selecionar tela para prévia'}</button>
   ):<p>Este navegador ou endereço não permite captura de tela. Use a ferramenta da chamada para compartilhar.</p>}
   {requesting&&<button className="button compact" type="button" onClick={()=>{requestId.current++;setRequesting(false)}}>Cancelar prévia</button>}
   <video ref={video} hidden={!sharing} autoPlay muted playsInline aria-label="Prévia local da tela selecionada"/>
   {error&&<p role="alert">{error}</p>}
  </div>
  <details>
   <summary>Roteiro consultivo opcional</summary>
   <label className="field"><span>Etapa do roteiro</span><select value={step} onChange={event=>setStep(Number(event.target.value))}>{script.map(([label],index)=><option key={label} value={index}>{label}</option>)}</select></label>
   <p><strong>{title}</strong></p><p>{prompt}</p>
  </details>
 </section>
}
