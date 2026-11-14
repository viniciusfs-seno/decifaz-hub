import {active, dateLabel, grade, money, overdue, pending, type Data} from './domain.ts'

export function reportRecords(data: Data) {
 const leads = new Map(data.leads.map(lead => [lead.id, lead.name]))
 const triages = new Map(data.triages.map(triage => [triage.leadId, triage]))
 const leadRow = (lead: Data['leads'][number]) => ({id:lead.id, leadId:lead.id, title:lead.name, detail:lead.stage})
 const linkedRow = (row: {id:string; leadId:string}, title:string, detail:string) => ({
  ...row, title, detail:[leads.get(row.leadId), detail].filter(Boolean).join(' · '),
 })
 return {
  leads: data.leads.map(leadRow),
  qualifying: data.leads.filter(lead=>['Identificado','Em pesquisa'].includes(lead.stage)).map(leadRow),
  priority: data.leads.filter(lead=>active(lead.stage)&&grade(triages.get(lead.id))?.label==='A').map(leadRow),
  meetings: data.meetings.filter(row=>row.state==='Agendada').map(row=>linkedRow(row,'Reunião comercial',dateLabel(row.date))),
  proposals: data.proposals.filter(row=>row.sentAt||['Enviada','Negociação','Aceita','Recusada','Expirada'].includes(row.status)).map(row=>linkedRow(row,row.title,row.status)),
  negotiations: data.leads.filter(lead=>lead.stage==='Negociação').map(leadRow),
  won: data.leads.filter(lead=>lead.stage==='Ganho').map(leadRow),
  conversion: data.leads.filter(lead=>lead.stage==='Ganho'||lead.stage==='Perdido').map(leadRow),
  pending: data.activities.filter(pending).map(row=>linkedRow(row,row.title,dateLabel(row.due))),
  overdue: data.activities.filter(overdue).map(row=>linkedRow(row,row.title,dateLabel(row.due))),
  projects: data.projects.filter(row=>row.status==='Em andamento').map(row=>linkedRow(row,row.title,row.stage)),
  expected: data.finance.filter(row=>row.kind==='Receita'&&row.state==='Previsto').map(row=>linkedRow(row,row.title,money(row.amount))),
  received: data.finance.filter(row=>row.kind==='Receita'&&row.state==='Realizado').map(row=>linkedRow(row,row.title,money(row.amount))),
 }
}
export type ReportMetric = keyof ReturnType<typeof reportRecords>
