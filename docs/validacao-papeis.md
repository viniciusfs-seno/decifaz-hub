# Validação de papéis e relatórios

Entrega baseada na branch do PR #12 (`8357a4a`), que estava aberto e sem merge na conferência inicial. O trabalho começou com a árvore limpa e segue em `feat/papeis-recorte-mensal`. Nenhuma alteração local anterior foi removida.

## Implementado

- Migração de papéis por espaço, RLS por módulo, proteção das RPCs e atribuição administrativa com proteção do último administrador.
- Expansão compatível antes da restrição: o frontend e a Edge anteriores continuam operacionais enquanto todos os vínculos preservados são administrativos. O DEFAULT é removido após esse preenchimento; novas associações exigem papel explícito.
- Preços e condições são lidos da versão atual somente depois do bloqueio do lead. A regressão com duas sessões confirma que uma gravação comercial bloqueada preserva o preço recém-confirmado por Administração.
- Views de consulta que omitem os campos financeiros dos JSONs para Comercial e Operação. A concessão de execução do helper é explicitada em `20261114220000_visible_scope_execute.sql`; o helper não consulta registros comerciais.
- Comercial pode salvar escopo e criar revisões sem ler nem alterar os preços existentes. Novas propostas comerciais sem preços começam zeradas. Administração define preços e condições na proposta; Financeiro consulta esses campos e opera os lançamentos financeiros.
- Edge retorna apenas espaços autorizados e o papel do membro autenticado. Contas sem associação e sem sessão são recusadas.
- Frontend preserva módulos disponíveis quando outra carga falha, evita consultas financeiras sem permissão e restringe os editores por papel.
- Dashboard, Financeiro e CSV compartilham o mês de análise e as mesmas coleções de competência e realização. Estornos permanecem no CSV, com situação própria, e saem do total recebido.
- Central e Conhecimento: filtros, recortes vazios, busca, artigos e navegação às fichas. A regressão de abertura de projeto espera a ficha efetiva, evitando confundir o escopo da proposta com o do projeto.

## Evidência local

| Verificação | Resultado |
| --- | --- |
| `npm run check` | Passou |
| `npm test` | 17 testes passaram |
| `npm run build` | Passou no modo padrão |
| Migrações Supabase | Aplicadas somente na pilha local PostgreSQL 17; migração de papéis também aplicada desde banco recriado |
| SQL `financeiro_jornada.sql` e `papeis_associacoes.sql` | Ambos passaram; fixtures em transações revertidas |
| `node scripts/local-validation.mjs` | 4 cenários Playwright passaram, incluindo concorrência, com Supabase Auth, PostgREST, RLS e Edge reais locais |
| `node scripts/transition-validation.mjs --reset-local-fixtures` | 1 cenário passou; builds anteriores, expansão, restrição e recuperação compatível |
| `node scripts/mock-validation.mjs` | 5 cenários Playwright passaram com sessão e API simuladas; inclui build compartilhado |
| `npx playwright test backup.spec.mjs` | 1 cenário Playwright do modo local passou, incluindo conflito entre abas e restauração |

A matriz real exercita Administração, Comercial, Operação, Financeiro, uma conta externa e acesso anônimo. Há registros em todas as tabelas protegidas de um segundo espaço para verificar isolamento. Ela testa leitura segura, recusa dos JSONs brutos e de filtros por valores ocultos, gravações comerciais e operacionais, previsão, recebimento, estorno, homologação, suporte, atribuição administrativa e proteção do último administrador. Novas associações sem papel ou com papel nulo são negadas. O teste de transição cria um vínculo realmente anterior à coluna `role` e verifica sua preservação como administrador. Revisões comerciais preservam implantação, mensalidade e condições, inclusive quando salvas pela interface.

A jornada real cobre triagem, diagnóstico, proposta, aceite, projeto, chamado compartilhado entre navegadores, previsão, recebimento, estorno, despesa, CSV mensal e auditoria. O login por link mágico usa apenas o e-mail capturado pelo Mailpit local e confirma a sessão após recarregar.

O build emite avisos de `use client` da dependência `lucide-react`; não impediram a compilação. As suítes de navegador compartilham a porta 4181 e devem executar em sequência. A transição também usa 4182 e 4183. Os executores não gravam segredos administrativos; os builds de teste contêm somente a chave publicável fictícia/local. A pilha local contém somente contas e registros fictícios; os testes reais deixam registros de negócio na pilha descartável para inspeção. O executor de transição exige a opção explícita de recriação e restaura a pilha com todas as migrações ao terminar.

## Transição e concorrência

O teste gera builds reais do frontend anterior do #12 (`8357a4ac49b1d29fa0589768018f827234ccc896`) e do frontend anterior do #13 (`e1292085040722023f1331a24139620c2df25ca4`), servido como referência de recuperação compatível. A Edge anterior é executada em uma função local temporária. A expansão mantém a leitura antiga; novas versões são verificadas antes da restrição. A atribuição restrita é recusada antes de revogar a leitura bruta. Depois disso, o frontend compatível continua operando com Comercial, enquanto o #12 falha de forma fechada. Não há recuperação por reabertura dos privilégios.

Na regressão de concorrência, a primeira sessão PostgreSQL, autenticada como Administração, bloqueia o lead e altera implantação, mensalidade e condições, sem confirmar a transação. A segunda sessão, como Comercial, inicia a RPC; o teste observa sua espera por bloqueio em `pg_stat_activity`. Após o commit da primeira, Comercial salva o escopo preservando os três valores mais recentes. Não há espera fixa usada como prova de concorrência.

## Evidência remota desta revisão

Os checks do #12 foram conferidos no SHA `8357a4ac49b1d29fa0589768018f827234ccc896`: [Interface compartilhada aprovada](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43633658802) e [Supabase local e navegador aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43633658833). O check Vercel também está aprovado. Não havia reviews ou threads de revisão registradas. O #12 permanece aberto, sem merge; o #13 continua baseado nele. As instruções do #14 foram lidas diretamente na branch `docs/padrao-de-pull-requests`, ainda aberta.

Código validado localmente e no CI: **`f7de4eb225dec85bc254c74728085fa4e924f49f`**. A validação não reutiliza o sucesso da implementação anterior. Atualizações posteriores exclusivamente documentais não alteram os arquivos executados por esses testes; o corpo do PR identifica também o head documental atual.

- [Interface compartilhada — aprovado, execução 23](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43710846248): tipagem, 17 testes unitários, build compartilhado, 5 cenários simulados e 1 cenário do modo local.
- [Supabase local e navegador — aprovado, execução 19](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43710846213): inicialização limpa, duas regressões SQL, 4 cenários reais e o cenário de transição/recuperação, com os builds anteriores fixados por SHA.
- **Não executados:** migrações em produção, deploy de Edge, deploy de frontend, merge e atribuição de papéis reais. Permanecem para revisão.

A execução inicial desta revisão detectou uma referência permanente à função temporária em um checkout limpo. A configuração agora é instalada somente durante o teste, preservada e restaurada byte a byte; o executor recusa sobrescrever uma fixture já existente ou uma alteração concorrente na configuração. A subida normal sem a fixture e os workflows acima passaram após a correção.

## Pendente de revisão

- Homologação humana da matriz e dos fluxos por representantes de cada papel.
- Definir os papéis dos membros reais: a migração preserva todos os membros existentes como Administração até revisão explícita.
- Atribuição de papéis disponível por RPC administrativa; não há nova tela de gestão de membros nesta entrega.
- Revisar os campos livres existentes antes de atribuir papéis restritos. A migração protege campos financeiros estruturados; não interpreta preços eventualmente escritos em escopo, título, serviços ou histórico.
- Revisão do PR e dos checks remotos. Não houve merge, migração remota, publicação de Edge Function nem deploy de produção.
- `vercel.json` desabilita deploy automático somente de `feat/papeis-recorte-mensal`, conforme a [configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration). As demais branches mantêm a configuração padrão; a regra não bloqueia uma publicação futura após merge aprovado.
- Aprovar o [roteiro de publicação e recuperação](publicacao-papeis.md). A ordem técnica é expansão do banco, Edge com papel, frontend com views, revogação/ativação e só então atribuição dos papéis homologados. Não houve execução remota. Produção e domínio continuam fora dos testes e da validação desta entrega.
