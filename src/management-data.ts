import type {Data} from './domain.ts'
import type {SharedProject} from './pilot-projects.tsx'
import type {SharedActivity} from './shared-operational.ts'
import type {Forecast,Receipt} from './shared-finance-metrics.ts'
import {proposalVersions} from './proposal-rules.ts'
export type ManagementFilter={from:string;to:string;owner:string;stage:string}
export type ManagementRow={id:string;lead:string;project?:string;title:string;date:string;owner:string;stage:string;status:string;amount?:number}
export const weekStart=(date:string)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return d.toISOString().slice(0,10)}
const localDate=(s:string)=>s.includes('T')?new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date(s)):s.slice(0,10)
export const metricLabels={funnel:'Funil atual da coorte',conversion:'Conversão · Ganho / (Ganho + Perdido)',meetings:'Reuniões no período',proposals:'Propostas enviadas',pending:'Pendências por vencimento',deliveries:'Entregas previstas',delivered:'Entregas realizadas',support:'Suporte por vencimento',forecast:'Receita prevista',received:'Receita realizada'}
export type Metric=keyof typeof metricLabels
export function managementData(data:Data,projects:SharedProject[],tasks:SharedActivity[],forecasts:Forecast[],receipts:Receipt[],financial:boolean,filter:ManagementFilter){
 const groups:Record<Metric,ManagementRow[]>={funnel:[],conversion:[],meetings:[],proposals:[],pending:[],deliveries:[],delivered:[],support:[],forecast:[],received:[]}
 const inPeriod=(date:string)=>!!date&&(!filter.from||date>=filter.from)&&(!filter.to||date<=filter.to)
 const row=(leadId:string,id:string,title:string,date:string,owner:string,status:string,project?:string,amount?:number):ManagementRow=>({lead:leadId,id,title,date,owner,stage:data.leads.find(l=>l.id===leadId)?.stage??'',status,project,amount})
 const include=(r:ManagementRow)=>inPeriod(r.date)&&(!filter.owner||r.owner===filter.owner)&&(!filter.stage||r.stage===filter.stage)
 for(const l of data.leads){const r=row(l.id,l.id,l.name,localDate(l.created),l.owner,l.stage);if(include(r)){groups.funnel.push(r);if(['Ganho','Perdido'].includes(l.stage))groups.conversion.push(r)}}
 for(const m of data.meetings){const r=row(m.leadId,m.id,'Reunião · '+m.participants,m.date,m.owner,m.state);if(include(r))groups.meetings.push(r)}
 const versions=proposalVersions(data.proposals)
 for(const p of versions){const r=row(p.leadId,p.id,p.title,p.sentAt??'',data.leads.find(l=>l.id===p.leadId)?.owner??'',p.status);if(include(r))groups.proposals.push(r)}
 for(const t of tasks){const r=row(t.lead_id,t.id,t.title,t.due_on??'',t.owner,t.status,t.project_proposal_id??undefined);if(include(r)){if(t.support)groups.support.push(r);if(!['Concluída','Cancelada'].includes(t.status))groups.pending.push(r)}}
 for(const p of projects){const r=row(p.lead_id,p.proposal_id,p.approved.title,p.due_on??'',p.owner,p.status,p.proposal_id);if(include(r))groups.deliveries.push(r);const delivered={...r,date:localDate(p.delivery?.acceptedAt??'')};if(include(delivered))groups.delivered.push(delivered)}
 if(financial){for(const [list,key] of [[forecasts,'forecast'],[receipts.filter(r=>!r.reversed_at),'received']] as const){for(const f of list){const p=projects.find(p=>p.proposal_id===f.proposal_id);if(!p)continue;const r=row(p.lead_id,f.proposal_id+'-'+f.kind+'-'+f.period+('id' in f?'-'+f.id:''),p.approved.title+' · '+f.kind,'received_on' in f?f.received_on:f.due_on,p.owner,key==='forecast'?'Previsto':'Realizado',p.proposal_id,f.amount);if(include(r))groups[key].push(r)}}}
 return {groups,won:groups.conversion.filter(r=>r.status==='Ganho').length,denominator:groups.conversion.length,undatedProposals:versions.filter(p=>!p.sentAt).length}
}
const csvCell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"'
export function managementCsv(result:ReturnType<typeof managementData>,filter:ManagementFilter,financial:boolean){
 const rows:unknown[][]=[['Indicador','Registro','Responsável','Etapa atual','Situação','Data de referência','Valor (R$)','De','Até','Filtro responsável','Filtro etapa']]
 for(const [key,items] of Object.entries(result.groups))if(financial||!['forecast','received'].includes(key))for(const r of items)rows.push([metricLabels[key as Metric],r.title,r.owner,r.stage,r.status,r.date,r.amount?.toFixed(2).replace('.',',')??'',filter.from,filter.to,filter.owner,filter.stage])
 rows.push(['Conversão: ganhos',result.won,'','','','','',filter.from,filter.to,filter.owner,filter.stage],['Conversão: denominador Ganho + Perdido',result.denominator])
 return '\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n'
}
