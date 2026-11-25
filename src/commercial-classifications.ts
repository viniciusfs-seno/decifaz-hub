import {useEffect,useState} from 'react'
import type {SupabaseClient} from '@supabase/supabase-js'
export type Classification={kind:'segment'|'origin'|'action';id:string;label:string;parent_id:string|null;active:boolean;revision:number}
export const commercialProfileKeys=['segment_id','origin_id','origin_other','owner_id','next_action_id','next_details','postal_code','uf','municipality_id','municipality_mode','district','street','number','complement','location_url','phone_kind','phone_normalized','verification_code','verification_criteria','verification_note'] as const
export type CommercialProfile=Partial<Record<typeof commercialProfileKeys[number],string>>
export const initialClassifications:Classification[]=[
 ...[['food','Alimentação'],['tourism','Turismo'],['beauty','Beleza e Estética'],['health','Saúde e Bem-estar'],['retail','Varejo'],['education','Educação'],['professional','Serviços Profissionais'],['other','Outros']].map(([id,label])=>({kind:'segment' as const,id,label,parent_id:null,active:true,revision:0})),
 ...[['restaurant','Restaurantes','food'],['cafe','Cafeterias','food'],['lodging','Hospedagem','tourism'],['experiences','Passeios e experiências','tourism'],['salon','Salões e barbearias','beauty'],['store','Lojas','retail']].map(([id,label,parent_id])=>({kind:'segment' as const,id,label,parent_id,active:true,revision:0})),
 ...['Prospecção ativa','Indicação de cliente','Indicação de parceiro','Instagram / redes sociais','Site da Decifaz','WhatsApp espontâneo','Evento / networking','Cliente recorrente','Outros — especificar'].map((label,i)=>({kind:'origin' as const,id:['active','customer','partner','social','website','whatsapp','event','recurring','other'][i],label,parent_id:null,active:true,revision:0})),
 ...['Pesquisar empresa','Identificar decisor','Primeiro contato','Enviar apresentação','Realizar sondagem','Confirmar interesse','Agendar reunião','Levantar necessidades','Elaborar orçamento','Enviar proposta','Esclarecer dúvidas','Negociar condições','Enviar contrato','Confirmar assinatura','Agendar acompanhamento','Solicitar indicação','Outros — especificar'].map((label,i)=>({kind:'action' as const,id:['research','decision-maker','first-contact','presentation','discovery','interest','meeting','needs','quote','proposal','questions','negotiate','contract','signature','followup','referral','other'][i],label,parent_id:null,active:true,revision:0}))
]
export function useCommercialClassifications(client:SupabaseClient,workspace:string,revision=0){
 const [result,setResult]=useState<{workspace:string;items:Classification[];error:boolean}>()
 useEffect(()=>{let live=true;setResult(undefined);if(workspace)void client.rpc('hub_commercial_classifications',{w:workspace}).then(r=>{if(live)setResult({workspace,items:r.data??[],error:!!r.error})});return()=>{live=false}},[client,workspace,revision])
 return result?.workspace===workspace?result:{workspace,items:[],error:false}
}
export const verificationOptions=[['unassessed','Não avaliado'],['pending','Pendente'],['partial','Parcial'],['checked','Conferido']] as const
export const verificationChecks=[['identity','Nome e segmento conferidos'],['location','Município/localização conferidos'],['contact','Ao menos um canal de contato conferido']] as const
