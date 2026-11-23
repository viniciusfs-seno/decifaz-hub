# Revisão financeira semanal dos sócios

Em rascunho, sem publicação. Base: main após #40 (`12f94ca`). Migração aditiva `20261123010000_revisao_financeira_semanal.sql`.

## Rotina

Visão Geral → Revisão semanal → Revisão financeira dos sócios. A semana é a mesma do fechamento operacional: segunda a domingo em America/Fortaleza. Administração e Financeiro consultam; o servidor confere papéis cumulativos e vínculo ativo em cada RPC. Comercial não recebe valores, notas ou histórico financeiro.

Compare receita prevista com recebida e despesa prevista com paga. Previsões usam vencimento; realização usa data efetiva. Abaixo, confira pendências atuais e próximos7/30dias;30 inclui7. A posição de vencidos é atual, mesmo ao abrir outra semana. Não representa reconstrução retrospectiva do saldo em uma data passada.

O relatório reúne receitas/recebimentos existentes, despesas avulsas e ocorrências de obrigações. Contrato/projeto são vínculos de contexto, sem criar outra previsão. Canceladas/suspensas não geram nova cobrança e estornos não contam como recebimento. Um contrato sem previsão financeira não vira receita automaticamente. Registros antigos sem responsável são identificados, sem inferir atribuição pelo ator.

Filtre por integrante responsável ou consulte todo o espaço. Paginação100 por página com totais calculados sobre todo o recorte autorizado. Ordenação estável por pendência, vencimento e chave; alterações concorrentes podem mudar a composição das páginas ao atualizar. “Conferir e dar baixa” abre a ocorrência original: confirme pagamento externo, data, valor e referência. Reutiliza `hub_pay_internal_bill` e sua auditoria/idempotência; não cria cadastro ou pagamento paralelo.

## Fechamento e histórico

O registro financeiro é um anexo protegido da semana existente, não uma segunda rotina operacional. Seu histórico fica separado porque o fechamento operacional é consultável pelo Comercial. Fechar não paga, altera datas nem executa operações no fornecedor.

Registre conferência/decisões para todo o espaço, mesmo com filtro de integrante. O servidor captura totais completos, contagem e primeiras100 origens, ator/data e revisão na mesma transação do evento financeiro. Histórico imutável; UI mostra últimas20 revisões da semana. Uma baixa posterior não altera a fotografia anterior. Fechamento tardio reflete fontes disponíveis na hora de registrar, não uma série histórica reconstruída.

Dois salvamentos concorrentes não se sobrescrevem: um vence, outro recebe o atual e revisa antes de salvar. Operação repetida retorna o mesmo fechamento; reutilização com notas diferentes é recusada. Falha de auditoria reverte fechamento e evento. App não pode inserir/editar/excluir diretamente o histórico. Não colocar valores nas notas do fechamento operacional.

## Verificação

`npm run check`; `npm test`; builds; `node scripts/local-validation.mjs financial-week-real.spec.mjs --workers=1`. Contas/documentos fictícios: totais e realização, mais100 origens, paginação, duas sessões/conflito, baixa manual/repetição, rollback de auditoria, isolamento, Financeiro sem admin, Comercial negado, membro desativado, vazio e celular/escuro.

`node scripts/financial-week-upgrade.mjs --reset-local-fixtures`: apenas Docker descartável, nunca a prévia ativa ou remoto. Ensaia esquema publicado #40 → dry-run exclusivo → migração, dados/flags dos avisos e contrato do fechamento operacional anterior. CI executa os testes de frontend e as regressões anteriores. Prévia HTTPS protegida usa somente Supabase local/contas fictícias; SHA, validade, resultados e capturas no PR.

## Publicação futura e recuperação

Requer aprovação própria. Conferir main/head/checks do candidato. Migração exclusiva20261123010000 antes do frontend; não alterar Edge, SMTP, papéis ou agendador. Verificar RLS/grants, acesso permitido/negado e preservação por metadados, sem fixtures em produção. Depois integrar candidato e confirmar SHA/deployment no domínio.

Recuperar frontend #40 mantendo esquema aditivo, fechamentos e auditoria. Não apagar snapshots, pagamentos ou reabrir campos protegidos. A migração não agenda nada e não envia e-mails. Avisos internos e tela experimental mantêm suas configurações.
