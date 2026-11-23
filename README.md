# Decifaz Hub

Portal de trabalho compartilhado da Decifaz para a rotina comercial, contratos, projetos, reuniões e obrigações internas. React, TypeScript e Vite na Vercel; Supabase Auth, PostgreSQL, RLS e Edge fornecem persistência e autorização por espaço e papéis cumulativos.

Guia de operação, cobertura de auditoria, migrações e recuperação: [rotina dos sócios](docs/rotina-socios.md).

Para começar no portal: **Conhecimento → Base de conhecimento → Início diário dos sócios**. [Diretório autorizado, validação e publicação do guia](docs/inicio-diario.md).

Preparação diária: [nomes por espaço, guia em três passos e recuperação](docs/preparacao-diaria.md).

Reunião do projeto → [Tela por link](docs/compartilhamento-tela.md): fonte escolhida no navegador, um espectador aprovado, convite temporário e visualizador sem acesso ao Hub. Conexão direta por WebRTC; sem TURN, algumas redes podem exigir a chamada externa.

Contexto de produto e UI: [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) e [revisão Impeccable da mesa de trabalho](docs/impeccable/mesa-de-trabalho.md), com comparações e validações da branch de revisão.

## Começar a usar

1. No CRM, cadastre um estabelecimento ou importe um CSV, confira duplicidades e conclua a triagem com evidências. Registre a abordagem e planeje a próxima ação. A Agenda reúne as atividades; concluir pode criar o próximo acompanhamento na mesma transação.
2. Prepare a proposta em etapas. O aceite administrativo explícito e a confirmação de Ganho permitem abrir o projeto com o escopo e condições aprovados preservados. Pela ficha do projeto, acompanhe entregas, suporte, reuniões, atas e atividades resultantes.
3. Em Contratos, cadastre um contrato existente ou derivado de proposta, informe responsável, vigência e avisos e anexe o PDF assinado privado. Em Obrigações da Decifaz, cadastre domínio anual, hospedagem e assinaturas, confira vencimentos e registre pagamentos manuais.
4. Use Dashboard e Agenda para priorizar o dia. A busca do cabeçalho consulta estabelecimentos, projetos e contratos autorizados; Indicadores e CSV usam o mesmo recorte. Consulte Rastreabilidade para os eventos cobertos e Equipe para gestão administrativa dos vínculos.

## Guias dos fluxos

- [Ficha dedicada, rascunhos e propostas em etapas](docs/fichas-e-propostas.md), [ficha e auditoria](docs/ficha-compartilhada.md), [CRM paginado e exportação completa](docs/crm-paginado.md), [busca global autorizada e rotina dos sócios](docs/busca-global.md).
- [Prospecção](docs/prospeccao.md), [importação CSV](docs/importacao-csv.md), [atividades e acompanhamentos](docs/atividades-acompanhamentos.md), [Hub Operacional](docs/operacional.md).
- [Comercial e Gerencial](docs/comercial-gerencial.md), [fontes do histórico de indicadores](docs/historico-indicadores.md), [propostas e projetos](docs/propostas-e-projetos.md).
- [Contratos e rastreabilidade](docs/contratos-rastreabilidade.md), [obrigações e assinaturas](docs/obrigacoes-decifaz.md), [reuniões de projeto](docs/reunioes-projetos.md).
- [Hierarquia e componentes](docs/hierarquia-e-usabilidade.md), [experiência do portal](docs/experiencia-portal.md), [publicação integrada #19–#22](docs/publicacao-integrada.md).

Os avisos são internos ao abrir o portal; não há cobrança automática nem notificação externa com o portal fechado. Videoconferência completa permanece planejada. O link de chamada externa continua disponível, e a prévia local é distinta de Tela por link, que transmite a um espectador aprovado. Assinatura eletrônica é integração futura; anexar um PDF não verifica sua assinatura. Veja os limites e procedimentos de recuperação em cada guia. SHAs, checks e estado efetivo de publicação estão nos respectivos PRs.

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

A demonstração local mantém os módulos legados e os dados fictícios. O financeiro compartilhado registra previsões de receita, recebimentos, estornos e despesas com baixa manual. Integração automática de pagamentos e assinatura eletrônica ficam fora desse fluxo; a gestão de contratos usa documentos privados anexados. Veja [financeiro compartilhado](docs/financeiro-compartilhado.md).

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

Para continuar no editor, consulte o [guia de VS Code e prompt de continuidade](docs/vscode.md). A [matriz de papéis](docs/papeis-e-permissoes.md) é aplicada no servidor; consulte os [resultados e limites](docs/validacao-papeis.md) e o histórico dos PRs de publicação.

[Ficha compartilhada e auditoria](docs/ficha-compartilhada.md).

[Paginação do CRM, busca e exportação completa](docs/crm-paginado.md).

[Fontes e limites do histórico de indicadores e roteiro integrado](docs/historico-indicadores.md).

## Prioridades dos sócios

Tela por link segue em homologação no PR #40, sem publicação: [fluxo e diagnóstico](docs/compartilhamento-tela.md), [revisão final, limites e preparação dos segredos na Edge](docs/revisao-publicacao-tela.md). A prova de relay do SHA62ebd6e está preservada com capturas e hashes do código. Áudio útil e região permanente continuam pendentes; chamada externa permanece disponível. Os avisos internos #42/#43 são independentes da transmissão.


- [Central de vencimentos e preferências](docs/central-vencimentos.md): recorte autorizado, pagamento na origem, reagendamento com motivo e avisos pessoais. Publicada pelos PRs #42/#43, com geração interna no servidor, e-mail desligado e sem dependência da transmissão do PR #40.

- [Contratos, documentos privados e rastreabilidade](docs/contratos-rastreabilidade.md): cadastro existente ou derivado de proposta, avisos, revisões e trilha por integrante.
- [Obrigações, assinaturas e baixa manual](docs/obrigacoes-decifaz.md): competências sem duplicação, valores previstos/pagos/vencidos e comprovantes privados.
- [Reuniões de projeto](docs/reunioes-projetos.md): atas, decisões e acompanhamento; chamada externa e captura local disponíveis; videoconferência nativa planejada, sem contratação automática.

Contratos, obrigações, reuniões e hierarquia foram publicados pelos PRs #30–#33. A recuperação de produtividade #27–#29 preserva essas entregas. As validações usam somente contas e documentos fictícios; confira em cada PR o SHA, os checks e o estado efetivo de publicação.

[Central de Prospecção e planejamento de abordagem](docs/prospeccao.md).

[Ficha dedicada, rascunhos de sessão e proposta em etapas](docs/fichas-e-propostas.md).

Busca por registros autorizados, publicação e rotina inicial dos sócios: [Busca global](docs/busca-global.md).

Busca por registros autorizados, publicação e rotina inicial dos sócios: [Busca global](docs/busca-global.md).
## Avisos em homologação

Central, preferências e processamento sem navegador: [roteiro funcional, configuração e recuperação](docs/avisos-agendados.md). Geração agendada e e-mail de produção permanecem desativados; testes somente com dados fictícios e Mailpit.

Publicação futura com **somente avisos internos e e-mail desligado**: [roteiro único #42 → #43](docs/publicacao-avisos.md).

Perfil econômico de tela por link (#40, rascunho): sessão5min, uma sessão simultânea no Hub/um espectador, captura até1280×720/5FPS e encoder até256kbit/s com leitura dos controles aceitos. Áudio não homologado/desativado. Homologação e limites em [compartilhamento de tela](docs/compartilhamento-tela.md); sem ativação em produção.

Revisão financeira semanal em desenvolvimento: [fluxo, métricas, permissões e publicação](docs/revisao-financeira-semanal.md). Integrada à semana operacional, sem pagamentos automáticos.
