import {operationalFixture,checked} from '../e2e/helpers/operational-fixture.mjs'
import {weekStart} from '../src/management-data.ts'
export async function commercialFixture(env){
 const f=await operationalFixture(env)
 const rows=await checked(f.owner.client.from('hub_solutions').select('*').eq('workspace_id',f.workspace))
 for(const [name,description,scope] of [
  ['Cardápio digital','Exemplo fictício: um cardápio simples, fácil de consultar e manter.',['Categorias e itens','Acesso por QR Code','Treinamento da equipe']],
  ['Automações','Exemplo fictício: menos tarefas repetidas no atendimento.',['Mapeamento da rotina','Automação do retorno','Acompanhamento de resultados']],
  ['Site institucional','Exemplo fictício: presença digital clara para aproximar o negócio de seus clientes.',['Apresentação do estabelecimento','Canais de contato','Página responsiva']],
 ]){const s=rows.find(s=>s.name===name);await checked(f.owner.client.rpc('hub_save_solution',{w:f.workspace,i:s.id,n:s.name,c:'Soluções digitais',d:description,items:scope,enabled:true,expected_revision:s.revision}))}
 await checked(f.admin.from('hub_triages').insert({workspace_id:f.workspace,lead_id:f.prospect,record:{presence:{},observations:'Exemplo fictício: atendimento manual observado.',reports:'Retrabalho no retorno',hypotheses:'Automatizar agendamento',evidence:'Entrevista fictícia',services:['Automações'],approach:'Demonstrar o retorno automático',owner:'Caio · fictício',next:'Validar diagnóstico',due:f.today,updated:f.today},scores:[3,3,2,2,2,2,1],completed:true}))
 await checked(f.admin.from('hub_meetings').update({record:{participants:'Gestão · fictícia',agenda:'Conhecer a rotina, mapear dificuldades e combinar próximos passos',answers:{0:'Nota interna fictícia: validar decisão com a gestão'},checked:[0,1],summary:'Diagnóstico do atendimento',tools:'Planilha manual',objections:'Priorizar treinamento',budget:'Nota interna fictícia',next:'Consolidar necessidades',owner:'Marina · fictícia',due:f.today,callUrl:'https://meet.example.invalid/sala-ficticia',selectedSolutions:['Cardápio digital','Automações']}}).eq('workspace_id',f.workspace).eq('id',f.meeting))
 const start=weekStart(f.today),previous=new Date(start+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-7)
 await checked(f.owner.client.rpc('hub_close_week',{w:f.workspace,start_on:previous.toISOString().slice(0,10),expected_revision:0,summary_text:'Semana fictícia: oportunidade qualificada e implantação em andamento.',decision_text:'Confirmar prioridades e acompanhar os primeiros resultados.',planned:[]}))
 await checked(f.owner.client.rpc('hub_close_week',{w:f.workspace,start_on:start,expected_revision:0,summary_text:'Foco da semana: da conversa ao próximo passo.',decision_text:'Validar diagnóstico de automação e preparar a entrega do cardápio.',planned:[{kind:'lead',source:f.prospect,title:'Validar prioridades da automação',owner:'Caio · fictício',due:f.today}]}))
 for(const [id,contact] of [[f.lead,'Nora · fictícia'],[f.prospect,'Rui · fictício']]){
  const existing=await checked(f.admin.from('hub_leads').select('profile').eq('workspace_id',f.workspace).eq('id',id).single())
  await checked(f.admin.from('hub_leads').update({profile:{...existing.profile,contact,contactInfo:'equipe@example.invalid',origin:'Homologação sintética',verification:'Parcialmente verificado',address:'Rua de exemplo, 123',region:'Centro',whatsapp:'00000000000',website:'https://example.invalid',services:['Automações']},notes:'Dados e evidências inteiramente fictícios para revisão.'}).eq('workspace_id',f.workspace).eq('id',id))
 }
 const completed=await checked(f.admin.from('hub_activities').insert({workspace_id:f.workspace,lead_id:f.prospect,title:'Ação fictícia para o histórico',owner:'Caio · fictício',status:'Pendente',due_on:f.today}).select('id').single())
 await checked(f.admin.from('hub_activities').update({status:'Concluída'}).eq('workspace_id',f.workspace).eq('id',completed.id))
 return f
}
