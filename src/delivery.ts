import {day,type Project} from './domain.ts'

export const deliveryChecks=[
 ['tests','Testes dos fluxos críticos concluídos'],
 ['scope','Entregáveis conferidos com o escopo aprovado'],
 ['pending','Pendências resolvidas ou acordadas com o cliente'],
] as const

export function deliveryError(project:Project,previous?:Project){
 const delivery=project.delivery
 const needsAcceptance=project.status==='Entregue'||['Entrega','Suporte'].includes(project.stage)
 const legacy=previous&&!previous.delivery&&previous.status==='Entregue'&&previous.stage===project.stage&&project.status===previous.status
 if(!needsAcceptance&&!delivery?.acceptedAt&&!delivery?.reference.trim())return
 if(legacy&&!delivery?.acceptedAt&&!delivery?.reference.trim())return
 if(!deliveryChecks.every(([key])=>delivery?.checks.includes(key))||!delivery?.reference.trim()||!delivery.acceptedAt||delivery.acceptedAt>day()){
  return 'Confirme os itens de homologação e registre a data e a evidência do aceite da entrega.'
 }
}
