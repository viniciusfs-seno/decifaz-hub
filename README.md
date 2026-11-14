# Decifaz Hub

Portal interno da Decifaz para gerenciar o funil comercial. O frontend usa React, TypeScript e Vite, com deploy na Vercel. O Supabase fornece login por link de e-mail, PostgreSQL, RLS e a função Edge que lista os espaços autorizados.

## Desenvolvimento local

Requisitos: Node.js 22.12+ ou 24.

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

A execução local padrão usa registros fictícios salvos no navegador. Para testar o modo compartilhado, copie `.env.example` para `.env.local`, configure `VITE_HUB_MODE=shared` e preencha a URL e a chave **publicável** do Supabase. Adicione a origem local exata em Redirect URLs apenas se precisar testar o login local.

## Deploy e operação

- Frontend oficial: [decifaz-hub.vercel.app](https://decifaz-hub.vercel.app/).
- Em produção, use esse endereço em **Site URL** e **Redirect URLs** no Supabase Auth. O endereço se mantém entre deploys.
- Na Vercel, configure as variáveis do exemplo para o ambiente desejado. O build incorpora as variáveis `VITE_`; mantenha senhas e chaves administrativas fora delas. Domínios `.vercel.app` exigem login compartilhado.
- As migrações versionadas ficam em `supabase/migrations/` e a função de acesso em `supabase/functions/hub-workspaces/`.
- Consulte [configuração e homologação](docs/piloto-supabase.md) e [propostas e projetos](docs/propostas-e-projetos.md).

## Fluxo compartilhado

O CRM, a triagem, as reuniões, as atividades vinculadas e os indicadores consultam o Supabase. Propostas registram versões e andamento. O aceite explícito permite abrir um projeto com uma cópia do escopo, serviços, valores e condições aprovados. O projeto permite acompanhar responsável, prazo, situação e entregáveis.

A demonstração local mantém os módulos legados e os dados fictícios. O financeiro compartilhado registra previsões de receita, recebimentos, estornos e despesas com baixa manual. Integração de pagamentos e emissão de contratos ainda ficam fora desse fluxo. Veja [financeiro compartilhado](docs/financeiro-compartilhado.md).

## Organização

- `src/domain.ts` contém as entidades, critérios e métricas.
- `src/pilot-app.tsx` e `src/pilot-journey.ts` implementam o modo compartilhado.
- `src/repository.ts` cuida da persistência local da demonstração.
- `src/manual.json` guarda o manual estruturado.
