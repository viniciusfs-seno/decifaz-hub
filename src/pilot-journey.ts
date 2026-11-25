import {allRows} from './load-all'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {CommercialProfile} from './commercial-classifications'
import { day, emptyLead, type Lead, type Meeting, type Proposal, type Stage, type Triage } from './domain'

type Profile = Partial<Pick<Lead, 'contact' | 'contactInfo' | 'origin' | 'verification' | 'noDueReason' | 'region' | 'address' | 'instagram' | 'website' | 'whatsapp' | 'other' | 'services' | 'owner' | 'next' | 'due' | 'needs'>> & CommercialProfile
export type PilotLead = {id:string; name:string; segment:string; city:string; notes:string; stage:Stage; profile:Profile; created_at:string;revision?:number}
export const leadColumns = 'id,name,segment,city,notes,stage,profile,created_at,revision'
export type TriageRow = {lead_id:string; record:Omit<Triage,'leadId'|'scores'|'completed'>; scores:Triage['scores']; completed:boolean}
type MeetingRow = {project_id:string|null;contract_id:string|null;revision:number;id:string; lead_id:string; meeting_on:string; state:Meeting['state']; record:Omit<Meeting,'id'|'leadId'|'date'|'state'>}
export type PilotMetrics = {funnel:Partial<Record<Stage,number>>; priorities:Partial<Record<'A'|'B'|'C',number>>; scheduled:number; diagnosed:number; pending:number; overdue:number}

export function fullLead({profile,created_at,...lead}:PilotLead):Lead {
 const {contact,contactInfo,origin,verification,noDueReason,region,address,instagram,website,whatsapp,other,services,owner,next,due,needs}=profile
 return {...emptyLead(owner),...lead,contact:contact??'',contactInfo:contactInfo??'',origin:origin??'',verification:verification??'',noDueReason:noDueReason??'',created:created_at,region:region??'',address:address??'',instagram:instagram??'',website:website??'',
  whatsapp:whatsapp??'',other:other??'',services:services??[],next:next??'',due:due??'',needs:needs??''}
}

export function fullTriage(row:TriageRow):Triage {
 return {...row.record,leadId:row.lead_id,scores:row.scores,completed:row.completed}
}

export async function loadMeetings(client:SupabaseClient, workspace:string, lead?:string) {
 const query=client.from('hub_meetings').select('id,lead_id,meeting_on,state,record,project_id,contract_id,revision')
  .eq('workspace_id',workspace)
 const {data,error}=await allRows((lead?query.eq('lead_id',lead):query).order('meeting_on',{ascending:false}).order('id').returns<MeetingRow[]>())
 return {data:data?.map((row):Meeting=>({...row.record,id:row.id,leadId:row.lead_id,date:row.meeting_on,state:row.state,projectId:row.project_id??undefined,contractId:row.contract_id??undefined,revision:row.revision})),error}
}

export async function loadMetrics(client:SupabaseClient, workspace:string) {
 const {data,error}=await client.rpc('hub_dashboard',{p_workspace:workspace,p_today:day()})
 return {data:data as PilotMetrics|null,error}
}

export function saveTriage(client:SupabaseClient, workspace:string, triage:Triage, lead:Lead) {
 const {leadId,scores,completed,...record}=triage
 const {region,address,instagram,website,whatsapp,other,services,owner,next,due}=lead
 return client.rpc('hub_save_triage',{
  p_workspace:workspace,p_lead:leadId,p_scores:scores,p_completed:completed,p_record:record,
  p_name:lead.name.trim(),p_segment:lead.segment.trim(),p_city:lead.city.trim(),p_qualify:lead.stage==='Qualificado',
  p_profile:{region,address,instagram,website,whatsapp,other,services,...(completed?{owner,next,due}:{})},
 })
}

export function saveMeeting(client:SupabaseClient, workspace:string, meeting:Meeting, follow:boolean, advance:boolean) {
 const {id,leadId,date,state,projectId:_projectId,contractId:_contractId,revision:_revision,...record}=meeting
 return client.rpc('hub_save_meeting',{
  p_workspace:workspace,p_lead:leadId,p_id:id,p_date:date,p_state:state,p_record:record,
  p_follow_due:follow?record.due:null,p_advance:advance,
 })
}

type ProposalRow = {id:string; lead_id:string; series_id:string; version:number; meeting_id:string|null; status:string;
 record:Omit<Proposal,'id'|'leadId'|'seriesId'|'version'|'meetingId'|'status'>}

export async function loadProposals(client:SupabaseClient, workspace:string, series?:string) {
 const query=client.from('hub_proposals_visible').select('id,lead_id,series_id,version,meeting_id,status,record').eq('workspace_id',workspace)
 const {data,error}=await allRows((series?query.eq('series_id',series):query).order('version',{ascending:false}).order('id').returns<ProposalRow[]>())
 return {error,data:data?.map((row):Proposal=>({...row.record,id:row.id,leadId:row.lead_id,seriesId:row.series_id,
  version:row.version,meetingId:row.meeting_id??undefined,status:row.status}))}
}

export function saveProposal(client:SupabaseClient, workspace:string, proposal:Proposal, decision?:{status:string;date:string;note:string}, financial=true) {
 const {id,leadId,seriesId,version,meetingId,title,scope,validity,setup,monthly,services,terms}=proposal
 return client.rpc('hub_save_proposal',{w:workspace,l:leadId,p:id,s:seriesId??id,v:version,m:meetingId||null,
  body:decision?null:{title,scope,validity,services,...(financial?{setup,monthly,terms}:{})},decision:decision?.status??null,
  occurred:decision?.date??null,evidence:decision?.note??null})
}
