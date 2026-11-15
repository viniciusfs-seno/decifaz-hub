# Continuar o Decifaz Hub no VS Code

Abra o PowerShell no Windows. Você precisa do Git, do VS Code e do Node.js 22.12+ ou 24. Para um repositório privado, entre no GitHub com a conta que tem acesso. Caso o terminal não tenha o comando `code`, abra a pasta pelo menu **Arquivo → Abrir Pasta** do VS Code.

```powershell
git clone https://github.com/viniciusfs-seno/decifaz-hub.git
cd decifaz-hub
code .
npm.cmd ci
npm.cmd run dev
```

Se já tiver clonado, abra a pasta existente e use `git status` antes de atualizar. Com a árvore limpa, execute `git switch main` e `git pull --ff-only`. Se quiser continuar a entrega de central e conhecimento antes do merge, use `git fetch origin` e `git switch --track origin/feat/central-conhecimento-relatorios` uma vez.

Abra a URL mostrada pelo Vite. O modo local padrão usa dados fictícios. Para testar o modo compartilhado, use uma pilha Supabase local e configure as variáveis a partir de `.env.example`. Nas mudanças de código, rode `npm.cmd run check`, `npm.cmd test` e `npm.cmd run build`.

No VS Code, instale a extensão oficial [Codex](https://developers.openai.com/codex/ide), entre com sua conta ChatGPT e cole o prompt abaixo no painel da extensão.

## Prompt de continuidade

A continuação de permissões está na branch `feat/papeis-recorte-mensal`, baseada no PR #12. Antes de atualizar, preserve alterações locais. A migração de papéis e a Edge Function devem ser revisadas em conjunto com o frontend, que usa as novas views de consulta. Para repetir os testes de navegador, instale o Chromium com `npx playwright install chromium`, execute `node scripts/local-validation.mjs` com a pilha local iniciada e `node scripts/mock-validation.mjs` para a API simulada. Execute as suítes em sequência, pois usam a mesma porta do Vite. Veja `docs/validacao-papeis.md` para a evidência da entrega.

```text
Continue o Decifaz Hub neste repositório. Confira git status, a branch, os últimos commits e o estado do PR de central e conhecimento. Leia README.md, docs/vscode.md e docs/papeis-e-permissoes.md. Preserve alterações locais.

A arquitetura usa React, TypeScript e Vite na Vercel, com Supabase Auth, PostgreSQL/RLS e função Edge. A suíte Playwright usa Supabase local e contas fictícias. Mantenha produção fora dos testes.

Comece pela autorização por papel descrita na matriz: aplique as regras no banco (tabelas, RPCs e Edge), proteja valores embutidos em propostas e projetos e adapte a interface para carregar módulos independentemente. Valide acesso permitido, acesso negado, isolamento entre espaços e compatibilidade de membros existentes. Mantenha as migrações fora do Supabase de produção enquanto valida.

Depois, consolide relatórios e exportação no mesmo recorte mensal, adicione cobertura da Central e da Base de Conhecimento e confira a lista de pendências e a edição nas fichas. Rode tipagem, testes, build e workflows de navegador disponíveis. Atualize a documentação e abra um PR com o que passou e o que segue pendente. Preserve o domínio de produção existente e deixe a publicação para revisão.
```
