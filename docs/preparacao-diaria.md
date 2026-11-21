# Preparação diária — nomes e orientação

## O que muda

Administração → Equipe → Identificação no espaço permite definir um nome de exibição para cada integrante. Até 80 caracteres, com espaços normalizados. Vazio restaura o fallback da conta. O nome pertence ao vínculo deste espaço: não altera Auth, e-mail, UUID, papéis, atividade, revisão de papéis ou vínculos em outros espaços. Não é prova de identidade nem concessão de acesso.

Administração tem configuração e gravação; integrantes ativos consultam os rótulos autorizados pelo diretório existente. Desativados continuam identificáveis no histórico e não entram nas novas sugestões. Nome, metadado Auth e identificador de conta são prioridades de apresentação; nomes repetidos continuam distintos. Responsáveis antigos em texto não recebem UUID por comparação de nomes.

Atividades atribuídas, contratos e obrigações com vínculo explícito usam o nome atual autorizado na apresentação, preservando o texto registrado. O ator do histórico também é resolvido pelo diretório atual. A alteração do nome registra ator, integrante, estado anterior/novo, revisão e horário na transação. Não se reconstrói o nome que era exibido em eventos antigos.

Dois administradores não sobrescrevem uma edição desatualizada: a RPC devolve conflito e a interface pede revisão. Salvar nome — inclusive por Enter — não salva rascunhos de papéis. Falha no evento reverte nome e revisão. Consultas diretas à tabela privada e edição por Comercial, anônimo ou outro espaço são negadas.

## Guia para começar

Conhecimento → Base de conhecimento → Início diário dos sócios. Comece em três passos fica aberto; contratos, vencimentos, reuniões e rastreabilidade ficam em accordions. A busca abre o detalhe que contém o termo, mantendo o manual de origem separado. Configure os nomes em Equipe e registre primeiro contratos existentes, domínio anual, assinaturas mensais e a próxima reunião do projeto.

Avisos são internos ao abrir/atualizar o portal. Ocorrências são geradas ao salvar a obrigação e ao carregar o financeiro autorizado até 366 dias, com competência única. Não há envio externo enquanto o portal fica fechado, pagamento automático ou cancelamento no fornecedor. Baixa é manual, com confirmação. Documentos privados são anexos, sem assinatura eletrônica. Chamada externa e captura local mantêm seus limites até a homologação da entrega independente de transmissão.

## Validação e publicação

Migração aditiva: `20261121010000_nomes_no_espaco.sql`, após `20261121000000`. Cria somente tabela privada de nomes, RPCs administrativas, evento transacional e atualização do diretório. Sem backfill ou atribuição de nomes a integrantes reais, sem mudança de Edge e sem alteração das RPCs de papéis. O frontend anterior continua compatível com a expansão.

Comandos: `npm run check`, `npm test`, builds demo/compartilhado, `node scripts/mock-validation.mjs`, `node scripts/local-validation.mjs` e `node scripts/member-label-upgrade-validation.mjs --reset-local-fixtures`. O ensaio descartável parte do esquema atual, verifica dry-run exclusivo, preservação de registros e frontend anterior/candidato/recuperação. Não executar com a prévia ativa.

`supabase/tests/nomes_no_espaco.sql` usa ROLLBACK. `e2e/member-labels-real.spec.mjs` cobre duas sessões, conflito, rascunho de papéis, Enter, isolamento, histórico, rollback de auditoria, concorrência e perda de acesso. As regressões de contratos/financeiro/reuniões mantêm documentos privados, competências, pagamentos e acompanhamentos atômicos. Todos os dados são fictícios.

Publicação: conferir candidato/main/checks → histórico remoto por leitura → dry-run contendo somente `20261121010000` → aplicar → verificar tabela/RPCs/grants, eventos e preservação dos registros existentes → integrar frontend → conferir Vercel READY/SHA e domínio. Não editar nomes ou registros reais como teste. Candidato, resultados e links ficam na descrição do PR.

Recuperação: frontend do #39, `cf821625336ba98bf235130fb1c8fa36c7b97bdb`, deployment `dpl_55xYHtfMxDgpoju54258wU6bJ2aH`. Manter nomes/eventos já gravados e restrições do banco. Não apagar vínculos, nomes, documentos ou auditorias, nem restaurar grants de dados financeiros. Esta entrega é independente da transmissão de tela e pode ser publicada primeiro.
