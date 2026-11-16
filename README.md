# Decifaz Hub

Em revisão: [Comercial e Gerencial](docs/comercial-gerencial.md), com catálogo compartilhado, proposta versionada, reunião/apresentação, indicadores filtráveis e fechamento semanal persistido. A documentação reúne os PRs encadeados, capturas desktop/celular, limites da prévia local e a ordem de publicação/recuperação. Produção permanece para aprovação posterior.

Portal interno da Decifaz para gerenciar o funil comercial. O frontend usa React, TypeScript e Vite, com deploy na Vercel. O Supabase fornece login por link de e-mail, PostgreSQL, RLS e a função Edge que lista os espaços autorizados.

O [Hub Operacional](docs/operacional.md) reúne dashboard com recortes navegáveis, agenda persistida, revisão semanal e ficha integrada no modo compartilhado. A documentação inclui a comparação com a demo, capturas de desktop/celular, prévia local com dados fictícios e o roteiro de publicação e recuperação. Esta entrega permanece em rascunho, sem publicação em produção.

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

## Homologação e pós-venda

No projeto compartilhado, confirme os três itens do checklist e registre a data e a evidência para marcar a entrega como aceita. A opção de pós-venda cria uma atividade vinculada ao projeto e ao estabelecimento na mesma operação. A entrega também aparece no histórico do CRM. O financeiro exporta o relatório CSV e exibe o histórico recente de alterações.

O projeto também exibe as atividades de pós-venda vinculadas, com responsável, prazo e situação. O CI roda o teste de navegador do modo compartilhado com sessão e API simuladas.

Abra chamados pela ficha do projeto com título, responsável e prazo. A ficha mantém o histórico e permite mudar a situação. A Agenda operacional reúne as atividades de projeto ainda pendentes ou em andamento e destaca as vencidas.

### Teste de integração com Supabase local

O workflow **Supabase local e navegador** sobe uma pilha descartável com Docker, aplica as migrações e cria três contas fictícias. Dois membros autenticados compartilham um chamado entre contextos independentes do navegador. A terceira conta confirma o isolamento dos registros. O teste usa sessões reais obtidas por senha de fixture. Um segundo teste solicita um link mágico pela interface, lê o e-mail capturado pelo Mailpit local e verifica o retorno ao portal e a sessão após recarregar.

O teste com Supabase local também exercita a previsão de receita, o recebimento parcial e o estorno pela interface. Ele confirma que o recebimento original fica no banco, que o estorno altera o total exibido e que uma conta externa ao espaço não consulta o lançamento.

A regressão do Chromium com Supabase local percorre o cadastro do estabelecimento, rascunho, envio e aceite da proposta pela interface. Também cobre a criação do projeto, a baixa de despesa e o CSV filtrado por mês, com verificação dos registros de auditoria.

O cenário comercial também valida a prioridade após a triagem, a evolução do funil ao registrar o diagnóstico e a persistência da atividade de acompanhamento. A proposta do teste é aberta pela reunião realizada.

Para continuar no editor, consulte o [guia de VS Code e prompt de continuidade](docs/vscode.md). A [matriz de papéis](docs/papeis-e-permissoes.md) foi implementada em uma migração em validação local. A produção continua fora desta entrega. Consulte os [resultados e pendências](docs/validacao-papeis.md) antes de revisar a publicação.
