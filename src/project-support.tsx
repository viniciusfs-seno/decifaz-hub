import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,day} from './domain'
import {Field,Page} from './ui'

export const activityStatuses=['Pendente','Em andamento','Concluída','Cancelada']
type Activity={id:string;title:string;owner:string;due_on:string|null;status:string;support:boolean;project_proposal_id:string}
type Write=(operation:()=>PromiseLike<{error:unknown;data:unknown}>)=>Promise<boolean>

export function ProjectSupport({client,workspace,revision,busy,write,project,projectName}:{
 client:SupabaseClient;workspace:string;revision:number;busy:boolean;write:Write;project?:string;projectName:(id:string)=>string
}){
 const [result,setResult]=useState<{rows:Activity[];error:boolean}>()
 const [title,setTitle]=useState('')
 const [owner,setOwner]=useState('')
 const [due,setDue]=useState(day())
 const [saving,setSaving]=useState(false)
 useEffect(()=>{
  let current=true
  const query=client.from('hub_activities').select('id,title,owner,due_on,status,support,project_proposal_id')
   .eq('workspace_id',workspace)
  void (project?query.eq('project_proposal_id',project):query.not('project_proposal_id','is',null).in('status',['Pendente','Em andamento']))
   .order('due_on').order('id').returns<Activity[]>()
   .then(({data,error})=>{if(current)setResult({rows:data??[],error:!!error})})
  return ()=>{current=false}
 },[client,workspace,project,revision])
 const content=<>
  {project&&<form className="fields" onSubmit={async event=>{
   event.preventDefault()
   if(busy||saving||!title.trim()||!owner.trim()||!due)return
   setSaving(true)
   try{if(await write(()=>client.rpc('hub_open_support',{w:workspace,p:project,t:title.trim(),o:owner.trim(),d:due})))setTitle('')}
   finally{setSaving(false)}
  }}>
   <Field label="Título do chamado" value={title} on={setTitle} required/>
   <Field label="Responsável pelo chamado" value={owner} on={setOwner} required/>
   <Field label="Prazo do chamado" type="date" value={due} on={setDue} required/>
   <button className="button" disabled={busy||saving}>Abrir chamado</button>
  </form>}
  {!result?<p role="status">Carregando atividades…</p>:result.error?<p role="alert">Não foi possível carregar as atividades.</p>:
   result.rows.length?<ul>{result.rows.map(row=><li key={row.id}>
    <b>{row.title}</b> · {row.support?'Suporte':'Pós-venda'} · {!project&&projectName(row.project_proposal_id)+' · '}
    {row.owner||'Sem responsável'} · {dateLabel(row.due_on??'')} {row.due_on&&row.due_on<day()&&activityStatuses.slice(0,2).includes(row.status)&&'· Atrasada'}
    <label>Situação de {row.title}<select value={row.status} disabled={busy||saving} onChange={async event=>{
     const status=event.target.value
     setSaving(true)
     try{if(await write(()=>client.from('hub_activities').update({status}).eq('workspace_id',workspace)
      .eq('project_proposal_id',row.project_proposal_id).eq('id',row.id).select('id').single())){
      setResult(previous=>previous&&({...previous,rows:project?previous.rows.map(item=>item.id===row.id?{...item,status}:item):
       previous.rows.filter(item=>item.id!==row.id||activityStatuses.slice(0,2).includes(status)).map(item=>item.id===row.id?{...item,status}:item)}))
     }}finally{setSaving(false)}
    }}>{activityStatuses.map(status=><option key={status}>{status}</option>)}</select></label>
   </li>)}</ul>:<p>Nenhuma atividade registrada.</p>}
 </>
 return project?<section className="dialog-body"><h3>Pós-venda e suporte</h3>{content}</section>:
  <Page title="Agenda operacional" description="Prazos e pendências de pós-venda e suporte."><section className="card panel">{content}</section></Page>
}
