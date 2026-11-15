# Histórico de alterações de papéis

Entrega separada em rascunho, baseada na main com #15 publicado (`cd0efb81ab70c4ac2b18f18df8a2184c2f7b2f09`). A migração `20261115220000_historico_papeis.sql` foi aplicada somente na pilha fictícia local. Não publicar esta branch nem aplicar sua migração remota antes de revisão/autorização própria.

## Registro e consistência

`hub_role_audit` registra no servidor espaço, ID do evento, horário do servidor (`clock_timestamp`), ator, integrante afetado, operação, papéis anteriores/novos e revisões anterior/nova. Não armazena e-mail, tokens, metadados Auth ou JSONs comerciais. IDs de ator/integrante não têm FK para Auth: apagar uma conta não apaga a evidência histórica. O espaço tem FK sem exclusão em cascata.

A trigger privada `audit_member_roles` roda após INSERT/UPDATE de `hub_members`, na mesma transação. Assim cobre a RPC legada `hub_set_roles`, seu wrapper e a RPC com revisão `hub_update_member_roles`, sem duplicar a lógica de gravação nem mudar suas assinaturas/retornos. A revisão já foi incrementada pela trigger do #15 quando o evento é inserido; constraints exigem revisões consecutivas para alterações. Falha no evento aborta a mudança e sua revisão. Rollback posterior à RPC também desfaz o evento.

Não há backfill de eventos: a cobertura começa na instalação da migração. Vínculos existentes e seus papéis/revisões ficam intactos. Criação nova produz `created`, conjunto anterior vazio, revisão anterior nula e nova zero. Mudança efetiva produz `changed`. Conflito, recusa, último admin bloqueado e gravação do mesmo conjunto não produzem evento de alteração efetivada. Não são registrados como se tivessem alterado permissões.

O ator vem de `auth.uid()`, nunca de parâmetro do cliente nem do owner da função definer. RPCs de usuário registram `actor_source=member` e ator não nulo. Provisionamento administrativo sem sessão de usuário fica explícito como `actor_source=system`, ator nulo; não inventa um ator humano. Não há trigger de remoção de membro nesta entrega (o app não oferece essa operação). Eventos existentes permanecem após exclusão Auth.

## Consulta e imutabilidade para o app

RLS permite SELECT somente quando `hub_can(workspace_id,'admin',true)` é verdadeiro. Usuário comum, inclusive Financeiro, não vê linhas; admin de outro espaço não vê os eventos externos. Anon não tem SELECT. Authenticated tem somente SELECT: INSERT/UPDATE/DELETE/TRUNCATE não são concedidos, mesmo para admin do app. A função de auditoria não tem EXECUTE para public/anon/authenticated e usa search_path vazio.

A consulta está disponível pela API de tabelas com RLS, filtrando o espaço e ordenando `occurred_at`/`id` de forma decrescente, com limite/paginação. Não há nova tela de histórico neste PR. Privilégios administrativos do banco/service-role continuam fora do papel admin do app; não é uma garantia contra adulteração por um operador com controle total do banco. Retenção/exportação exigem decisão própria, sem conceder edição de eventos aos membros.

## Verificação automatizada

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/transition-validation.mjs --reset-local-fixtures
```

`supabase/tests/historico_papeis.sql` usa transação revertida com dados fictícios. Cobre as duas RPCs, atores distintos, revisões/horários, criação, no-op/conflito/recusa sem eventos, isolamento, admin/Financeiro/anon, bloqueio de escrita direta e de execução do helper. Força falha ao inserir evento nas duas RPCs e confere que papéis e revisão não persistem; também força rollback após uma mudança bem-sucedida. As contagens ficam limitadas aos espaços da fixture para permitir repetição em uma pilha com outros cenários fictícios.

`e2e/role-history-real.spec.mjs` usa Supabase Auth/JWT e PostgREST locais para conferir dados dos eventos, ator derivado da sessão, caminhos legado/revisado, conflito sem evento, criação por RPC, RLS entre espaços e impossibilidade de forjar/editar/excluir eventos como usuário autenticado. A suíte existente mantém os testes de duas sessões concorrentes e último administrador. Os executores e o workflow Supabase incluem o SQL e o cenário novos. SHA validado, comandos/resultados e links de CI são registrados no corpo do PR.

Nesta rodada local passaram tipagem, 18 testes unitários, builds padrão/compartilhado, quatro regressões SQL, sete cenários reais, cinco simulados e backup. A transição/recuperação e os checks do commit final são conferidos antes da entrega do PR. A primeira repetição da fixture identificou uma contagem global que incluía outros testes; a contagem foi corrigida para os dois espaços fictícios da própria fixture, sem reduzir as asserções de segurança.

## Publicação futura e recuperação

1. Após aprovação própria, reconferir head/base/checks e o histórico remoto (baseline esperado até `20261115210000`). Em cópia operacional, dry-run deve apontar somente `20261115220000_historico_papeis.sql`, sem seeds, include-all ou reaplicação de migrações anteriores.
2. Aplicar a migração aditiva. Verificar tabela, trigger, grants/RLS e corpos das funções, sem alterar papéis/vínculos reais como teste. Regressões mutantes continuam locais/CI. Sem mudanças de frontend/Edge necessárias para começar a registrar os eventos.
3. Validar operação administrativa quando houver mudança real aprovada e conferir seu evento; não criar mudanças artificiais em produção. Confirmar que não houve backfill e manter as restrições financeiras do #13 e o controle de revisão do #15.

Migração falha: sua transação reverte e a versão #15 continua vigente. Depois de instalada, não remover ou editar os eventos para recuperar o app. Corrigir de forma aditiva, mantendo a auditoria; se o registro falhar, a gravação dos papéis deve falhar de forma atômica. Voltar frontend para #15 mantém a trigger ativa. Não desabilitar a trigger para contornar erro, zerar revisões ou reabrir JSONs. A branch tem deploy automático desabilitado em `vercel.json` e este PR não autoriza merge/deploy/migração remota.

## Próximo passo: Convites

Fluxo administrativo por espaço, papéis completos explicitamente aprovados, aceite por conta verificada, expiração e revogação. Convite pendente não concede vínculo/acesso; aceitação deve ser idempotente e conferir destino, prazo e estado no servidor. Chave administrativa fica somente no servidor; evitar e-mail/token em logs e CI. Definir a política de reenvio, vínculo já existente e quem pode revogar antes da implementação. Nenhum convite ou envio de e-mail é feito nesta entrega.
