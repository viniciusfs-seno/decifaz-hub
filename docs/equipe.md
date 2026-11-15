# Administração → Equipe

Entrega em PR separado, em rascunho, sobre a main com #13 integrado. Não publicada. A migração `20261115200000_equipe.sql` foi aplicada somente na pilha fictícia local; não alterar o banco de produção nesta revisão.

Administração vê o item Equipe na navegação, lista os integrantes do espaço e seleciona vários papéis por integrante. Salvar envia o conjunto completo à RPC existente `hub_set_roles`; não grava diretamente em `hub_members`. A seleção vazia não permite salvar. A tela apresenta carregamento, erro, lista vazia e recusa do último administrador. Após salvar, consulta novamente o vínculo do usuário pela Edge; a perda do próprio papel administrativo remove o acesso à tela. Falha nessa atualização limpa o contexto de acesso.

`hub_list_members(w)` é a única RPC nova. Usa `security definer`, search_path vazio e verifica `hub_can(w,'admin',true)` antes de consultar membros. Retorna somente ID do usuário, e-mail e conjunto de papéis dos vínculos daquele espaço. Sem permissão, retorna `42501`; anon não tem EXECUTE. Não retorna tokens, metadados Auth, credenciais ou contas sem vínculo. E-mails e IDs reais são dados de execução para Administração: não incluí-los em exemplos, screenshots, Git ou CI.

A proteção do último administrador e o isolamento continuam na RPC de escrita do #13, inclusive se o frontend estiver desatualizado ou for manipulado. O diretório não concede escrita direta em membros e não cria contas/convites. Os conjuntos são substituídos integralmente; alterações simultâneas do mesmo vínculo usam a regra atual da RPC (última gravação autorizada), mantendo a serialização por espaço e a proteção do último admin.

## Validação com dados fictícios

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/transition-validation.mjs --reset-local-fixtures
```

`supabase/tests/equipe.sql` testa listagem e edição por admin, conjunto persistido, usuário comum/anon negados, outro espaço negado e último administrador preservado, em transação revertida. `e2e/team-real.spec.mjs` testa seleção múltipla, gravação real via RPC, recarga, recusa do último admin, chamadas diretas não autorizadas e troca para um espaço onde a mesma pessoa não é admin. Os executores e o workflow Supabase incluem essas regressões. Resultados e SHA final ficam no corpo do PR.

Nesta revisão passaram tipagem, 18 testes unitários, builds padrão/compartilhado, três regressões SQL, cinco cenários reais (incluindo Equipe), cinco simulados e backup. Equipe cobre também auto-rebaixamento permitido quando existe outro admin, remoção imediata da navegação administrativa e viewport de 390 px sem overflow. Evidência visual usa somente contas fictícias. Um timeout inicial foi localizado no seletor de espaço do teste; a busca pelo papel acessível de combobox corrigiu o seletor sem reduzir as asserções. Checks e transição do SHA final são conferidos no PR antes de entregar a revisão.

## Publicação futura e recuperação

Requer autorização própria, depois da revisão do PR: aplicar somente a nova migração aditiva e verificar 401/42501/isolamento; depois integrar o frontend. O frontend atual de produção não depende da listagem nova. Não reaplicar migrações históricas nem o rollout do #13. Antes de publicar, comparar o histórico remoto e confirmar o dry-run. A branch de Equipe tem deploy automático desabilitado em `vercel.json`, assim como a antiga branch de papéis.

Recuperar o frontend para o deployment do #13 preservando a RPC aditiva, as revogações dos JSONs e todos os vínculos. A migração de listagem não altera papéis. Nenhuma recuperação deve reabrir leitura bruta ou restaurar DEFAULT administrativo.
