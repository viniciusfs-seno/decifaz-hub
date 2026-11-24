import {useEffect,useId,useRef,useState,type ReactNode} from 'react'
import {ChevronDown} from 'lucide-react'

/** Secondary detail stays available without competing with the current task. */
export function Disclosure({title,description,count,defaultOpen=false,children}:{title:string;description?:string;count?:number;defaultOpen?:boolean;children:ReactNode}){
 const [open,setOpen]=useState(defaultOpen)
 const id=useId()
 return <details className="portal-disclosure" open={open} onToggle={e=>setOpen(e.currentTarget.open)} onInvalidCapture={e=>{e.currentTarget.open=true;setOpen(true)}}>
  <summary aria-expanded={open} aria-controls={id}><span><strong>{title}</strong>{description&&<small> {description}</small>}</span>{count!==undefined&&<span className="disclosure-count"> {count}</span>}<ChevronDown size={18} aria-hidden="true"/></summary>
  <div id={id} className="disclosure-content">{children}</div>
 </details>
}

export type RecordSection={id:string;label:string;content:ReactNode;count?:number}
/** Optional, still applicable fields stay mounted and stay in the draft. */
export function SecondaryFields({title,children,defaultOpen=false}:{title:string;children:ReactNode;defaultOpen?:boolean}){
 const [open,setOpen]=useState(defaultOpen),id=useId(),root=useRef<HTMLElement>(null)
 useEffect(()=>{const el=root.current;const reveal=()=>setOpen(true);el?.addEventListener('hub:reveal-field',reveal);return()=>el?.removeEventListener('hub:reveal-field',reveal)},[])
 return <section className="secondary-fields" ref={root}><button type="button" className="secondary-trigger" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}>{title}<ChevronDown size={18} aria-hidden="true"/></button><div id={id} hidden={!open}>{children}</div></section>
}
export function DraftRecovery({restore,children}:{restore:()=>void;children?:ReactNode}){return <aside className="draft-recovery"><p>Seu rascunho anterior foi preservado. Os campos mostram o registro atual para conferir o conflito.</p>{children}<button type="button" className="button" onClick={e=>{const form=e.currentTarget.closest('form');if(form)form.dataset.edited='true';restore()}}>Recuperar meu rascunho para revisar</button><p className="view-hint">Recuperar preenche a edição; salvar exige uma nova decisão e continua sujeito à revisão no servidor.</p></aside>}
/** Keep panels mounted: changing context must not erase an unfinished form. */
export function RecordTabs({sections,initial,change}:{sections:RecordSection[];initial?:string;change?:(id:string)=>void}){
 const [selected,setSelected]=useState(initial??sections[0]?.id),prefix=useId(),buttons=useRef<(HTMLButtonElement|null)[]>([]),root=useRef<HTMLDivElement>(null)
 useEffect(()=>{const el=root.current;const reveal=(event:Event)=>{const field=(event as CustomEvent<{field:HTMLElement}>).detail.field,panel=field.closest<HTMLElement>('[role=tabpanel]');if(panel?.parentElement===el){const section=sections.find(s=>prefix+'-panel-'+s.id===panel.id);if(section)setSelected(section.id)}};el?.addEventListener('hub:reveal-field',reveal);return()=>el?.removeEventListener('hub:reveal-field',reveal)},[sections,prefix])
 const active=sections.some(s=>s.id===selected)?selected:sections[0]?.id
 function choose(id:string){setSelected(id);change?.(id)}
 return <div className="record-workspace" ref={root}>
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
