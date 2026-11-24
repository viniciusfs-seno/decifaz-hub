import {useEffect,useRef,useState,type FormEvent} from 'react'
export function useInvalidField(reveal?:(target:HTMLElement)=>void){
 const frame=useRef<number|null>(null),clearFeedback=useRef<number|null>(null),live=useRef(true),[validation,setValidation]=useState('')
 useEffect(()=>{live.current=true;return()=>{live.current=false;if(frame.current!==null)cancelAnimationFrame(frame.current);if(clearFeedback.current!==null)window.clearTimeout(clearFeedback.current)}},[])
 function invalid(event:FormEvent<HTMLElement>){
  event.preventDefault()
  if(clearFeedback.current!==null){window.clearTimeout(clearFeedback.current);clearFeedback.current=null}
  if(frame.current!==null||!(event.target instanceof HTMLElement))return
  const target=event.target;let parent=target.parentElement
  if(target.closest('form.workflow-form')){reveal?.(target);return}
  while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement}
  reveal?.(target);target.setAttribute('aria-invalid','true')
  setValidation('Confira os campos obrigatórios e os valores indicados. A primeira pendência foi aberta.')
  frame.current=requestAnimationFrame(()=>{frame.current=null;if(target.isConnected){target.focus();target.scrollIntoView({block:'center',behavior:'auto'})}})
 }
 function changed(event:FormEvent<HTMLElement>){
  if(event.target instanceof HTMLElement&&event.target.closest('form.workflow-form'))return
  if(event.target instanceof HTMLElement)event.target.removeAttribute('aria-invalid')
  // The capture event precedes the controlled field's onChange. Clearing state
  // synchronously here can restore the previous value before onChange reads it.
  if(clearFeedback.current!==null)window.clearTimeout(clearFeedback.current)
  clearFeedback.current=window.setTimeout(()=>{clearFeedback.current=null;if(live.current)setValidation('')},0)
 }
 return {invalid,changed,validation}
}
