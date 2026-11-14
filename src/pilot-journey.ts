import type { SupabaseClient } from '@supabase/supabase-js'
import { day, emptyLead, type Lead, type Meeting, type Stage, type Triage } from './domain'

type Profile = Partial<Pick<Lead, 'region' | 'address' | 'instagram' | 'website' | 'whatsapp' | 'other' | 'services' | 'owner' | 'next' | 'due' | 'needs'>>
export type PilotLead = {id:string; name:string; segment:string; city:string; notes:string; stage:Stage; profile:Profile}
export const leadColumns = 'id,name,segment,city,notes,stage,profile'
export type TriageRow = {lead_id:string; record:Omit<Triage,'leadId'|'scores'|'completed'>; scores:Triage['scores']; completed:boolean}
type MeetingRow = {id:string; lead_id:string; meeting_on:string; state:Meeting['state']; record:Omit<Meeting,'id'|'leadId'|'date'|'state'>}
export type PilotMetrics = {funnel:Partial<Record<Stage,number>>; priorities:Partial<Record<'A'|'B'|'C',number>>; scheduled:number; diagnosed:number; pending:number; overdue:number}

export function fullLead({profile,...lead}:PilotLead):Lead {
 const {region,address,instagram,website,whatsapp,other,services,owner,next,due,needs}=profile
 return {...emptyLead(owner),...lead,region:region??'',address:address??'',instagram:instagram??'',website:website??'',
  whatsapp:whatsapp??'',other:other??'',services:services??[],next:next??'',due:due??'',needs:needs??''}
}

export function fullTriage(row:TriageRow):Triage {
 return {...row.record,leadId:row.lead_id,scores:row.scores,completed:row.completed}
}

export async function loadMeetings(client:SupabaseClient, workspace:string, lead:string) {
 const {data,error}=await client.from('hub_meetings').select('id,lead_id,meeting_on,state,record')
  .eq('workspace_id',workspace).eq('lead_id',lead).order('meeting_on',{ascending:false}).returns<MeetingRow[]>()
 return {data:data?.map((row):Meeting=>({...row.record,id:row.id,leadId:row.lead_id,date:row.meeting_on,state:row.state})),error}
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
 const {id,leadId,date,state,...record}=meeting
 return client.rpc('hub_save_meeting',{
  p_workspace:workspace,p_lead:leadId,p_id:id,p_date:date,p_state:state,p_record:record,
  p_follow_due:follow?record.due:null,p_advance:advance,
 })
}
