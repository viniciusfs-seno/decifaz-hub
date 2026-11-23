# Revisão financeira semanal dos sócios

PR #44 em rascunho, sem publicação. Base: main após #40 (`12f94ca`). Migrações aditivas `20261123010000_revisao_financeira_semanal.sql` e `20261123020000_confiabilidade_financeira.sql`, somente local/CI nesta rodada. SHA final e checks na descrição do PR, para evitar atribuir evidência de um commit anterior a um novo candidato.

## Rotina

Visão Geral → Revisão semanal → Revisão financeira dos sócios. A semana é a mesma do fechamento operacional: segunda a domingo em America/Fortaleza. Administração e Financeiro consultam; o servidor confere papéis cumulativos e vínculo ativo em cada RPC. Comercial não recebe valores, notas ou histórico financeiro.

Compare receita prevista com recebida e despesa prevista com paga. Previsões usam vencimento; realização usa data efetiva. Abaixo, confira pendências atuais e próximos7/30dias;30 inclui7. A posição de vencidos é atual, mesmo ao abrir outra semana. Não representa reconstrução retrospectiva do saldo em uma data passada.

O relatório reúne receitas/recebimentos existentes, despesas avulsas e ocorrências de obrigações. Contrato/projeto são vínculos de contexto, sem criar outra previsão. Canceladas/suspensas não geram nova cobrança e estornos não contam como recebimento. Um contrato sem previsão financeira não vira receita automaticamente. Registros antigos sem responsável são identificados, sem inferir atribuição pelo ator.

### O que entra nos indicadores

| Indicador | Registros e data | Separação e limites |
| --- | --- | --- |
| Receita prevista | `hub_receivables`, vencimento de segunda a domingo da semana selecionada | Total contratado/previsionado, não reduzido pela realização. Nunca somar a “Recebido”. |
| Recebido na semana | `hub_receipts` não estornados, `received_on` na semana | Soma dos recebimentos, sem somar novamente as previsões. |
| Despesas previstas | `hub_internal_bills` em Prevista/Paga e `hub_expenses`, vencimento na semana | Inclui a previsão original das já pagas; comparar com “Pago”, não somar os dois. Não inclui planos/contratos novamente. |
| Pago na semana | As mesmas ocorrências/despesas, `paid_on` na semana e valor efetivamente pago | O ledger `hub_internal_payments` comprova a baixa, mas não é uma segunda parcela da soma. |
| A pagar vencido na posição | Saldo das ocorrências Previstas e despesas sem baixa, vencimento anterior ao dia atual | Dia de Fortaleza calculado no servidor. Não é posição histórica da semana selecionada. |
| A receber vencido na posição | Previsões vencidas menos recebimentos não estornados do mesmo projeto/tipo/competência, mínimo zero | Não conta recebimentos como pendências. |
| A pagar em até 7/30 dias | Pendências de despesas/ocorrências, vencimento entre hoje e hoje+7/30, inclusive | 30 contém 7; não somar os cards. |

A lista inclui origens com vencimento na semana, realização na semana ou pendência até hoje+30 (inclusive vencidos). Nem todas as linhas contribuem para todos os indicadores. Filtro por responsável usa o vínculo explícito da obrigação; receitas e despesas avulsas antigas sem esse vínculo aparecem somente em “Todo o espaço”. Todas as somas usam o recorte completo autorizado, não a página visível. Dois cadastros manuais independentes da mesma despesa não são conciliados automaticamente: deve-se corrigir a origem, sem presumir duplicidade nem excluir histórico.

Filtre por integrante responsável ou consulte todo o espaço. Paginação100 por página com totais calculados sobre todo o recorte autorizado. Ordenação estável por pendência, vencimento e chave; alterações concorrentes podem mudar a composição das páginas ao atualizar. “Conferir e dar baixa” abre a ocorrência original: confirme pagamento externo, data, valor e referência. Reutiliza `hub_pay_internal_bill` e sua auditoria/idempotência; não cria cadastro ou pagamento paralelo.

## Fechamento e histórico

O registro financeiro é um anexo protegido da semana existente, não uma segunda rotina operacional. Seu histórico fica separado porque o fechamento operacional é consultável pelo Comercial. Fechar não paga, altera datas nem executa operações no fornecedor.

Registre conferência/decisões para todo o espaço, mesmo com filtro de integrante. O servidor captura totais e **todas** as origens numa única leitura consistente, persistindo detalhes em `hub_financial_week_details`, na mesma transação do fechamento e seu evento financeiro. `hub_financial_week_snapshot` lê exclusivamente esses detalhes: páginas de 100, ordem congelada, sem consultar fontes atuais. Histórico de revisões em `hub_financial_week_history`: 20 por página, cursor pela revisão, acesso às anteriores sem corte nas últimas 20. Uma nova revisão não desloca o cursor das anteriores. Ao voltar da origem, semana, responsável e páginas permanecem no contexto do espaço/sessão; fechar a fotografia restaura o foco do botão.

**Posição atual** sempre consulta registros atuais; **fotografia** identifica revisão, data do registro e dia da posição congelada. Pagamento, correção, estorno ou alteração de nomes posterior não reescreve os detalhes salvos. Fechamento tardio reflete fontes disponíveis na hora de registrar, não uma série histórica reconstruída. Há um limite operacional explícito de 25.000 origens por recorte para o volume desta empresa: acima dele a RPC recusa a operação inteira, sem fotografia parcial; não é paginação de 25.000 linhas no navegador.

Compatibilidade: a segunda migração importa **apenas os detalhes que o JSON antigo realmente guardou**, preservando o JSON original. Uma fotografia antiga com 105 origens e só 100 detalhes informa 105 totais/100 preservadas/5 não congeladas, sem completar com dados atuais. Novos fechamentos preservam 100% das origens do recorte. Tabelas de fechamento/detalhes não aceitam escrita direta por usuários do app, nem mesmo administradores; leitura exige Financeiro/Administração e vínculo ativo.

Dois salvamentos concorrentes não se sobrescrevem: um vence, outro recebe o atual e revisa antes de salvar. Operação repetida retorna o mesmo fechamento; reutilização com notas diferentes é recusada. Falha de auditoria reverte fechamento e evento. App não pode inserir/editar/excluir diretamente o histórico. Não colocar valores nas notas do fechamento operacional.

## Rastreabilidade das baixas

“Rastrear baixa” consulta o registro existente: origem, responsável cadastrado quando conhecido, autor da operação separado do responsável, data efetiva e data/hora de registro em Fortaleza. Ocorrências usam `hub_internal_payments` e a linha do tempo da origem; despesas e recebimentos usam `hub_finance_audit`, incluindo antes/depois de correções e estornos cobertos pela auditoria. A consulta não atribui um autor ausente, não altera datas nem cria pagamento novo. Eventos de serviço sem ator são identificados como autor não disponível.

Auditoria não reconstrói ações anteriores à sua implantação. A entrega reaproveita a baixa manual existente e o estorno existente de recebimentos. Não cria estorno/correção de pagamento de obrigações nem permite editar livremente despesas já baixadas. Essa evolução precisa preservar ledger, justificativa e revisão em entrega própria. Responsável textual congelado é preservado; o diretório atual não renomeia uma fotografia antiga.

## Verificação

`npm run check`; `npm test`; builds local/shared; `node scripts/local-validation.mjs financial-week-real.spec.mjs --workers=1`. Contas/documentos fictícios: totais e realização, mais 200 origens congeladas e 26 revisões, páginas estáveis, pagamento/correção posteriores sem mutação do snapshot, antes/depois/ator da auditoria, duas sessões/conflito, baixa manual/repetição, rollback de fechamento/detalhes/evento, isolamento, Financeiro sem admin, Comercial negado, membro desativado, vazio, foco ao fechar, retorno com páginas preservadas e celular/escuro.

`node scripts/financial-week-upgrade.mjs --reset-local-fixtures`: apenas Docker descartável, nunca a prévia ativa ou remoto. Ensaia esquema publicado #40 → dry-run exclusivo 010000 → migração → fechamento antigo real acima de 100 origens → dry-run exclusivo 020000 → migração → preservação honesta da fotografia parcial e novo snapshot completo. Confere dados/flags dos avisos e contrato operacional anterior. CI executa as regressões SQL/browser anteriores. Prévia HTTPS protegida usa somente Supabase local/contas fictícias; SHA, validade, resultados e capturas no PR.

## Publicação futura e recuperação

Requer aprovação própria. Conferir main/head/checks do candidato e histórico remoto por leitura. Ordem exata: dry-run somente `20261123010000` e `20261123020000`, nessa ordem → aplicar 010000 → aplicar 020000 → verificar RLS/grants nas duas tabelas, RPCs de posição/fechamento/histórico/fotografia, contagens total/preservada e preservação dos registros existentes → integrar frontend validado → confirmar SHA/deployment no domínio. Se 010000 já existir, o dry-run deve conter apenas 020000; nunca reaplicar versão registrada. Não alterar Edge, SMTP, papéis, avisos ou agendador. Não usar fixtures nem criar baixas em produção para smoke. Ambos os frontends anteriores (publicado #40 e primeira versão do #44) continuam compatíveis com o esquema aditivo.

Se a segunda migração falhar, a transação reverte suas alterações; manter frontend anterior e investigar sem apagar fechamentos. Após aplicação, recuperar frontend #40 mantendo ambas as migrações, detalhes congelados e auditoria. Não executar down destrutivo, apagar snapshots/pagamentos ou reabrir campos protegidos. Repetição da operação com mesmo identificador retorna a mesma revisão. As migrações não agendam nada e não enviam e-mails. Avisos internos e tela experimental mantêm suas configurações; e-mail permanece desligado. Nesta rodada **nenhuma migração remota, merge ou publicação financeira**.
