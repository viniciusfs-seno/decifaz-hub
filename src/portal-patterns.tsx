import {useId,useRef,useState,type ReactNode} from 'react'
import {ChevronDown} from 'lucide-react'

/** Secondary detail stays available without competing with the current task. */
export function Disclosure({title,description,count,defaultOpen=false,children}:{title:string;description?:string;count?:number;defaultOpen?:boolean;children:ReactNode}){
 const [open,setOpen]=useState(defaultOpen)
 return <details className="portal-disclosure" open={open} onToggle={e=>setOpen(e.currentTarget.open)} onInvalidCapture={e=>{e.currentTarget.open=true;setOpen(true)}}>
  <summary><span><strong>{title}</strong>{description&&<small> {description}</small>}</span>{count!==undefined&&<span className="disclosure-count"> {count}</span>}<ChevronDown size={18} aria-hidden="true"/></summary>
  <div className="disclosure-content">{children}</div>
 </details>
}

export type RecordSection={id:string;label:string;content:ReactNode;count?:number}
/** Keep panels mounted: changing context must not erase an unfinished form. */
export function RecordTabs({sections,initial,change}:{sections:RecordSection[];initial?:string;change?:(id:string)=>void}){
 const [selected,setSelected]=useState(initial??sections[0]?.id),prefix=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([])
 const active=sections.some(s=>s.id===selected)?selected:sections[0]?.id
 function choose(id:string){setSelected(id);change?.(id)}
 return <div className="record-workspace">
  <div role="tablist" aria-label="Seções da ficha" className="record-tabs">{sections.map((section,i)=><button type="button" role="tab" key={section.id} id={prefix+'-tab-'+section.id} aria-controls={prefix+'-panel-'+section.id} aria-selected={active===section.id} tabIndex={active===section.id?0:-1} ref={el=>{buttons.current[i]=el}} onClick={()=>choose(section.id)} onKeyDown={e=>{
   if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return
   e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?sections.length-1:(i+(e.key==='ArrowRight'?1:-1)+sections.length)%sections.length
   choose(sections[next].id);buttons.current[next]?.focus()
  }}>{section.label}{section.count!==undefined&&<span>{section.count}</span>}</button>)}</div>
  {sections.map(section=><section key={section.id} id={prefix+'-panel-'+section.id} role="tabpanel" aria-labelledby={prefix+'-tab-'+section.id} tabIndex={0} hidden={active!==section.id} className="record-panel">{section.content}</section>)}
 </div>
}

export function RecordSummary({items}:{items:{label:string;value:ReactNode;tone?:string}[]}){
 return <dl className="record-summary">{items.map(item=><div key={item.label} data-tone={item.tone}><dt>{item.label}</dt><dd>{item.value||'Não informado'}</dd></div>)}</dl>
}
