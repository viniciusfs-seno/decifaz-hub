# Validação de papéis e relatórios

## Rollout concluído em produção

Autorização explícita recebida para o candidato `bab124d48d3ac234ec43ab63d629b20ec48090f1`, reconferido sem mudança de base/head e com os dois checks aprovados. #13 integrado em `ab6427fc8d66de9bb959a0beda173ac1e8031ea1`; [Interface main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43736345907) e [Supabase main](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43736345894) aprovados. Deployment `dpl_Ho86q5fP38RcURGtFvY2XUQ99dBW`, READY/production, confirmado no domínio principal e no SHA de integração.

Aplicadas em ordem: `20261114200000`, Edge compatível v2, frontend com views, `20261114210000`, `20261114220000`. Histórico remoto com 14 versões; hardened=true; SELECT bruto negado nos dois JSONs; views consultadas no contexto do administrador verificado. Fonte da Edge remoto corresponde ao aprovado; chamadas sem sessão/inválidas retornaram 401. Chromium confirmou a tela de acesso e os assets novos. Não foi criada sessão Auth de usuário em produção; jornada autenticada e resposta Edge com papéis exercitadas pelas suítes locais/CI.

O único vínculo real aprovado recebeu exatamente os quatro papéis pela RPC administrativa, com direito de gestão validado no mesmo espaço e preservação dos demais vínculos. Leitura independente confirmou a persistência; detalhes pessoais permaneceram somente na operação privada. O primeiro comando multilinha não persistiu o conjunto; detectado pela leitura e corrigido com bloco atômico em uma linha. Restrições nunca foram reabertas. Registro completo e artefatos de recuperação em [publicacao-papeis.md](publicacao-papeis.md).

A tela Administração → Equipe e sua migração aditiva são entrega separada, ainda não publicada; consultar [equipe.md](equipe.md). Os estados pendentes nas seções seguintes são evidências históricas anteriores à autorização.

## Preparação do rollout com conjunto aprovado

Aplicação reconferida no head **`cd6ceaaadef716685223eb7b6c7f0e8a2ac24823`**, base main **`304922f4e13f22181e12032f31ea75e6eccec4be`**. PR #13 aberto e em rascunho. Checkout atualizado por fast-forward a partir de árvore limpa; nenhum trabalho local descartado. [Interface aprovada, execução 34](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43729209219) e [Supabase/transição aprovado, execução 30](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43729209271) pertencem ao candidato cumulativo, não aos SHAs históricos abaixo.

**Aprovação de atribuição:** um único vínculo existente pode receber explicitamente `admin`, `commercial`, `operations`, `finance` e administrar conjuntos de outros vínculos no próprio espaço. Identidade mantida exclusivamente na instrução privada/operação; não replicar e-mail ou UUID real nesta documentação, artefatos ou CI. Nenhum outro conjunto real aprovado. **Autorização do rollout ainda não registrada**: nenhuma fase aplicada nem atribuição executada.

| Verificação repetida nesta rodada | Resultado |
| --- | --- |
| `npm run check`; `npm test`; `npm run build` | Aprovados; 18 testes unitários, build padrão com aviso não bloqueante do lucide |
| `node scripts/transition-validation.mjs --reset-local-fixtures` | Aprovado no candidato cd6ceaa; expansão e restrição dos pacotes separados, clientes anteriores, views e recuperação sem reabrir JSONs |
| `node scripts/local-validation.mjs` | Duas regressões SQL e quatro cenários Playwright aprovados, inclusive concorrência de preços, papéis cumulativos e isolamento |
| `supabase/tests/papeis_associacoes.sql` ampliado | Conjunto de quatro papéis mantém gestão administrativa; admin altera conjunto de outro vínculo; usuário comum não altera outro vínculo; último admin não pode ser removido nem pela RPC de conjuntos. Fixtures fictícias e ROLLBACK |
| `node scripts/mock-validation.mjs`; `npx playwright test backup.spec.mjs` | Build compartilhado, 5 cenários simulados e 1 de backup aprovados |
| `node scripts/prepare-role-artifacts.mjs cd6ceaaadef716685223eb7b6c7f0e8a2ac24823` | 210 arquivos; manifesto gerado e reconferido. SHA-256 `480eaceb316fbe416f2313b698e1a9d947393192adef16ed15ddcc3a946c716a` |
| Dry-run remoto de A, CLI 3.0.0 com `--skip-vault --dry-run` | Somente `20261114200000_expansao_compativel.sql`; nenhuma migração aplicada |

Leitura remota reconfirmou: uma única conta correspondente, confirmada; um único vínculo para ela e um único espaço. UUIDs resolvidos apenas em memória e suprimidos da saída, sem gravar dados pessoais. `hub_set_roles` ausente; 11 migrações, até `20261114181046`; nenhuma migração de papéis. Edge `hub-workspaces` ACTIVE v1, `verify_jwt=true`, código remoto baixado apenas por leitura para recuperação. API Vercel reconfirmou o domínio no deployment `dpl_G22ENmxVFTwmJXB7w4S1fHw9zQMU`, READY/production, SHA `304922f`. Nenhuma sessão, credencial ou dado pessoal de produção foi usado nos testes.

O [roteiro](publicacao-papeis.md) registra comandos preparados, hashes atualizados (os anteriores a papéis cumulativos não são candidatos de publicação), critérios por fase e recuperações. Depois de D usar pacote cumulativo com views e Edge `roles`/`role`, preservando RLS/revogações. Não executados: apply remoto, deploy Edge, merge/frontend, atribuição real e verificação do conjunto persistido real (dependem do rollout autorizado). Próxima entrega proposta: Administração → Equipe com seleção múltipla, em PR separado. Resultados do head final de testes/documentação e seus checks são registrados no corpo do PR sem alterar novamente os artefatos da aplicação.

## Evidências históricas

As seções abaixo registram rodadas anteriores e seus SHAs. A regra atual reserva aceite/lead Ganho à Administração e soma papéis por vínculo; declarações anteriores de aceite pelo Comercial ou de papel único não descrevem o candidato atual.

## Homologação preparada em 15/11/2026

Candidato de aplicação/artefatos validado: **`b4737477f5e2ac308a004d82c8aa5be112780400`**, base main `304922f4e13f22181e12032f31ea75e6eccec4be`. A rodada começou na branch `feat/papeis-recorte-mensal`, árvore limpa e head `14e0ae3`, conferido no Git e no PR #13. Não houve rebase ou alteração da base nesta rodada. O commit posterior que registra estas evidências é somente documental; conferir seu head e checks no corpo do PR.

A [matriz detalhada](homologacao-papeis.md) compara tabelas, views, RPCs e Edge, deixa todas as decisões dos sócios reunidas e uma tabela privada por membro/espaço sem preencher. Pontos explícitos: somente Administração define preço/condições e papéis; Financeiro consulta preço/condições sem editar proposta; Comercial pode registrar aceite sem vê-los. Não há restrição por responsável no mesmo espaço. Manual e materiais estáticos são públicos nos assets; conteúdo confidencial exige outra solução.

| Comando / verificação local | Resultado |
| --- | --- |
| `npm run check` | Aprovado |
| `npm test` | 17/17 aprovados |
| `npm run build` | Aprovado; avisos não bloqueantes de `use client` do lucide |
| `node scripts/local-validation.mjs` | Duas regressões SQL e 4 cenários Playwright aprovados; permitido/negado, JSONs, Edge, isolamento, membros existentes, papel omitido/nulo, último admin e duas sessões concorrentes |
| `node scripts/mock-validation.mjs` | Build compartilhado e 5/5 cenários aprovados; filtros, vazios, fichas, falha independente e mês comum ao CSV |
| `npx playwright test backup.spec.mjs` | 1/1 aprovado |
| `node scripts/prepare-role-artifacts.mjs b4737477f5e2ac308a004d82c8aa5be112780400` | 210 arquivos separados por fase, manifesto SHA-256; segunda execução verificou conteúdo sem sobrescrita |
| `node scripts/transition-validation.mjs --reset-local-fixtures` | Aprovado com SQLs dos artefatos A/D; builds históricos, Edge antiga, expansão, views, revogação antes de papel restrito e recuperações antes/depois da revogação |
| Consulta local de privilégios após restaurar migrações | `hardened=true`, DEFAULT de papel nulo, SELECT de `record`/`approved` para authenticated false |

Total: 11 cenários Playwright e duas regressões SQL, somente em `127.0.0.1`, com dados fictícios. O teste de alteração fictícia de um arquivo no pacote B foi recusado pelo manifesto; bytes originais restaurados e manifesto reconferido. A primeira preparação encontrou `vercel.json` ausente na baseline antiga; a seleção foi corrigida antes do candidato validado e o pacote antigo não ganhou configuração nova.

Artefatos locais: `.validation/role-release/b4737477f5e2ac308a004d82c8aa5be112780400/`. Manifesto SHA-256: `ccba34cf345edcc3d1c27b84ae8a9ba8e293f99e62dda4203caa396f92a478d0`. Pastas A/B/C/D e recuperações estão descritas com os critérios de avanço no [roteiro](publicacao-papeis.md). Os pacotes são fontes, sem credenciais nem build publicável; não foram enviados a produção.

CI do candidato: [Interface aprovada, execução 30](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43725781662) e [Supabase/transição aprovado, execução 26](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43725781733). Ambos concluídos com sucesso; nenhuma falha reproduzível de autorização ou transição nesta rodada.

### Fotografia remota, somente leitura

`supabase@3.0.0 projects list`, `functions list --project-ref lnteuryqkabnpcixguxh` e `db query --remote=lnteuryqkabnpcixguxh --read-only` confirmaram projeto ativo, PostgreSQL `17.11.0.019`, 11 migrações até `20261114181046` e Edge `hub-workspaces` ACTIVE v1 com `verify_jwt=true`. Nenhuma migração do #13 consta no histórico remoto. Consultas a `information_schema.columns`, `to_regclass` e `has_column_privilege` confirmaram coluna `role` ausente, ambas as views ausentes e leitura dos JSONs brutos ainda concedida, como esperado na versão anterior. Nenhuma linha de negócio ou membro real foi consultada/alterada. Histórico e metadados não substituem comparação integral de schema/código remoto; repetir leitura e dry-run do artefato autorizado na janela de publicação.

Na fase B será necessário configurar especificamente `hub-workspaces` com `verify_jwt=false`, pois a Edge compatível valida a sessão com `getClaims` no código; não copiar a configuração local inteira para produção. Ordem obrigatória: expansão → Edge compatível → frontend com views → restrição dos JSONs → papéis homologados. Antes da restrição pode recuperar frontend/Edge antigos mantendo expansão; depois, somente par compatível com views/papel, preservando restrições. Não executados: merge #13, migração remota, publicação Edge/frontend dos papéis ou atribuição real. Continuam pendentes todas as decisões dos sócios listadas na matriz; nenhum teste manual do usuário é necessário para esta evidência técnica.

O #13 agora tem base `main`, em `304922f4e13f22181e12032f31ea75e6eccec4be`, após os squash merges do #14 e do #12. O trabalho começou com a árvore limpa e segue em `feat/papeis-recorte-mensal`. Nenhuma alteração local anterior foi removida. O PR permanece em rascunho; suas fases de publicação ainda não foram executadas.

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

## Evidência anterior à integração

Antes dos merges, os checks do #12 foram conferidos no SHA `8357a4ac49b1d29fa0589768018f827234ccc896`: [Interface compartilhada aprovada](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43633658802) e [Supabase local e navegador aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43633658833). O check Vercel estava aprovado e não havia reviews ou threads bloqueantes. As instruções do #14 foram lidas em sua branch antes de integrar o padrão à main.

Código validado localmente e no CI: **`f7de4eb225dec85bc254c74728085fa4e924f49f`**. A validação não reutiliza o sucesso da implementação anterior. Atualizações posteriores exclusivamente documentais não alteram os arquivos executados por esses testes; o corpo do PR identifica também o head documental atual.

- [Interface compartilhada — aprovado, execução 23](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43710846248): tipagem, 17 testes unitários, build compartilhado, 5 cenários simulados e 1 cenário do modo local.
- [Supabase local e navegador — aprovado, execução 19](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43710846213): inicialização limpa, duas regressões SQL, 4 cenários reais e o cenário de transição/recuperação, com os builds anteriores fixados por SHA.
- **Não executados para o #13:** migrações em produção, deploy de Edge/frontend, merge e atribuição de papéis reais. Permanecem para revisão.

A execução inicial desta revisão detectou uma referência permanente à função temporária em um checkout limpo. A configuração agora é instalada somente durante o teste, preservada e restaurada byte a byte; o executor recusa sobrescrever uma fixture já existente ou uma alteração concorrente na configuração. A subida normal sem a fixture e os workflows acima passaram após a correção.

## Integração do padrão e da entrega comercial

- #14 integrado em `3206234a70c5080f459facc8a329fae85aac5741`. Checks do head `3bdb3d0` aprovados antes do merge; diff limitado a AGENTS, CONTRIBUTING e template. Na main: [Interface aprovada](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43713998564), [Supabase aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43713998612) e [deploy Vercel concluído](https://vercel.com/vinicius-ferreiras-projects-84ef88fb/decifaz-hub/Fg5zSGURErbZcM4RasPfYX8wKLgW).
- #12 integrado em `304922f4e13f22181e12032f31ea75e6eccec4be`, após verificar diff e merge limpo contra a main com o #14. Na main: [Interface aprovada](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43714245700), [Supabase aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43714245643) e [deploy Vercel concluído](https://vercel.com/vinicius-ferreiras-projects-84ef88fb/decifaz-hub/G22ENmxVFTwmJXB7w4S1fHw9zQMU). O emissor Vercel registrou `success`, descrição `Deployment has completed`, no commit de integração.
- A página pública `https://decifaz-hub.vercel.app/` respondeu HTTP 200 no Chromium automatizado e exibiu título, campo E-mail e botão Enviar link de acesso, sem alertas. Nenhum formulário foi enviado. Evidência local: `.validation/producao-login.png`. A jornada autenticada usa os checks existentes, sem criar dados ou sessões de produção.
- Confirmação direta após autorizar o projeto na integração Vercel: `get_alias(decifaz-hub.vercel.app)` retornou o projeto `prj_x1RVGR5XNxpETAnGeDhSqQxB888u` e o deployment `dpl_G22ENmxVFTwmJXB7w4S1fHw9zQMU`. A consulta desse deployment confirmou `readyState=READY`, `target=production`, branch `main` e SHA **`304922f4e13f22181e12032f31ea75e6eccec4be`**. URL imutável: `https://decifaz-4dab1f0tk-vinicius-ferreiras-projects-84ef88fb.vercel.app`. A pendência de associação alias/deployment está resolvida pela API; não depende de inferência pelos assets ou somente do check GitHub.

## Reorganização e revalidação do #13

O head remoto anterior `48ff670c6ce19f47d22d5f817bb9a86970dc2f65` foi preservado na tag `validation/pr13-before-main-48ff670`, conferida com `git ls-remote`. A tag mantém acessíveis também os snapshots `8357a4a` e `e129208` usados pela regressão de transição. O PR foi retargetado para main e os quatro commits próprios foram reaplicados:

| Antes | Após rebase |
| --- | --- |
| e129208 | ef4c754 |
| 7ed9c1b | 6f917b1 |
| f7de4eb | f8a41a0 |
| 48ff670 | d2a8b6e |

`git range-diff 8357a4a..archive/pr13-before-main-48ff670 origin/main..HEAD` marcou os quatro patches com `=`. A comparação de árvores entre o head antigo e o reaplicado mostrou somente os três arquivos integrados pelo #14. O diff contra main não volta a adicionar Central Comercial ou Base de Conhecimento. O envio usou `--force-with-lease` contra o head remoto anterior exato.

SHA reaplicado e revalidado local e remotamente: **`d2a8b6ed23780ec56aaca7c0c51b31a08ab138ee`**, base `304922f`. Os comandos da tabela local foram repetidos: tipagem, 17 testes unitários, builds padrão/compartilhado e dos snapshots históricos, duas regressões SQL e 11 cenários Playwright. [Interface compartilhada aprovada, execução 27](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43715023231) e [Supabase local e navegador aprovado, execução 23](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43715023514) confirmam o novo SHA. Atualizações posteriores somente documentais não mudam os artefatos de aplicação identificados no roteiro de publicação; o corpo do PR registra também o head documental e seus checks.

## Pendente de revisão

- Homologação humana da matriz e dos fluxos por representantes de cada papel.
- Definir os papéis dos membros reais: a migração preserva todos os membros existentes como Administração até revisão explícita.
- Atribuição de papéis disponível por RPC administrativa; não há nova tela de gestão de membros nesta entrega.
- Revisar os campos livres existentes antes de atribuir papéis restritos. A migração protege campos financeiros estruturados; não interpreta preços eventualmente escritos em escopo, título, serviços ou histórico.
- Revisão do #13 e aprovação das fases de publicação. Não houve merge desse PR, migração de papéis em produção ou publicação de sua Edge/frontend. #14 e #12 foram integrados conforme autorização desta etapa.
- `vercel.json` desabilita deploy automático somente de `feat/papeis-recorte-mensal`, conforme a [configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration). As demais branches mantêm a configuração padrão; a regra não bloqueia uma publicação futura após merge aprovado.
- Aprovar o [roteiro de publicação e recuperação](publicacao-papeis.md), com artefatos identificados por objetos Git e critérios para avançar. A ordem é expansão do banco, Edge com papel, frontend com views, revogação/ativação e atribuição dos papéis homologados. Nenhuma dessas fases foi executada remotamente. Apenas a tela pública de acesso foi conferida em produção; todos os testes autenticados continuam locais/fictícios.

## Papéis acumuláveis e alçada de aceite

O candidato atualizado exige regenerar os artefatos. As evidências anteriores se referem aos SHAs daquela rodada. A regressão desta revisão testa papéis cumulativos, bloqueio de autoelevação, resposta da Edge e bloqueio do aceite e da transição direta para Ganho sem Administração.
