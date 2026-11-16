# Desativação e reativação de integrantes

PR separado em rascunho, baseado na main `d3a48e9d6d075403dfc076bbf2ed9c31d5b2b735` (#17). Nenhuma mudança desta entrega foi aplicada em produção, nenhuma Edge publicada e nenhum vínculo real alterado. Migração nova: `20261116010000_desativacao_integrantes.sql`. O SHA validado e links dos checks ficam no corpo do PR.

## Operação

Administração → Equipe lista **Ativo** ou **Desativado** em cada vínculo. Um administrador ativo do próprio espaço pode confirmar **Desativar integrante** ou **Reativar integrante**. Cancelar não grava. O diálogo informa que a ação vale somente para o espaço atual e usa os papéis já registrados; seleções de papéis não salvas são descartadas.

Desativar preserva a conta Auth, todos os papéis registrados, eventos anteriores e vínculos em outros espaços. Não encerra globalmente a sessão Auth. Reativar restaura as permissões dos papéis atualmente registrados — um admin ativo pode editar os papéis de um vínculo desativado, mas isso não o reativa. Ações de estado e de papéis compartilham `role_revision`.

É permitido desativar o próprio vínculo se existir outro administrador **ativo**. Um admin desativado não conta para a proteção do último administrador. A tela atualiza a descoberta de espaços após salvar; também consulta ao recuperar foco e a cada 30 segundos. Ao perder o espaço selecionado, limpa os dados/modais em memória e seleciona outro espaço ativo ou Meus convites. Não desloga Auth nem remove acesso aos outros espaços. O bloqueio de novas requisições no servidor é imediato após o commit, sem depender do timer ou de renovar JWT.

Dados já recebidos por uma sessão não podem ser apagados remotamente do dispositivo. Requisições/transações já autorizadas antes do commit não são canceladas retroativamente. O objetivo é negar novas operações após a desativação e remover o conteúdo da tela na próxima atualização de acesso. Não há WebSocket de revogação nesta entrega.

## Regras efetivas no servidor

| Superfície | Proteção |
| --- | --- |
| `hub_members.active` | Booleano obrigatório, default `true`: mantém todos os vínculos existentes ativos. Nenhum default de papel é reintroduzido. Nenhum grant de escrita direta ao app. |
| `hub_can` | Só autoriza vínculo ativo; papéis continuam sendo consultados no banco em cada operação, sem confiar nos papéis de um JWT antigo. |
| RLS de espaços/vínculos | `hub_workspace_read` usa `hub_can`; `hub_members_own` mostra apenas vínculos próprios ativos. Diretório administrativo usa RPC para incluir desativados. |
| RLS de módulos | Leads, triagens, reuniões, interações, atividades, propostas, projetos, previsões, recebimentos, despesas e auditoria financeira já usam `hub_can`; passam a negar o vínculo desativado. |
| Views | `hub_proposals_visible` e `hub_projects_visible` consultam `hub_can`, inclusive como views do owner. Os JSONs brutos continuam revogados. |
| RPCs comerciais/financeiras/projetos | As invoker RPCs ficam sujeitas ao RLS. As sete implementações privadas definer de proposta/projeto/previsão/recebimento/estorno/entrega/suporte já têm guard de `hub_can`, agora ativo. Dashboard não retorna os dados do espaço inacessível. |
| Gestão de Equipe/convites/histórico | Exige `hub_can(w,'admin',true)` ativo. A listagem administrativa inclui estado e revisão; a consulta do histórico segue RLS administrativo e sem escrita direta. |
| Edge `hub-workspaces` | Consulta espaços e vínculos próprios sob RLS ativo do banco, sem service-role nem papéis em cache. Mantém as colunas anteriores para compatibilidade de publicação/recuperação; não depende de adicionar `active` à resposta nem ao JWT. JWT emitido antes da desativação não contorna essas consultas. Sem espaço ativo retorna 403; com outro espaço, continua retornando o outro. |
| Convites | Criar convite para vínculo existente não o altera. Aceite com vínculo desativado retorna `inactive_member` antes de repetir um aceite antigo; pendente continua pendente e aceito não recria vínculo. Concedente desativado não pode conceder via convite antigo (`issuer_unavailable`). A caixa pessoal de convites continua disponível à identidade verificada, sem conceder acesso aos módulos. |

`hub_update_member_active(w,u,enabled,expected_revision)` bloqueia primeiro o espaço e depois o vínculo. Confere o admin **após** adquirir o bloqueio, exige revisão válida e recusa conflito sem gravar. `hub_set_roles` (legada), `hub_set_role` (wrapper) e `hub_update_member_roles` usam o mesmo bloqueio por espaço e contam somente administradores ativos. Assim, desativar e rebaixar não podem intercalar a contagem e remover todos os administradores ativos. O acesso privilegiado de manutenção do banco/Auth não é uma API do aplicativo; a entrega não implementa exclusão de contas/vínculos.

Respostas de gravação revisada incluem `active`, `roles` e `revision`. Estado e papéis compartilham a revisão: uma tela com papéis antigos não ignora uma desativação, e uma confirmação antiga não ignora mudança de papéis. O conflito mostra os papéis e estado atuais; é necessário **Revisar a partir dos papéis atuais** e confirmar novamente. Compatibilidade das assinaturas antigas é mantida; uma escrita legada em vínculo desativado preserva `active=false`.

## Histórico transacional

A trigger de `hub_members` grava eventos `deactivated`/`reactivated` em `hub_role_audit`, na mesma transação da mudança. Inclui ator, integrante, espaço, horário, `before_active`/`after_active`, papéis anteriores/novos e revisão anterior/nova. Troca de estado preserva papéis; trocar estado e papéis ao mesmo tempo por escrita privilegiada é rejeitado pelas constraints, exigindo ações distintas. A trigger continua distinguindo concedente/aceitante no caminho de Convites.

No-op, conflito e recusa não geram evento ou avanço de revisão. Falha na inserção de histórico aborta a mudança inteira, tanto na desativação quanto na reativação. SELECT de eventos exige admin ativo do mesmo espaço; app continua sem INSERT/UPDATE/DELETE/TRUNCATE. Campos de estado dos eventos históricos anteriores recebem o valor compatível com o esquema anterior (todos os vínculos eram ativos; antes da criação é nulo), sem modificar ator, horário, papéis ou revisões já gravados.

## Validação fictícia

`supabase/tests/integrantes_ativos.sql` roda em transação revertida: compatibilidade dos membros existentes, proteção do último admin ativo mesmo havendo admin inativo, revisão, no-op, caminhos legados, papel explícito, grants e falhas forçadas de histórico com rollback de desativação **e** reativação.

`scripts/member-state-migration-validation.mjs --reset-local-fixtures` recria somente o banco descartável até `20261115230000`, insere dois vínculos e três eventos fictícios, aplica o SQL novo e compara as linhas anteriores ignorando apenas os campos recém-adicionados. Papéis, revisões, atores e horários devem permanecer idênticos; ambos os vínculos ficam ativos e nenhum evento extra é criado. Restaura a pilha completa no `finally`. O workflow executa este ensaio antes da regressão histórica de transição dos papéis.

`e2e/member-state-real.spec.mjs` usa Auth/JWT reais **locais** e dados fictícios:

- Popula os dois espaços e todas as tabelas protegidas. Prova acesso antes, negação após desativar e restauração ao reativar usando o mesmo JWT, preservando outro vínculo/espaço e a conta Auth.
- Verifica todas as RPCs públicas de módulos e gestão, escrita direta via API, consultas/views, Edge e auditoria. Comum e admin de outro espaço são recusados.
- Convites antigos pendentes/aceitos não reativam o alvo; convite de concedente desativado não concede. Não duplica vínculo/evento.
- Duas sessões PostgreSQL realmente sobrepostas: espera `Lock` observada, conflito de papéis versus estado nas duas ordens e corridas entre autodesativação/rebaixamento (incluindo RPC legada) preservando o último admin ativo.
- Duas telas independentes exigem revisão do conflito. Confirmação/cancelamento, perda/recuperação de acesso da sessão aberta sem novo login, autodesativação e viewport de 390 px. Captura fictícia `equipe-estados-mobile.png` nos resultados do teste.

[Captura mobile com estados fictícios](equipe-estados-mobile.png).

Comandos:

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/member-state-migration-validation.mjs --reset-local-fixtures
node scripts/transition-validation.mjs --reset-local-fixtures
```

Os testes e a migração foram executados somente na pilha descartável `127.0.0.1`; os workflows usam a mesma referência local. Não enviar mensagens reais nem consultar tokens/UUIDs de membros reais para testar esta entrega. A branch está com deploy automático desabilitado.

## Publicação posterior, por revisão

1. Reconferir main, head, checks e histórico remoto por leitura. Preparar checkout exato aprovado e o deployment de recuperação do #17 (`d3a48e9`, `dpl_FE36cRNAq3zYKF5cWNBR7ywq25zx`). Fazer backup operacional conforme a política do projeto, sem anexar dados pessoais ao PR.
2. Dry-run deve listar **somente `20261116010000`**, com `--skip-vault`, sem seed/include-all/reaplicação. Aplicar a migração em uma transação. Conferir coluna/default, diretório/revisão, RLS/views/RPCs, grants e trigger, fontes das funções e preservação dos vínculos/roles/revisões existentes. O backfill não desativa ninguém e não cria eventos de mudança de vínculo.
3. Conferir a Edge compatível `hub-workspaces` e 401 sem sessão, usando fixture de homologação para descoberta de espaços, sem modificar vínculos reais. A consulta da Edge permanece compatível com o esquema anterior e passa a restringir vínculos por meio do novo RLS; a alteração de código nesta entrega documenta essa dependência. Banco vem primeiro; não há dependência de acrescentar estado ao JWT ou à resposta da Edge. Se publicar a fonte deste head, manter a configuração de verificação JWT já documentada pelo projeto.
4. Só então integrar/publicar o frontend; confirmar SHA/deployment no domínio. Verificar Equipe/estados/confirmação em homologação fictícia e smoke de produção sem envio/mudança de papéis reais. Não desativar ninguém como parte automática do rollout. Depois da revisão, os administradores escolhem explicitamente cada ação.

Falha na migração reverte a transação. Após aplicá-la, recuperar Edge/frontend para #17 preservando `active`, RLS, revisão e histórico da migração nova; os contratos antigos ignoram os campos extras e a Edge antiga depende do RLS ativo. O frontend antigo não exibe o estado nem permite reativação pela tela: preparar o frontend novo corrigido para retomar a gestão. Não remover a coluna, não restaurar `hub_can`/policies anteriores, não reativar vínculos em massa, não restaurar JWT como fonte de permissão nem desabilitar auditoria. Recuperação deve conservar as desativações já efetivadas e os demais espaços. Se necessário suspender gestão, revogar temporariamente EXECUTE da RPC de estado por mudança operacional revisada; não apagar eventos/vínculos nem restaurar o acesso por convite ou RPC de papéis.
