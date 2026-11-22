# Proposta: Central de compromissos e avisos

Próxima entrega sugerida, ainda não implementada e sem envio real autorizado.

## Lacuna observada

Vencimentos/ocorrências e avisos internos são atualizados ao salvar/abrir o portal. Sem execução externa agendada, não há garantia de geração nem notificação com o Hub fechado. Contratos e assinaturas precisam de responsáveis e antecedência explícita de renovação/cancelamento. Um banner na tela não equivale a aviso entregue.

## Ordem recomendada

1. **Agenda confiável do servidor.** Job com lock/idempotência por obrigação e competência; fuso America/Fortaleza; horizonte e dias 29–31/ano bissexto. Definir atrasos, retomada, pausa e cancelamento preservando pagos/histórico. Exibir última execução e cobertura.
2. **Central interna de avisos.** Vencido, vence hoje e renovação/cancelamento próximo, responsável e registro de origem; lido/adiado sem mudar vencimento. Permissões financeiras e integrante ativo conferidos antes de retornar conteúdo. Histórico de geração e mudanças.
3. **Caixa de saída transacional.** Eventos e destinatários autorizados, chave estável por janela/canal, tentativas/retry e supressão após pagamento/cancelamento/desativação. Revisão de papéis no despacho. Sem valores protegidos em assunto ou logs.
4. **Homologação de entrega.** Mailpit/endereços fictícios, relógio controlado, concorrência, falha parcial, repetição e recuperação. Painel distingue pendente, enviado, entregue e falhou; não inferir leitura a partir de envio.
5. **Ativação separada.** Só após aprovação de canal, custos, limite de gastos, remetente e preferência dos dois sócios. Avaliar recursos existentes antes de contratar. Nenhum envio real, cron de produção ou serviço externo ativado nesta rodada.

Critério de conclusão: vencimento gerado e aviso elegível processado com portal fechado em ambiente isolado; repetição não duplica ocorrência/aviso; pagamento e perda de acesso suprimem envios; falha de provedor é visível e recuperável.
