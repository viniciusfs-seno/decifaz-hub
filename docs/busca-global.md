# Busca global autorizada

No cabeçalho, **Buscar** ou **Ctrl+K** abre a consulta por nome ou cidade de estabelecimentos, projetos e contratos do espaço atual. São necessários dois caracteres. A consulta ignora acentos e não interpreta `%` ou `_` como curingas. Retorna até 20 resultados em ordem estável de título, tipo e identificador; refine o termo para encontrar outros registros. Não representa uma contagem do recorte inteiro.

A RPC `hub_search_records` verifica a associação ativa e as permissões antes de consultar. Cada origem filtra o espaço e o módulo; projetos usam a view autorizada existente. O retorno contém somente tipo, identificador, título, resumo de cidade/situação e estabelecimento de origem. Não inclui notas internas, escopo, preços, condições, documentos nem totais de registros inacessíveis. Uma conta desativada perde acesso no servidor mesmo com JWT aberto. Resultados não são persistidos no navegador.

Ao abrir o resultado, uma consulta atualizada confere novamente o registro e o espaço. Requisições antigas são descartadas após nova busca, troca de espaço ou navegação. Falhas mantêm a busca aberta com tentativa de recuperação. A ficha, o projeto e o contrato conservam suas próprias permissões de leitura e escrita.

## Publicação e recuperação

Dependência: atividades/acompanhamentos e ficha dedicada publicados e validados. Aplicar **somente** `20261120000000_busca_global.sql` após dry-run e checks do candidato final. Conferir assinatura, grants (authenticated; anon/public negados), isolamento e retorno sem campos financeiros. A expansão adiciona apenas uma RPC; o frontend anterior continua funcionando. Depois, integrar o frontend e verificar SHA/deployment no domínio principal.

Recuperar o frontend anterior mantendo a RPC e todas as políticas, views, revisões e auditorias existentes. Não é necessário apagar dados nem revogar funções usadas pelas versões anteriores. Não alterar Auth ou Edge. Testes usam contas fictícias; não executar gravações de homologação em vínculos reais.

## Rotina inicial dos sócios e limites

- **Contratos**: cadastrar contrato existente ou vincular proposta/versionamento, responsável, vigência e renovação; confirmar a mudança; anexar PDF assinado privado. Documento é um anexo informado, sem assinatura eletrônica. Valores e documentos exigem acesso financeiro.
- **Obrigações**: cadastrar domínio anual, hospedagem, e-mail e ferramentas; informar vencimento base, periodicidade, responsável e renovação/cancelamento conhecidos. Conferir ocorrências e confirmar a baixa manual somente após pagar fora do Hub. Previsto, pago e vencido permanecem separados. Alterações futuras elegíveis preservam ocorrências vencidas e pagas.
- **Reuniões**: abrir pelo projeto, vincular contrato quando aplicável, preparar pauta, registrar ata e decisões e criar acompanhamento com prazo. Informar um link HTTPS de chamada externa. Captura local não transmite a tela para convidados; videoconferência nativa permanece planejada, sem serviço contratado.

Dashboard e Agenda apresentam vencimentos e permitem abrir a origem. Ocorrências são geradas ao consultar o financeiro, até o horizonte documentado de 366 dias. Avisos são internos, ao abrir o portal; não há disparo externo ou execução agendada com o portal fechado. Consulte `obrigacoes-decifaz.md` para as regras de fim de mês, pausa, cancelamento e baixa.

A rastreabilidade de contratos, projetos, reuniões, obrigações, ocorrências, pagamentos e anexos é registrada no servidor com ator e data desde a publicação das respectivas migrações, identificadas pela série 20261118. Não há reconstrução anterior, auditoria de leitura/download ou de ações feitas no fornecedor externo. CRM, atividades e papéis mantêm auditorias próprias. Eventos financeiros continuam restritos. Recuperação preserva os registros e permissões.

## Validação

O ensaio de expansão obtém o frontend anterior pelo primeiro pai do commit que adicionou a migração de busca. Assim, a referência permanece anterior à RPC tanto no PR quanto na main após squash. Não usar `merge-base HEAD origin/main` para essa fase: na main ele é o próprio candidato e tentaria consultar a RPC antes da aplicação. Histórico Git completo é obrigatório; a ausência da introdução interrompe o ensaio.

`npm run check`, `npm test`, builds demo/compartilhado, regressões SQL e Playwright local/externo. Cenários de busca em `e2e/global-search-real.spec.mjs`: projeção, limite, empate estável, acentos, termo literal, falha recuperável, teclado, origem correta, isolamento e JWT desativado. SHA, resultados efetivos e links finais ficam no PR; nenhuma publicação deve se basear em checks de uma base anterior.

## Cobertura da rotina dos sócios

| Rotina com dados fictícios | Evidência automatizada |
| --- | --- |
| CSV, possível duplicidade, retomada, triagem, abordagem, atividade e próximo acompanhamento | import-real, productivity-real, prospecting-real, activity-work-real |
| Duas sessões editam ficha e concluem atividade sem impasse | activity-clock-real, lead-details-real |
| Catálogo, reunião, diagnóstico, proposta versionada, aceite administrativo, Ganho, projeto e pós-venda | commercial-management-real, shared-real |
| Contrato existente ou derivado, PDF privado, revisão concorrente, ator e negação a admin de outro espaço | contracts-real, homologacao/registry |
| Domínio anual, assinatura mensal, competências, fim de mês, pagamento e auditoria | internal-finance-real, homologacao/registry |
| Reunião do projeto/contrato, ata, decisões e acompanhamento atômico | project-meetings-real, homologacao/registry |
| Lista desatualizada, rascunho, URL, retorno e foco, proposta em etapas | record-work-real |
| Busca, recusa, projeção sem preços, respostas antigas, cancelamento e troca de espaço | global-search-real, homologacao/search |
| JSONs financeiros, sessão desativada, outro espaço e perda de acesso | roles-real, member-state-real, homologacao/preview |

São cenários complementares de navegador e API no ambiente isolado; não são ensaios sobre contas reais. Captura local e integração com chamada externa têm essa cobertura específica, sem alegação de transmissão nativa entre participantes. Os checks do candidato final e os artefatos de captura estão no PR.
