# Validação de papéis e relatórios

Entrega baseada na branch do PR #12 (`8357a4a`), que estava aberto e sem merge na conferência inicial. O trabalho começou com a árvore limpa e segue em `feat/papeis-recorte-mensal`. Nenhuma alteração local anterior foi removida.

## Implementado

- Migração de papéis por espaço, RLS por módulo, proteção das RPCs e atribuição administrativa com proteção do último administrador.
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
| SQL `financeiro_jornada.sql` | Passou; fixtures em transação revertida |
| `node scripts/local-validation.mjs` | 3 cenários Playwright passaram, com Supabase Auth, PostgREST, RLS e Edge reais locais |
| `node scripts/mock-validation.mjs` | 5 cenários Playwright passaram com sessão e API simuladas; inclui build compartilhado |
| `npx playwright test backup.spec.mjs` | 1 cenário Playwright do modo local passou, incluindo conflito entre abas e restauração |

A matriz real exercita Administração, Comercial, Operação, Financeiro, uma conta externa e acesso anônimo. Há registros em todas as tabelas protegidas de um segundo espaço para verificar isolamento. Ela testa leitura segura, recusa dos JSONs brutos e de filtros por valores ocultos, gravações comerciais e operacionais, previsão, recebimento, estorno, homologação, suporte, atribuição administrativa e proteção do último administrador. A associação sem papel explícito mantém o acesso administrativo legado. Revisões comerciais preservam implantação, mensalidade e condições, inclusive quando salvas pela interface.

A jornada real cobre triagem, diagnóstico, proposta, aceite, projeto, chamado compartilhado entre navegadores, previsão, recebimento, estorno, despesa, CSV mensal e auditoria. O login por link mágico usa apenas o e-mail capturado pelo Mailpit local e confirma a sessão após recarregar.

O build emite avisos de `use client` da dependência `lucide-react`; não impediram a compilação. As suítes de navegador compartilham a porta 4181 e devem executar em sequência. Os executores não gravam chaves em arquivos. A pilha local contém somente contas e registros fictícios; os testes reais deixam registros de negócio na pilha descartável para inspeção.

## Pendente de revisão

- Homologação humana da matriz e dos fluxos por representantes de cada papel.
- Definir os papéis dos membros reais: a migração preserva todos os membros existentes como Administração até revisão explícita.
- Atribuição de papéis disponível por RPC administrativa; não há nova tela de gestão de membros nesta entrega.
- Revisar os campos livres existentes antes de atribuir papéis restritos. A migração protege campos financeiros estruturados; não interpreta preços eventualmente escritos em escopo, título, serviços ou histórico.
- Revisão do PR e dos checks remotos. Não houve merge, migração remota, publicação de Edge Function nem deploy de produção.
- `vercel.json` desabilita deploy automático somente de `feat/papeis-recorte-mensal`, conforme a [configuração Git da Vercel](https://vercel.com/docs/project-configuration/git-configuration). As demais branches mantêm a configuração padrão; a regra não bloqueia uma publicação futura após merge aprovado.
- Planejar a publicação coordenada de migrações, Edge e frontend, pois o frontend passa a consultar as novas views. Produção e domínio continuam fora dos testes e da validação desta entrega.
