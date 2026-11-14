import {useState} from 'react'
import {money,uid,type Finance,type Project,type Proposal} from './domain'
import {Dialog,Field,Form} from './ui'

export function ReceivableEditor({project,proposal,save,close}:{project:Project;proposal:Proposal;save:(entry:Finance)=>string|undefined;close:()=>void}){
 const kinds=[...(proposal.setup>0?['Implantação']:[]),...(proposal.monthly>0?['Mensalidade']:[])]
 const [kind,setKind]=useState(kinds[0]??'')
 const [due,setDue]=useState('')
 const [period,setPeriod]=useState('')
 const [error,setError]=useState('')
 const amount=kind==='Implantação'?proposal.setup:proposal.monthly
 return <Dialog title="Prever recebimento" subtitle={project.title+' · proposta v'+proposal.version} onClose={close}><Form label="Salvar previsão" onClose={close} error={error} onSave={()=>{
  const origin={proposalId:proposal.id,kind:kind as 'Implantação'|'Mensalidade',period:kind==='Mensalidade'?period:''}
  const issue=save({id:uid(),leadId:project.leadId,projectId:project.id,title:kind+' · '+project.title+(origin.period?' · '+origin.period.split('-').reverse().join('/') :''),kind:'Receita',amount,due,paid:'',state:'Previsto',recurring:false,origin})
  if(issue)setError(issue)
  else close()
 }}><Field label="Componente da proposta" options={kinds} required value={kind} on={setKind}/><p>Valor aprovado: <b>{money(amount)}</b></p>{kind==='Mensalidade'&&<Field label="Competência" type="month" required value={period} on={setPeriod}/>}<Field label="Vencimento acordado" type="date" required value={due} on={setDue}/><p className="muted">Cada previsão é registrada individualmente. A baixa é feita no Financeiro quando o valor for recebido.</p></Form></Dialog>
}
