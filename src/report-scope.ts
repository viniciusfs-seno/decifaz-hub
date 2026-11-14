import {type Data} from './domain.ts'

export type ReportFilters = {
 from: string
 to: string
 owner: string
 segment: string
 region: string
 origin: string
}

export function reportScope(data: Data, filters: ReportFilters): Data {
 const {from, to, owner, segment, region, origin} = filters
 if (!from && !to && !owner && !segment && !region && !origin) return data

 const leads = data.leads.filter(lead =>
  (!from || lead.created >= from) && (!to || lead.created <= to) &&
  (!owner || lead.owner === owner) && (!segment || lead.segment === segment) &&
  (!region || lead.region === region) && (!origin || lead.origin === origin),
 )
 const leadIds = new Set(leads.map(lead => lead.id))
 const projects = data.projects.filter(project => leadIds.has(project.leadId))
 const projectIds = new Set(projects.map(project => project.id))

 return {
  ...data,
  leads,
  projects,
  triages: data.triages.filter(triage => leadIds.has(triage.leadId)),
  meetings: data.meetings.filter(meeting => leadIds.has(meeting.leadId)),
  proposals: data.proposals.filter(proposal => leadIds.has(proposal.leadId)),
  activities: data.activities.filter(activity => activity.projectId ? projectIds.has(activity.projectId) : leadIds.has(activity.leadId)),
  finance: data.finance.filter(entry => entry.projectId ? projectIds.has(entry.projectId) : leadIds.has(entry.leadId)),
 }
}

export function previousRange(from:string, to:string) {
 if (!from || !to || from > to) return null
 const start = Date.parse(from+'T00:00:00Z')
 const end = Date.parse(to+'T00:00:00Z')
 const oneDay = 86_400_000
 return {
  from:new Date(start-(end-start+oneDay)).toISOString().slice(0,10),
  to:new Date(start-oneDay).toISOString().slice(0,10),
 }
}
