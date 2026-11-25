# Publicação futura da rotina comercial

Somente revisão nesta rodada: #50 → #51 → #52 em rascunho. Nenhuma destas migrações foi aplicada remotamente. E-mail permanece desligado. Não usar `db push` com toda a pilha sem conferir exatamente as migrações pendentes.

## Fases e pontos de verificação

1. #50: atualizar base para main publicada do #49, conferir diff próprio e checks do SHA; dry-run somente `20261125040000_regularizacao_assistida.sql`, aplicar e verificar funções/grants e preservação dos registros. Integrar frontend, confirmar alias/SHA/READY e acesso. A fila não regulariza registros automaticamente.
2. Atualizar base de #51 após integrar #50, reconferir diff e CI. Dry-run somente `20261125050000_avisos_comerciais.sql`; aplicar com `commercial_enabled=false` (padrão) e `mail_enabled=false`. Conferir que o frontend anterior não recebe origens comerciais na Central. Funções existentes continuam atendendo vencimentos financeiros e contratuais; não criar outro agendador ou publicar worker de e-mail.
3. Integrar frontend de #51, confirmar deployment e links para atividade/ficha. Somente após essa verificação, ativar fontes comerciais pela configuração administrativa privada do gerador: `update hub_private.notice_settings set commercial_enabled=true where not mail_enabled;`. Se não atualizar a configuração, investigar o estado; não desligar proteções para forçar ativação. O cron interno já existente gera os avisos sem navegador, respeitando preferências e recuperando execuções atrasadas.
4. Atualizar base de #52 para main, conferir diff próprio e CI. Dry-run somente `20261125060000_indicadores_comerciais.sql`; aplicar RPCs e conferir execute restrito/autorização. Publicar frontend e verificar Indicadores, Dashboard e CSV. Os indicadores usam fontes comerciais independentes da chave de geração; desativar avisos não transforma pendências em zero.

Antes de cada fase: inventário de versões remotas por leitura, backup/recuperação disponíveis e comparação sanitizada de dados/permissões. Verificar somente em produção sem criar empresas, atividades ou destinatários fictícios. Jornadas que alteram dados pertencem a homologação/CI. Não simular identidade de integrante real. Checks e smokes correspondem ao SHA efetivamente integrado.

## Recuperação preservando registros

- #50: restaurar frontend anterior, mantendo funções aditivas, revisões privadas, textos originais e auditoria. Não desfazer regularizações confirmadas nem excluir dados.
- #51: **primeiro** `update hub_private.notice_settings set commercial_enabled=false;`, depois recuperar frontend anterior. As fontes comerciais deixam a Central e os avisos registrados passam a invalidados, sem exclusão. O cron, os vencimentos financeiros e contratuais e suas permissões continuam funcionando. Não religar e-mail, remover preferências ou apagar atividades. Depois de corrigir, revalidar o frontend compatível e reativar; as chaves estáveis impedem duplicação e podem reabrir aviso ainda pertinente.
- #52: restaurar frontend de #51, mantendo RPCs aditivas e eventos. Não reconstruir eventos passados, recalcular fechamentos antigos ou restaurar acesso financeiro bruto. Revalidar novas definições antes de reapresentar números.

Homologação: fixtures locais ativam a chave por `scripts/enable-commercial-notice-fixtures.mjs`, que exige ambiente E2E, endpoint local e contêiner dedicado. O ensaio `routine-upgrade-validation.mjs --reset-local-fixtures` roda somente em banco local descartável do CI; não reinicializar a pilha que hospeda a prévia. Testes cobrem expansão desativada, ativação, invalidação sem exclusão e recomposição. Publicação continua dependendo de aprovação posterior.
