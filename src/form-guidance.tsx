import {useEffect,useRef,useState,type FormEvent} from 'react'
export function useInvalidField(reveal?:(target:HTMLElement)=>void){
 const frame=useRef<number|null>(null),[validation,setValidation]=useState('')
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)},[])
 function invalid(event:FormEvent<HTMLElement>){
  event.preventDefault()
  if(frame.current!==null||!(event.target instanceof HTMLElement))return
  const target=event.target;let parent=target.parentElement
  while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement}
  reveal?.(target);target.setAttribute('aria-invalid','true')
  setValidation('Confira os campos obrigatórios e os valores indicados. A primeira pendência foi aberta.')
  frame.current=requestAnimationFrame(()=>{frame.current=null;if(target.isConnected){target.focus();target.scrollIntoView({block:'center',behavior:'auto'})}})
 }
 function changed(event:FormEvent<HTMLElement>){if(event.target instanceof HTMLElement)event.target.removeAttribute('aria-invalid');setValidation('')}
 return {invalid,changed,validation}
}
