# Histórico de alterações de papéis

O #16 foi autorizado e publicado em 15/11/2026. Candidato `5900004f4c987e4a94caefe0f8915abf7de78fe0`, base `cd0efb8`, squash merge **`464dfa3f80579dcc18dc739a5d0e6884f5ffa16f`**. Aplicada somente `20261115220000_historico_papeis.sql` após dry-run exclusivo, antes do merge/frontend.

Deployment confirmado na API para `decifaz-hub.vercel.app`: **`dpl_4sNsxK4xhjjuYv76ZNKxfaeyBdY5`**, READY/production, no SHA de integração. [URL imutável](https://decifaz-be8da0ver-vinicius-ferreiras-projects-84ef88fb.vercel.app). [Interface main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43746375630) e [Supabase main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43746375478) aprovados.

Tabela/RLS/trigger/grants verificados; helper privado e corpo igual ao testado após normalizar CRLF. Resumo de papéis, vínculos e revisões dos três membros inalterado. Zero eventos artificiais/backfill em produção. Chromium confirmou login público, sem enviar formulário ou criar sessão Auth real; mutações/eventos de teste foram exclusivamente locais/CI. Um problema de transporte binário no PowerShell impediu a primeira montagem da cópia operacional; corrigido antes de aplicar, sem reparar/reverter histórico remoto. Cópia válida em `.validation/rollout16-valid`.

Convites é outra entrega, em rascunho, descrita em [convites.md](convites.md); sua migração e frontend não foram publicados. O roteiro abaixo registra os critérios do rollout do histórico e sua recuperação, sem autorizar publicar Convites.

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

## Publicação e recuperação

1. Reconferir autorização, head/base/checks e histórico remoto (antes do #16, até `20261115210000`; depois, `20261115220000`). No rollout autorizado, o dry-run apontou somente `20261115220000_historico_papeis.sql`, sem seeds/include-all.
2. Aplicar a migração aditiva. Verificar tabela, trigger, grants/RLS e corpos das funções, sem alterar papéis/vínculos reais como teste. Regressões mutantes continuam locais/CI. Sem mudanças de frontend/Edge necessárias para começar a registrar os eventos.
3. Validar operação administrativa quando houver mudança real aprovada e conferir seu evento; não criar mudanças artificiais em produção. Confirmar que não houve backfill e manter as restrições financeiras do #13 e o controle de revisão do #15.

Migração falha: sua transação reverte e a versão #15 continua vigente. Depois de instalada, não remover ou editar os eventos para recuperar o app. Corrigir de forma aditiva, mantendo a auditoria; se o registro falhar, a gravação dos papéis deve falhar de forma atômica. Voltar frontend para #15 mantém a trigger ativa. Não desabilitar a trigger para contornar erro, zerar revisões ou reabrir JSONs. A antiga branch de histórico continua com deploy automático desabilitado em `vercel.json`; main publicou após merge conforme esperado.

## Próximo passo: Convites

Implementado para revisão em [convites.md](convites.md): gestão administrativa, sete dias, aceite verificado/transacional/idempotente, expiração e revogação. Pendente não concede vínculo/acesso; vínculo existente preserva papéis. E-mail validado apenas no Mailpit local, sem envio real. Publicação/configuração de produção continuam para revisão posterior.
