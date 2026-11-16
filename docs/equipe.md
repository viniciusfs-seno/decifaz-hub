# Administração → Equipe

PR #15 autorizado e publicado em fases em 15/11/2026. Candidato `6a3c49e2f9f9d096a18b047e38ce823d7dafe599`, base `ab6427f`, squash merge **`cd0efb81ab70c4ac2b18f18df8a2184c2f7b2f09`**. Aplicadas separadamente `20261115200000_equipe.sql` e `20261115210000_equipe_concorrencia.sql`, cada uma após dry-run e conferência; só então merge e frontend.

Deployment ativo confirmado pela API no domínio `decifaz-hub.vercel.app`: **`dpl_7WM8XdJBCMa55pMJsP8G4SfkapTY`**, READY/production, SHA de integração. [URL imutável](https://decifaz-gq91458kw-vinicius-ferreiras-projects-84ef88fb.vercel.app). [Interface main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43743673967) e [Supabase main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43743673918) aprovados.

Papéis/vínculos dos três membros comparados antes/depois por resumo sem identificadores, sem alterações; revisões inicializadas em zero. RPC legada inalterada, trigger habilitada, grants corretos, listagem administrativa e negação sem vínculo conferidas no servidor. Funções remotas coincidem com as testadas localmente após normalizar CRLF. Chromium confirmou tela de acesso, HTTP 200 e assets com `hub_list_members`/`hub_update_member_roles`/`expected_revision`; sem envio de formulário ou criação de sessão Auth real. Testes de gravação/concorrência usaram somente contas fictícias locais/CI. Restrições financeiras do #13 preservadas.

O [histórico](historico-papeis.md) é outra entrega em rascunho; sua migração ainda não foi aplicada em produção. O roteiro abaixo registra o procedimento utilizado e a recuperação para novas revisões, sem autorizar a publicação do histórico.

Administração vê o item Equipe na navegação, lista os integrantes do espaço e seleciona vários papéis por integrante. Salvar envia conjunto completo e revisão lida à nova RPC `hub_update_member_roles`. Não grava diretamente em `hub_members` nem usa a chamada legada como fallback. Seleção vazia não permite salvar. Após salvar, consulta novamente o próprio vínculo pela Edge; perder admin retira Equipe e suas operações. Financeiro e demais permissões são recalculados. Falha nessa atualização limpa o contexto de acesso.

`hub_list_members(w)` usa `security definer`, search_path vazio e verifica `hub_can(w,'admin',true)` antes de consultar membros. Retorna ID, e-mail, papéis e revisão dos vínculos daquele espaço. A revisão é texto no JSON para evitar perda de precisão de bigint no JavaScript. Sem permissão, retorna `42501`; anon não tem EXECUTE. Não retorna tokens, metadados Auth, credenciais ou contas sem vínculo. Não incluir identificadores reais em exemplos, screenshots, Git ou CI.

## Concorrência e compatibilidade

Reprodução no head anterior `375f1e5e44d157d4664596c0d72ff62f5d840723`: dois admins fictícios leram Comercial; A salvou Operação e B salvou Financeiro usando a seleção antiga. Financeiro persistiu, apagando Operação. O lock anterior serializava a gravação, mas não detectava o editor desatualizado.

`20261115210000_equipe_concorrencia.sql` adiciona `role_revision` (zero para vínculos existentes) e trigger que incrementa em toda alteração real de role/extra_roles. A RPC de três argumentos `hub_set_roles(w,u,r)` e o wrapper `hub_set_role` do #13 preservam assinatura, retorno boolean e comportamento. Alterações por eles também avançam a revisão. Trocar e depois restaurar os mesmos papéis não torna válida uma revisão antiga (ABA).

`hub_update_member_roles(w,u,r,expected_revision)` exige admin, bloqueia o espaço como a RPC legada e bloqueia o vínculo antes de comparar a revisão. Na mesma operação, delega a gravação à RPC existente, preservando a proteção do último admin. Não cria vínculo novo; revisão ausente/inválida e alvo removido não gravam. Nenhuma comparação ocorre antes do lock. Usuário comum ou outro espaço recebe `42501`, sem papéis/revisões na resposta.

Se a revisão divergir, retorna `status=conflict`, papéis atuais e nova revisão, sem gravar. A tela mantém a seleção antiga identificada como desatualizada, mostra os papéis vigentes e bloqueia Salvar. “Revisar a partir dos papéis atuais” carrega explicitamente o conjunto vigente; o administrador revê/edita e salva em nova tentativa. Não há retry automático. Novo conflito exige nova revisão. Salvar outro integrante não descarta as seleções pendentes nos demais formulários.

A garantia cobre a tela nova e outros clientes da RPC revisada. A chamada legada continua uma substituição incondicional autorizada por compatibilidade; clientes que a usam diretamente não ganham detecção de conflito. Seu uso deve ficar restrito às operações administrativas deliberadas; não recuperar a tela antiga de Equipe para contornar conflitos.

## Validação com dados fictícios

Código validado localmente: **`3f6ac6d2fc7daec109b6d7a9e8060b355d65a9ce`**. Execuções desse SHA: [Interface, execução 38](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43740312607) e [Supabase/transição, execução 34](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43740312617). Os links preservam o resultado remoto do candidato. O commit posterior apenas documenta esta revisão; o corpo do PR registra também seu SHA e a confirmação final dos checks, sem alterar novamente o código executado.

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/transition-validation.mjs --reset-local-fixtures
```

`supabase/tests/equipe.sql` testa listagem, revisão legada/revisada, conflito/ABA, revisão ausente, usuário comum/anon, isolamento e último admin, com ROLLBACK. `e2e/team-concurrency-real.spec.mjs` usa duas sessões PostgreSQL realmente sobrepostas, observa espera por Lock e verifica conflito depois do commit, tanto com escritor novo quanto legado. Duas sessões de navegador independentes provam o fluxo de revisão e nova tentativa sem perda de alterações. `e2e/team-real.spec.mjs` cobre edição, recarga, acesso negado, troca de espaço e auto-rebaixamento quando outro admin existe, incluindo retirada da navegação Financeiro e negação no servidor. SHA final e links dos checks ficam no corpo do PR, evitando autorreferência de commit.

Resultados locais desta revisão: tipagem, 18 unitários, builds padrão/compartilhado, três regressões SQL e seis cenários reais aprovados; cinco simulados e backup também executados. Equipe mantém a cobertura de viewport de 390 px sem overflow. Transição/recuperação e workflows do candidato final são conferidos no PR. Dados e evidências visuais são exclusivamente fictícios.

## Publicação e recuperação

1. Reconferir autorização, head/base/checks, deployment ativo e histórico remoto. Antes da publicação do #15 a produção estava em `20261114220000`; após, em `20261115210000`.
2. Em cópia operacional do SHA aprovado, repetir dry-run. Devem constar somente `20261115200000_equipe.sql` e `20261115210000_equipe_concorrencia.sql`. Não usar include-all, seeds ou reaplicar o rollout do #13.
3. Aplicar primeiro listagem, depois concorrência. Conferir história, coluna/revisão, trigger, função revisada, grants, compatibilidade da RPC antiga, isolamento e negação de não admins. Preservar papéis reais. Não usar vínculos de terceiros como teste; regressões mutantes são locais/fictícias.
4. Só então integrar o frontend. Merge na main pode disparar deploy; aguardar READY, confirmar SHA/deployment no domínio e que o cliente usa a RPC revisada sem fallback. Guardar deployment compatível e manter as revogações financeiras. Nenhuma nova publicação de Edge é necessária.

Comandos usados: `npx --yes supabase@3.0.0 db push --remote=<projeto> --workdir <copia-da-fase> --skip-vault --dry-run`; após autorização/conferência, mesmo comando sem dry-run e com confirmação. As cópias operacionais separadas ficaram em `.validation/rollout15/list` e `.validation/rollout15/revision`, extraídas dos objetos Git aprovados. O deploy automático da antiga branch de Equipe continua desabilitado em `vercel.json`; main publicou após merge conforme esperado.

Antes do frontend, falha de uma migração reverte sua própria transação; manter #13 e corrigir antes de avançar. Depois, recuperar o frontend para o deployment do #13 (`ab6427f`, `dpl_Ho86q5fP38RcURGtFvY2XUQ99dBW`), sem a tela de Equipe. Preservar RPCs aditivas, coluna/trigger de revisão, papéis e revogações dos JSONs. Não voltar à tela `375f1e5`, que sobrescreve seleções antigas; corrigir a RPC/cliente mantendo a proteção. Não reabrir leitura bruta, restaurar DEFAULT admin nem zerar revisões.

## Próximas entregas propostas

- Convites: fluxo administrativo no servidor, escopo por espaço, conjunto explícito aprovado, expiração/revogação e idempotência. Associar somente a conta verificada ao aceitar; tratar separadamente Auth e banco, sem expor chave administrativa ou registrar e-mails/tokens no CI. Nenhum convite será enviado nesta entrega.
- Histórico: implementado no servidor em [PR separado para revisão](historico-papeis.md), sem publicação. Cobre gravações legadas/revisadas, sem registrar conflitos/recusas como alterações efetivas.
## Estado dos vínculos

A proposta de desativação/reativação, ainda fora de produção, está em [desativacao-integrantes.md](desativacao-integrantes.md): confirmação por espaço, revisão compartilhada com papéis, proteção do último administrador ativo, histórico transacional e roteiro de publicação/recuperação.
