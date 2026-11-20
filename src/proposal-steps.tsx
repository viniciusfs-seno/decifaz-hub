import {useState,type ReactNode} from 'react'
import {useInvalidField} from './form-guidance'
export function ProposalSteps({steps}:{steps:{id:string;title:string;content:ReactNode}[]}){
 const [active,setActive]=useState(steps[0].id),index=steps.findIndex(s=>s.id===active)
 const {invalid,changed,validation}=useInvalidField(target=>{const section=target.closest<HTMLElement>('[data-proposal-step]');if(section){section.hidden=false;setActive(section.dataset.proposalStep!)}})
 return <div className="proposal-steps" onInvalidCapture={invalid} onInputCapture={changed}>
  <nav aria-label="Etapas da proposta"><ol>{steps.map((step,i)=><li key={step.id}><button type="button" aria-current={active===step.id?'step':undefined} onClick={()=>setActive(step.id)}><span>{i+1}</span>{step.title}</button></li>)}</ol></nav>
  {validation&&<p role="alert">{validation}</p>}
  {steps.map(step=><section key={step.id} data-proposal-step={step.id} hidden={active!==step.id} aria-label={step.title}><h3>{step.title}</h3>{step.content}</section>)}
  <div className="step-actions"><button type="button" className="button" disabled={index===0} onClick={()=>setActive(steps[index-1].id)}>Etapa anterior</button><span>{index+1} de {steps.length}</span><button type="button" className="button" disabled={index===steps.length-1} onClick={()=>setActive(steps[index+1].id)}>Próxima etapa</button></div>
 </div>
}
