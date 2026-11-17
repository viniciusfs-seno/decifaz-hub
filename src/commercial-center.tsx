import {useEffect,useState} from 'react'
import {useViewState} from './view-state'
import type {SupabaseClient} from '@supabase/supabase-js'
import {dateLabel,day,type Lead,type Meeting} from './domain'
import {Empty,Field,Page,Tag} from './ui'

type Task={id:string;title:string;owner:string;due_on:string|null;status:string;lead_id:string;project_proposal_id:string|null}
type Entry={key:string;title:string;owner:string;due:string;status:string;lead:string;project?:string|null}

export function CommercialCenter({client,workspace,revision,leads,meetings,openLead,openProject}:{
 client:SupabaseClient;workspace:string;revision:number;leads:Lead[];meetings:Meeting[];
 openLead:(id:string)=>void;openProject:(id:string)=>void
}){
 const [tasks,setTasks]=useState<Task[]>()
 const [error,setError]=useState(false)
 const [owner,setOwner]=useViewState('central-owner','')
 const [until,setUntil]=useViewState('central-until','')
 const [status,setStatus]=useViewState('central-status','')
 useEffect(()=>{
  let current=true
  void client.from('hub_activities').select('id,title,owner,due_on,status,lead_id,project_proposal_id')
   .eq('workspace_id',workspace).order('due_on').order('id').returns<Task[]>()
   .then(({data,error})=>{if(current){setTasks(data??[]);setError(Boolean(error))}})
  return ()=>{current=false}
 },[client,workspace,revision])
 const entries:Entry[]=[
  ...(tasks??[]).map(t=>({key:'task-'+t.id,title:t.title,owner:t.owner,due:t.due_on??'',status:t.status,lead:t.lead_id,project:t.project_proposal_id})),
  ...meetings.map(m=>({key:'meeting-'+m.id,title:'Reunião · '+m.participants,owner:m.owner,due:m.date,status:m.state,lead:m.leadId})),
  ...leads.filter(l=>l.next&&!['Ganho','Perdido','Arquivado'].includes(l.stage)).map(l=>({key:'lead-'+l.id,title:l.next,owner:l.owner,due:l.due,status:'Próximo contato',lead:l.id})),
 ]
 const owners=[...new Set(entries.map(item=>item.owner).filter(Boolean))].sort()
 const statuses=[...new Set(entries.map(item=>item.status))].sort()
 const rows=entries.filter(item=>(!owner||item.owner===owner)&&(!until||item.due&&item.due<=until)&&(!status||item.status===status))
  .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))
 const pending=['Pendente','Em andamento','Agendada','Próximo contato']
 return <Page title="Central comercial" description="Reuniões, atividades e próximos contatos do espaço.">
  <div className="toolbar">
   <Field label="Responsável" value={owner} options={owners} on={setOwner}/>
   <Field label="Situação" value={status} options={statuses} on={setStatus}/>
   <Field label="Prazo até" type="date" value={until} on={setUntil}/>
   <button type="button" className="button" onClick={()=>{setOwner('');setUntil('');setStatus('')}}>Limpar filtros</button>
  </div>
  {error?<p role="alert">Não foi possível carregar as atividades. Use Atualizar para tentar novamente.</p>:!tasks?<p role="status">Carregando central…</p>:
   rows.length?<div className="card table-wrap"><table><thead><tr><th>Item</th><th>Estabelecimento</th><th>Responsável</th><th>Data</th><th>Situação</th></tr></thead>
    <tbody>{rows.map(item=><tr key={item.key}>
     <td><button className="text-button" onClick={()=>item.project?openProject(item.project):openLead(item.lead)}>{item.title}</button></td>
     <td>{leads.find(lead=>lead.id===item.lead)?.name??'—'}</td><td>{item.owner||'—'}</td>
     <td>{dateLabel(item.due)} {item.due&&item.due<day()&&pending.includes(item.status)&&<Tag tone="rose">Atrasado</Tag>}</td>
     <td>{item.status}</td>
    </tr>)}</tbody></table></div>:<Empty title="Nenhum item no recorte"/>}
 </Page>
}
