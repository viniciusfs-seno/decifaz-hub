import {serializeBackup} from './backup'
import {day,emptyLead,emptyTriage,event, type Data,type Stage,type Lead} from './domain'

import {createBackupStorage} from './backup-storage'

export const browserRepository=createBackupStorage(()=>localStorage)
export function seed():Data {
 const team=['Equipe comercial','Equipe de operação']
 const examples:[string,string,string,Stage,string,number][]=[
  ['Café Brisa de Papel','Cafeteria','Aracaju','Reunião marcada','Preparar roteiro da visita',1],
  ['Ateliê Cedro Lunar','Varejo','Aracaju','Qualificado','Planejar primeiro contato',0],
  ['Bistrô Estação Inventada','Restaurante','Aracaju','Em pesquisa','Verificar presença digital',-2],
  ['Studio Maré de Giz','Serviços','São Cristóvão','Negociação','Revisar escopo com a equipe',3],
  ['Sorveteria Cometa de Açúcar','Alimentação','Aracaju','Identificado','Pesquisar canais públicos',5],
  ['Oficina Horizonte de Papel','Serviços','Nossa Senhora do Socorro','Proposta enviada','Confirmar recebimento',2],
  ['Livraria Constelação de Tinta','Varejo','Aracaju','Qualificado','Verificar responsável',4],
  ['Padaria Farol de Nuvem','Alimentação','Aracaju','Abordado','Registrar retorno',1],
  ['Espaço Jardim Imaginário','Eventos','São Cristóvão','Em pesquisa','Revisar hipóteses',3],
  ['Floricultura Lua de Papel','Varejo','Aracaju','Identificado','Pesquisar estabelecimento',6],
  ['Mercado Vila Inventada','Varejo','Aracaju','Diagnóstico realizado','Preparar escopo preliminar',4],
  ['Galeria Nuvem de Tinta','Serviços','Aracaju','Ganho','Planejar acompanhamento',6],
 ]
 const leads:Lead[]=examples.map(([name,segment,city,stage,next,delta],i)=>({...emptyLead(team[0]),id:'demo-'+i,name,segment,city,region:'Grande Aracaju',stage,next,due:day(delta),created:day(-i*2),origin:'Demonstração',demo:true,history:[event('Registro fictício para demonstração',team[0])]}))
 const triages=[0,1,3,6,7,10].map((i,index)=>({...emptyTriage(leads[i]),scores:index<3?[3,3,1,1,1,2,1]:index<5?[2,1,1,1,1,1,1]:[1,1,0,0,0,1,1],completed:true,observations:'Exemplo fictício de observação.',services:['Site institucional'],approach:'Validar a hipótese durante o contato.',updated:day()}))
 return {version:1,team,leads,triages,activities:[2,1,0,3].map((i,index)=>({id:'a'+i,leadId:leads[i].id,projectId:'',title:leads[i].next,description:'Atividade fictícia de demonstração.',kind:['Pesquisa','Contato','Reunião','Follow-up'][index],owner:team[0],due:leads[i].due,priority:index===0?'Alta':'Normal',status:'Pendente',result:''})),meetings:[{id:'m0',leadId:leads[0].id,date:day(1),participants:'Equipe comercial e responsável fictício',state:'Agendada',answers:{},checked:[],summary:'',tools:'',objections:'',budget:'',next:'',owner:team[0],due:''}],proposals:[{id:'p0',leadId:leads[5].id,title:'Presença digital',services:['Site institucional'],scope:'Escopo fictício para demonstração.',setup:1800,monthly:120,terms:'Condições ilustrativas',validity:day(14),version:1,status:'Enviada'}],projects:[],finance:[]}
}
export function exportData(data:Data){
 const url=URL.createObjectURL(new Blob([serializeBackup(data)],{type:'application/json'}))
 const a=document.createElement('a');a.href=url;a.download='decifaz-hub-demonstracao.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
