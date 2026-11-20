import {useEffect,useId,useRef,type ReactNode,type FormEvent} from 'react'
import {X,Inbox} from 'lucide-react'
import {grade,type Triage} from './domain'
import {useInvalidField} from './form-guidance'
export type FieldProps={label:string; value:string|number; on:(v:string)=>void; required?:boolean; type?:string; options?:readonly string[]; placeholder?:string; min?:number; step?:string}
export function Field({label,value,on,required,type='text',options,placeholder,min,step}:FieldProps){
 return <label className="field"><span>{label}{required && <b> *</b>}</span>{options?<select value={value} onChange={e=>on(e.target.value)} required={required}><option value="">Selecionar</option>{options.map(x=><option key={x}>{x}</option>)}</select>:type==='area'?<textarea value={value} onChange={e=>on(e.target.value)} required={required} placeholder={placeholder}/>:<input type={type} value={value} onChange={type==='date'?undefined:e=>on(e.target.value)} onInput={type==='date'?e=>on(e.currentTarget.value):undefined} required={required} placeholder={placeholder} min={min} step={step}/>}</label>
}
export function Choices({items,value,on}:{items:string[];value:string[];on:(v:string[])=>void}){
 return <div className="choices">{items.map(item=><label key={item} className={value.includes(item)?'checked':''}><input type="checkbox" checked={value.includes(item)} onChange={e=>on(e.target.checked?[...value,item]:value.filter(x=>x!==item))}/>{item}</label>)}</div>
}
export function Tag({children,tone='neutral'}:{children:ReactNode;tone?:string}){return <span className={'tag '+tone}>{children}</span>}
export function Priority({triage}:{triage?:Triage}){const p=grade(triage);return p?<Tag tone={p.label==='A'?'green':p.label==='B'?'amber':'blue'}>{p.label} · {p.total}/15</Tag>:<Tag>{triage?'Parcial · '+triage.scores.reduce<number>((sum,n)=>sum+(n??0),0)+'/15 · '+triage.scores.filter(n=>n!==null).length+'/7 critérios':'Sem triagem'}</Tag>}
export function Empty({title='Nenhum registro encontrado',detail}:{title?:string;detail?:string}){return <div className="empty"><Inbox size={25}/><strong>{title}</strong>{detail&&<span>{detail}</span>}</div>}
export function Page({title,description,actions,children}:{title:string;description:string;actions?:ReactNode;children:ReactNode}){return <><div className="page-heading"><div><h1>{title}</h1><p>{description}</p></div>{actions&&<div className="actions">{actions}</div>}</div>{children}</>}
export function Dialog({title,subtitle,onClose,children,wide=false}:{title:string;subtitle?:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null)
 const titleId=useId()
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,dialog=ref.current
  dialog?.showModal()
  return ()=>{dialog?.close();if(previous?.isConnected)previous.focus()}
 },[])
 return <dialog ref={ref} aria-labelledby={titleId} className={wide?'wide':''} onCancel={e=>{e.preventDefault();onClose()}}><div className="dialog-head"><div><h2 id={titleId}>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon" aria-label="Fechar" onClick={onClose}><X size={20}/></button></div>{children}</dialog>
}
export function Form({onSave,onClose,children,error,label='Salvar',busy=false,guided=false}:{onSave:()=>void;onClose:()=>void;children:ReactNode;error?:string;label?:string;busy?:boolean;guided?:boolean}){
 const validation=useInvalidField()
 const submit=(e:FormEvent)=>{e.preventDefault();onSave()}
 return <form aria-busy={busy} onInvalidCapture={guided?validation.invalid:undefined} onInputCapture={guided?validation.changed:undefined} onSubmit={submit}><div className="dialog-body">{children}{(error||(guided&&validation.validation))&&<p role="alert" className="error">{error||validation.validation}</p>}</div><div className="dialog-foot"><button type="button" className="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy}>{label}</button></div></form>
}
