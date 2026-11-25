import type {DigitalPresenceRecord} from './digital-assessment'
import type {CommercialProfile} from './commercial-classifications'
export const stages = ['Identificado','Em pesquisa','Qualificado','Contato planejado','Abordado','Reunião marcada','Diagnóstico realizado','Proposta enviada','Negociação','Ganho','Perdido','Arquivado'] as const
export type Stage = typeof stages[number]
export const solutions = ['Site institucional','Cardápio digital','Sistema de pedidos','NFC / QR Code','Automações','Painel de TV','Agendamento','Sistema sob medida']
export const criteria = [['Encaixe com as soluções',3],['Evidência da necessidade',3],['Acesso ao tomador de decisão',2],['Urgência',2],['Potencial de receita',2],['Reutilização da solução',2],['Facilidade logística',1]] as const
export const channels = ['Site','Instagram','WhatsApp Business','Cardápio digital','Sistema de pedidos','Agendamento','Outras ferramentas']
export const activityTypes = ['Pesquisa','Contato','Visita','Reunião','Follow-up','Proposta','Entrega','Cobrança','Pós-venda','Suporte']
export const script = [
 ['Apresentação e abertura','Como começou o negócio? Posso entender como funciona a rotina de vocês?'],
 ['Funcionamento do negócio','Como um cliente faz um pedido ou agendamento hoje?'],
 ['Problemas e dificuldades','Em que ponto do processo a equipe tem mais retrabalho?'],
 ['Impacto na operação','Com que frequência isso acontece e quem é afetado?'],
 ['Ferramentas atuais','O que vocês já usam? O que funciona bem e vale manter?'],
 ['Expectativas e prioridades','Se fosse resolver uma coisa neste mês, qual seria?'],
 ['Decisão e orçamento','Quem avaliaria a solução com você? Existe uma faixa de investimento em mente?'],
 ['Demonstração','Posso mostrar a parte da solução ligada ao que você descreveu? O que faria sentido aqui?'],
 ['Objeções e dúvidas','O que poderia dificultar a adoção dessa solução?'],
 ['Próximos passos','O que combinamos para o próximo contato, com quem e até quando?']
]
export type Event = {at:string; actor:string; text:string}
export type Lead = {revision?:number;commercial?:CommercialProfile;id:string; name:string; segment:string; city:string; region:string; address:string; instagram:string; website:string; whatsapp:string; other:string; contact:string; contactInfo:string; origin:string; owner:string; stage:Stage; needs:string; notes:string; verification:string; next:string; due:string; noDueReason:string; services:string[]; created:string; demo?:boolean; history:Event[]}
export type Triage = {digital?:DigitalPresenceRecord;ownerId?:string;nextActionId?:string;leadId:string; presence:Record<string,string>; observations:string; reports:string; hypotheses:string; evidence:string; services:string[]; scores:(number|null)[]; approach:string; owner:string; next:string; due:string; completed:boolean; updated:string}
export type Activity = {completedOn?:string;reviewSource?:{target:'lead'|'propostas'|'projetos'|'financeiro';id:string;title:string};id:string; leadId:string; projectId:string; title:string; description:string; kind:string; owner:string; due:string; priority:string; status:string; result:string}
export type Meeting = {projectId?:string;contractId?:string;revision?:number;agenda?:string; selectedSolutions?:string[];callUrl?:string;id:string; leadId:string; date:string; participants:string; state:'Agendada'|'Realizada'|'Cancelada'; answers:Record<number,string>; checked:number[]; summary:string; tools:string; objections:string; budget:string; next:string; owner:string; due:string}
export type Proposal = {id:string;leadId:string;title:string;services:string[];scope:string;setup:number;monthly:number;terms:string;validity:string;version:number;status:string;seriesId?:string;meetingId?:string;sentAt?:string;decisionAt?:string;decisionNote?:string;events?:{status:string;date:string;note:string}[]}
export type Project = {delivery?:{checks:string[];acceptedAt:string;reference:string;notes:string};approved?:{version:number;title:string;scope:string;services:string[];terms:string;setup:number;monthly:number;acceptance?:string;acceptedAt?:string};handoff?:{checks:string[];reference:string;notes:string;completedAt?:string};id:string;leadId:string;proposalId:string;title:string;owner:string;stage:string;due:string;tasks:string;deliverables:string;status:string}
export type Finance = {origin?:{proposalId:string;kind:'Implantação'|'Mensalidade';period:string};id:string;leadId:string;projectId:string;title:string;kind:'Receita'|'Despesa';amount:number;due:string;paid:string;state:'Previsto'|'Realizado';recurring:boolean}
export type ReviewClosure = {week:string;closedOn:string;notes:string;actions:Pick<Activity,'id'|'title'|'owner'|'due'|'status'>[]}
export type Data = {reviewClosures?:ReviewClosure[];version:1; leads:Lead[];triages:Triage[];activities:Activity[];meetings:Meeting[];proposals:Proposal[];projects:Project[];finance:Finance[];team:string[]}
export const uid = () => crypto.randomUUID()
export function day(offset=0) {
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Fortaleza'}).format(new Date())
 const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+offset)
 return date.toISOString().slice(0,10)
}
export const dateLabel = (value:string) => value ? value.slice(0,10).split('-').reverse().join('/') : '—'
export const money = (value:number) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value)
export const norm = (value:string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
export const active = (stage:Stage) => !(['Ganho','Perdido','Arquivado'] as Stage[]).includes(stage)
export const pending = (a:Activity) => a.status !== 'Concluída' && a.status !== 'Cancelada'
export const overdue = (a:Activity) => pending(a) && a.due < day()
export function grade(t?:Triage) {
 if(!t?.completed || t.scores.length!==criteria.length || t.scores.some((n,i)=>n===null || !Number.isInteger(n) || n<0 || n>criteria[i][1])) return null
 const total = t.scores.reduce<number>((sum,n)=>sum+(n??0),0)
 return {total, label:total>=11?'A':total>=7?'B':'C'}
}
export const emptyLead = (owner=''):Lead => ({id:'',name:'',segment:'',city:'',region:'',address:'',instagram:'',website:'',whatsapp:'',other:'',contact:'',contactInfo:'',origin:'',owner,stage:'Identificado',needs:'',notes:'',verification:'Não verificado',next:'',due:'',noDueReason:'',services:[],created:day(),history:[]})
export const emptyTriage = (l:Lead):Triage => ({leadId:l.id,presence:{},observations:'',reports:'',hypotheses:'',evidence:'',services:l.services,scores:criteria.map(()=>null),approach:'',owner:l.owner,next:l.next,due:l.due,completed:false,updated:''})
export const event = (text:string,actor:string):Event => ({at:new Date().toISOString(),actor,text})
export function upsert<T extends {id:string}>(items:T[], item:T) {
 return items.some(x=>x.id===item.id)?items.map(x=>x.id===item.id?item:x):[item,...items]
}
export function metrics(d:Data) {
 const stage = (s:Stage) => d.leads.filter(l=>l.stage===s).length
 const won = stage('Ganho'), lost=stage('Perdido')
 return {leads:d.leads.length,qualifying:stage('Em pesquisa')+stage('Identificado'),priority:d.leads.filter(l=>active(l.stage)&&grade(d.triages.find(t=>t.leadId===l.id))?.label==='A').length,meetings:d.meetings.filter(m=>m.state==='Agendada').length,proposals:d.proposals.filter(p=>p.sentAt||['Enviada','Negociação','Aceita','Recusada','Expirada'].includes(p.status)).length,negotiations:stage('Negociação'),won,conversion:won+lost?Math.round(won/(won+lost)*100):null,pending:d.activities.filter(pending).length,overdue:d.activities.filter(overdue).length,projects:d.projects.filter(p=>p.status==='Em andamento').length,expected:d.finance.filter(f=>f.kind==='Receita'&&f.state==='Previsto').reduce((a,b)=>a+b.amount,0),received:d.finance.filter(f=>f.kind==='Receita'&&f.state==='Realizado').reduce((a,b)=>a+b.amount,0)}
}
