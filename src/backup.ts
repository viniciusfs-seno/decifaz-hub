import {meetingLink} from './meeting-link.ts'
import {z} from 'zod'
import {stages,type Data} from './domain.ts'

const text=z.string()
const id=text.min(1)
const list=z.array(text)
const day=text.refine(value=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false
 const parsed=new Date(value+'T00:00:00Z')
 return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===value
})
const optionalDay=z.union([day,z.literal('')])
const amount=z.number().min(0)
const status=z.enum(['Pendente','Em andamento','Concluída','Cancelada'])
const source=z.object({target:z.enum(['lead','propostas','projetos','financeiro']),id,title:text})
const lead=z.object({id,name:text,segment:text,city:text,region:text,address:text,instagram:text,website:text,whatsapp:text,other:text,contact:text,contactInfo:text,origin:text,owner:text,stage:z.enum(stages),needs:text,notes:text,verification:text,next:text,due:optionalDay,noDueReason:text,services:list,created:day,demo:z.boolean().optional(),history:z.array(z.object({at:text,actor:text,text}))})
const activity=z.object({id,leadId:text,projectId:text,title:text,description:text,kind:text,owner:text,due:day,priority:text,status,result:text,completedOn:day.optional(),reviewSource:source.optional()})
const schema=z.object({
 version:z.literal(1),team:list,leads:z.array(lead),
 triages:z.array(z.object({leadId:id,presence:z.record(text,text),observations:text,reports:text,hypotheses:text,evidence:text,services:list,scores:z.array(z.number().int().nullable()).length(7),approach:text,owner:text,next:text,due:optionalDay,completed:z.boolean(),updated:optionalDay})),
 activities:z.array(activity),
 meetings:z.array(z.object({agenda:text.optional(),selectedSolutions:list.optional(),callUrl:text.refine(value=>!!meetingLink(value),'Link de reunião inválido').optional(),id,leadId:id,date:day,participants:text,state:z.enum(['Agendada','Realizada','Cancelada']),answers:z.record(text,text),checked:z.array(z.number().int()),summary:text,tools:text,objections:text,budget:text,next:text,owner:text,due:optionalDay})),
 proposals:z.array(z.object({id,leadId:id,title:text,services:list,scope:text,setup:amount,monthly:amount,terms:text,validity:day,version:z.number().int().positive(),status:text,seriesId:id.optional(),meetingId:text.optional(),sentAt:day.optional(),decisionAt:day.optional(),decisionNote:text.optional(),events:z.array(z.object({status:text,date:day,note:text})).optional()})),
 projects:z.array(z.object({id,leadId:id,proposalId:id,title:text,owner:text,stage:text,due:day,tasks:text,deliverables:text,status:text,delivery:z.object({checks:list,acceptedAt:optionalDay,reference:text,notes:text}).optional(),handoff:z.object({checks:list,reference:text,notes:text,completedAt:day.optional()}).optional(),approved:z.object({version:z.number().int().positive(),title:text,scope:text,services:list,terms:text,setup:amount,monthly:amount,acceptance:text.optional(),acceptedAt:day.optional()}).optional()})),
 finance:z.array(z.object({id,leadId:text,projectId:text,title:text,kind:z.enum(['Receita','Despesa']),amount:amount.positive(),due:day,paid:optionalDay,state:z.enum(['Previsto','Realizado']),recurring:z.boolean(),origin:z.object({proposalId:id,kind:z.enum(['Implantação','Mensalidade']),period:text}).optional()})),
 reviewClosures:z.array(z.object({week:day,closedOn:day,notes:text,actions:z.array(activity.pick({id:true,title:true,owner:true,due:true,status:true}))})).optional(),
})

export const backupLimit=5*1024*1024
export const backupSections=[
 ['leads','Leads'],['triages','Triagens'],['activities','Atividades'],['meetings','Reuniões'],['proposals','Propostas'],['projects','Projetos'],['finance','Lançamentos'],['reviewClosures','Fechamentos'],['team','Responsáveis'],
] as const

function linkIssue(data:Data){
 const leads=new Set(data.leads.map(l=>l.id))
 const projects=new Map(data.projects.map(p=>[p.id,p]))
 const proposals=new Map(data.proposals.map(p=>[p.id,p]))
 const meetings=new Map(data.meetings.map(m=>[m.id,m]))
 const finance=new Map(data.finance.map(f=>[f.id,f]))
 for(const [label,keys] of [
  ['leads',[...data.leads.map(l=>l.id)]],['triagens',data.triages.map(t=>t.leadId)],
  ['atividades',data.activities.map(a=>a.id)],['reuniões',data.meetings.map(m=>m.id)],
  ['propostas',data.proposals.map(p=>p.id)],['projetos',data.projects.map(p=>p.id)],
  ['lançamentos',data.finance.map(f=>f.id)],['fechamentos',(data.reviewClosures??[]).map(r=>r.week)],
 ] as const)if(new Set(keys).size!==keys.length)return 'Há registros duplicados em '+label+'.'
 if([...data.triages,...data.meetings,...data.proposals,...data.projects].some(row=>!leads.has(row.leadId)))return 'Há registros vinculados a um lead inexistente.'
 if(data.proposals.some(p=>p.meetingId&&meetings.get(p.meetingId)?.leadId!==p.leadId))return 'Há propostas com reunião vinculada inválida.'
 if(data.projects.some(p=>proposals.get(p.proposalId)?.leadId!==p.leadId))return 'Há projetos com proposta vinculada inválida.'
 if([...data.activities,...data.finance].some(row=>(row.leadId&&!leads.has(row.leadId))||(row.projectId&&projects.get(row.projectId)?.leadId!==row.leadId)))return 'Há atividades ou lançamentos com projeto ou lead inválido.'
 if(data.finance.some(f=>(f.state==='Realizado'&&!f.paid)||(f.origin&&projects.get(f.projectId)?.proposalId!==f.origin.proposalId)))return 'Há lançamentos com baixa ou origem inválida.'
 const targets={lead:leads,propostas:proposals,projetos:projects,financeiro:finance}
 if(data.activities.some(a=>a.reviewSource&&!targets[a.reviewSource.target].has(a.reviewSource.id)))return 'Há atividades de revisão com origem inexistente.'
 // Historical snapshots can outlive their original activity.
}

const metadataSchema=z.object({formatVersion:z.literal(1),exportedAt:z.iso.datetime()})
export type BackupMetadata=z.infer<typeof metadataSchema>

export function serializeBackup(data:Data,exportedAt=new Date().toISOString()){
 return JSON.stringify({...data,backup:{formatVersion:1,exportedAt}},null,2)
}

export function parseBackup(raw:string):{data:Data;metadata?:BackupMetadata}|{error:string}{
 if(new TextEncoder().encode(raw).length>backupLimit)return {error:'Use um arquivo JSON de até 5 MB.'}
 let json:unknown
 try{json=JSON.parse(raw.replace(/^\uFEFF/,''))}catch{return {error:'O conteúdo não é um JSON válido.'}}
 if(!json||typeof json!=='object'||!('version'in json)||json.version!==1)return {error:'Formato ou versão de backup incompatível.'}
 let metadata:BackupMetadata|undefined
 if('backup'in json){
  const parsed=metadataSchema.safeParse(json.backup)
  if(!parsed.success)return {error:'Identificação do backup inválida ou incompatível.'}
  metadata=parsed.data
 }
 const result=schema.safeParse(json)
 if(!result.success)return {error:'Dados inválidos em '+(result.error.issues[0]?.path.join('.')||'backup')+'.'}
 const error=linkIssue(result.data)
 return error?{error}:metadata?{data:result.data,metadata}:{data:result.data}
}
