import {useId,useLayoutEffect,useRef,useState,type ComponentProps,type FormEvent} from 'react'

type Control=HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement
const controls=(form:HTMLFormElement)=>Array.from(form.elements).filter((e):e is Control=>e instanceof HTMLInputElement||e instanceof HTMLSelectElement||e instanceof HTMLTextAreaElement)
const annotations=new WeakMap<Control,HTMLSpanElement>()
const owners=new WeakMap<HTMLElement,Control>()
const baselines=new WeakMap<HTMLFormElement,string>()
const fingerprint=(form:HTMLFormElement)=>JSON.stringify(controls(form).map(f=>[f.type,f.value,f instanceof HTMLInputElement?f.checked:null]))
export function markFormSaved(form:HTMLFormElement){delete form.dataset.edited;baselines.set(form,fingerprint(form))}
export function hasUnsavedEdits(form:HTMLFormElement){return form.dataset.edited==='true'&&baselines.get(form)!==fingerprint(form)}
const valid=(field:Control)=>field.validity.valid&&(!field.required||field instanceof HTMLSelectElement||field.value.trim()!=='')
function labelOf(field:Control){const label=field.labels?.[0]?.cloneNode(true) as HTMLElement|undefined;label?.querySelectorAll('input,select,textarea,[aria-hidden],.field-error,.field-help').forEach(e=>e.remove());return field.getAttribute('aria-label')||label?.textContent?.trim()||'Campo indicado'}
function messageOf(field:Control){const v=field.validity;if(v.customError)return field.validationMessage;if(v.valueMissing||field.required&&!field.value.trim())return field instanceof HTMLInputElement&&field.type==='checkbox'?'Confirme esta opção para continuar.':'Preencha este campo.';if(v.typeMismatch)return field instanceof HTMLInputElement&&field.type==='email'?'Informe um e-mail válido.':'Use um endereço completo, começando com https://.';if(v.rangeUnderflow)return 'Informe um valor a partir de '+field.getAttribute('min')+'.';if(v.rangeOverflow)return 'Informe um valor até '+field.getAttribute('max')+'.';if(v.stepMismatch)return 'Confira o formato e as casas decimais.';if(v.tooLong)return 'Reduza o texto ao limite indicado.';return 'Confira o formato deste campo.'}
function annotate(field:Control,prefix:string){
 let node=annotations.get(field)
 if(!field.willValidate||valid(field)){field.removeAttribute('aria-invalid');if(node){field.setAttribute('aria-describedby',(field.getAttribute('aria-describedby')??'').split(' ').filter(id=>id!==node!.id).join(' '));node.remove();annotations.delete(field)}return false}
 if(!node){node=document.createElement('span');node.className='field-error';node.id=prefix+'-error-'+crypto.randomUUID();(field.closest('label')??field).insertAdjacentElement('afterend',node);annotations.set(field,node);owners.set(node,field)}
 node.textContent=messageOf(field);field.setAttribute('aria-invalid','true');const ids=new Set((field.getAttribute('aria-describedby')??'').split(' ').filter(Boolean));ids.add(node.id);field.setAttribute('aria-describedby',[...ids].join(' '));return true
}
export function revealField(field:HTMLElement){
 let p=field.parentElement;while(p){if(p instanceof HTMLDetailsElement)p.open=true;p=p.parentElement}
 field.dispatchEvent(new CustomEvent('hub:reveal-field',{bubbles:true,detail:{field}}))
 requestAnimationFrame(()=>{if(field.isConnected){field.focus();field.scrollIntoView({block:'center',behavior:'auto'})}})
}
/** Native constraints; annotation nodes never contain values or enter the payload.
 * Collapsed controls remain mounted. Inapplicable controls must be removed or
 * disabled by the owning workflow, which also owns null/omission semantics. */
export function WorkflowForm({children,onSubmit,onInputCapture,onChangeCapture,onBlurCapture,onReset,...props}:ComponentProps<'form'>){
 const prefix=useId(),ref=useRef<HTMLFormElement>(null),[errors,setErrors]=useState<Control[]>([])
 useLayoutEffect(()=>{const form=ref.current;if(!form)return;if(!form.dataset.edited)baselines.set(form,fingerprint(form));form.querySelectorAll<HTMLElement>('.field-error').forEach(node=>{const f=owners.get(node);if(!f?.isConnected||f.form!==form||!f.willValidate){if(f){f.setAttribute('aria-describedby',(f.getAttribute('aria-describedby')??'').split(' ').filter(id=>id!==node.id).join(' '));f.removeAttribute('aria-invalid');annotations.delete(f)}node.remove();owners.delete(node)}});setErrors(previous=>{const next=previous.filter(f=>f.isConnected&&f.form===form&&f.willValidate&&!valid(f));return next.length===previous.length?previous:next})})
 function edit(e:FormEvent<HTMLFormElement>){e.currentTarget.dataset.edited='true';const target=e.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement||target instanceof HTMLTextAreaElement))return;queueMicrotask(()=>{if(!target.isConnected)return;if(target.getAttribute('aria-invalid')==='true'){annotate(target,prefix);setErrors(previous=>previous.filter(f=>f.isConnected&&f.willValidate&&!valid(f)))}})}
 return <form {...props} ref={ref} className={['workflow-form',props.className].filter(Boolean).join(' ')} noValidate onInputCapture={e=>{edit(e);onInputCapture?.(e)}} onChangeCapture={e=>{edit(e);onChangeCapture?.(e)}} onBlurCapture={e=>{const f=e.target;if(f instanceof HTMLInputElement||f instanceof HTMLSelectElement||f instanceof HTMLTextAreaElement)annotate(f,prefix);onBlurCapture?.(e)}} onReset={e=>{delete e.currentTarget.dataset.edited;setErrors([]);controls(e.currentTarget).forEach(f=>{f.removeAttribute('aria-invalid');const node=annotations.get(f);if(node){f.setAttribute('aria-describedby',(f.getAttribute('aria-describedby')??'').split(' ').filter(id=>id!==node.id).join(' '));node.remove();owners.delete(node)}annotations.delete(f)});onReset?.(e)}} onSubmit={e=>{
  const invalid=controls(e.currentTarget).filter(f=>annotate(f,prefix));setErrors(invalid)
  if(invalid.length){e.preventDefault();invalid[0].dispatchEvent(new Event('invalid',{cancelable:true}));revealField(invalid[0]);return}
  onSubmit?.(e)
 }}>
  {!!errors.length&&<div className="form-errors" role="alert"><strong>Confira {errors.length===1?'o campo indicado':errors.length+' campos indicados'} antes de salvar. A primeira pendência foi aberta.</strong><ul>{errors.map(f=><li key={annotations.get(f)?.id}><button type="button" className="text-button" onClick={()=>revealField(f)}>{labelOf(f)}: {messageOf(f)}</button></li>)}</ul></div>}
  {children}
 </form>
}
