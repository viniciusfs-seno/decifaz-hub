# Histórico verificável de indicadores

Terceiro PR da pilha: #24 Ficha → #25 Paginação → Histórico. Migração `20261117030000_historico_indicadores.sql`. Não autorizado para produção nesta rodada.

O bloco “Histórico verificável por mês”, em Indicadores, usa `hub_metric_history` no banco e os mesmos filtros de período, responsável e etapa da tela. O CSV é gerado do mesmo resultado, sem recompor ou paginar o recorte. Datas são inclusivas e meses parciais respeitam os limites; até cinco anos por consulta. Datas de eventos/criação são convertidas para Fortaleza. A API decide a permissão financeira: Comercial não recebe chaves nem valores de receitas, mesmo chamando a RPC diretamente.

| Métrica | Fonte verificável | Limite de interpretação |
|---|---|---|
| Cadastros | `hub_leads.created_at` | Data de criação; nome, responsável e etapa atuais |
| Reuniões registradas | `hub_meetings.meeting_on` | Inclui agendadas/canceladas; data registrada pode ser editada; não prova que a reunião aconteceu |
| Versões enviadas | `record.sentAt` de todas as versões de proposta | Inclui versões anteriores, diferentemente do card de propostas atuais; sem envio ficam fora |
| Entregas aceitas | `delivery.acceptedAt` | Data de aceite persistida, não o prazo previsto |
| Receitas previstas/realizadas | Vencimento da obrigação / data do recebimento | Separadas, somente financeiro; estornos atuais excluídos. Previsões e estornos podem alterar a série passada |
| Entradas em Ganho/Perdido observadas | Transições antes/depois de `hub_lead_audit` do #24 | Somente eventos efetivamente auditados. Seed em Ganho não vira transição. Não reconstrói funil/coorte antiga |
| Conclusões de atividades/suporte | `hub_activity_events` | Somente a partir desta captura; reabertura seguida de nova conclusão gera outra conclusão, não outra pessoa/lead |

Não se fabrica histórico para registros legados. A interface mostra o início de captura de atividades e o primeiro evento de ficha do espaço; meses anteriores sem eventos não significam ausência de atividade. Não há SLA contratual, duração histórica confiável de etapas ou histórico completo de responsáveis. Responsável dos eventos é o registrado no evento; nas outras fontes é o responsável atual do registro/projeto. Etapa é a atual do estabelecimento. Não é uma fotografia contábil ou do funil em uma data passada.

## Auditoria e proteção

Eventos de atividade são gravados por trigger na mesma transação da mudança de estado, com ator, espaço, integrante/atividade, lead/projeto, estado anterior/novo, responsável e horário. Regravar o mesmo estado não gera evento. Usuários do app não podem inserir, editar ou excluir eventos. Consulta por espaço e módulo exige vínculo ativo. A RPC agregada exige consulta comercial e verifica Financeiro no servidor; não aceita papel enviado pelo cliente.

`metric-history-real` valida datas/fuso na virada de mês, receitas separadas, ausência de chaves financeiras na API/CSV Comercial, filtro por responsável, isolamento, escrita direta negada, ausência de evento duplicado, rollback da alteração se a auditoria falhar e perda de acesso das novas RPCs após desativação com JWT aberto.

## Ensaio e publicação futura

`node scripts/crm-upgrade-validation.mjs --reset-local-fixtures` recusa banco remoto, volta exclusivamente a pilha fictícia ao esquema atual de produção #23, semeia registros, aplica **uma migração por fase**, exige dry-run exclusivo, compara digests de dados/vínculos/papéis e testa o frontend #23 após cada expansão. Depois testa o candidato integrado e preservação da revogação financeira. Restaura todas as migrações locais ao terminar. Não executar enquanto alguém revisa a prévia, pois o reset invalida as personas fictícias.

Ordem após aprovação: integrar #24/#25/#26 em sequência, atualizando base e conferindo diff/checks do SHA após cada merge. Se houver squash, preservar a branch antiga e reaplicar somente commits próprios; não reaplicar a base. Para cada PR: banco da fase → verificar grants/RLS/compatibilidade → frontend. Versões: `20261117010000` → `20261117020000` → `20261117030000`. Sem Edge/Auth. Não aplicar migrações futuras no dry-run de uma fase anterior.

Recuperar frontend da fase anterior, ou #23 para recuperação integrada, mantendo novas tabelas, revisão, RPCs, eventos, registros e restrições. Não apagar auditoria, não restituir leitura financeira bruta e não resetar produção. A captura pode continuar mesmo com frontend anterior. Registrar deployment de recuperação antes de publicar.

## Homologação

Tipagem, unitários, builds, regressões SQL, suítes reais, mocks, ensaios de migração e navegadores são executados com contas fictícias. SHAs, checks finais, URL e validade da prévia ficam nos três PRs. A prévia do topo serve as três entregas sobre Supabase local, protegendo frontend, APIs e retorno Auth; nenhuma conexão com o banco de produção.

Bloqueio inicial de Billing & plans no GitHub foi comunicado; após o repositório tornar-se público os jobs voltaram a iniciar. Distinguir a primeira tentativa sem execução dos resultados do head final.
