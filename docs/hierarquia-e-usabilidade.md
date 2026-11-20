# Hierarquia e usabilidade do portal

Publicação confirmada no [PR #33](https://github.com/viniciusfs-seno/decifaz-hub/pull/33), merge `7d1a4750cda3058f4d3d7aaf2f623472f8691ef0`. As bases e sequências abaixo registram o contexto original da entrega; não são instruções para reaplicar migrações em produção. Consulte a [rotina atual, fases e recuperação](rotina-socios.md).

Base: main `da3fd8abe8da56db6fdc2482eabb015a3b45ba0f`, após a publicação da gestão de reuniões do #32. Revisão motivada pela sobrecarga da interface: esta rodada trata arquitetura da informação, sequência das tarefas, densidade e componentes, preservando contratos de API, RLS, papéis e auditoria. Não há migração ou publicação de Edge.

## Revisão dirigida

| Área | Problema observado | Tratamento nesta rodada / continuação |
|---|---|---|
| Navegação e cabeçalho | Lista extensa de áreas, difícil localizar um destino | Busca de áreas autorizadas, rótulos preservados, foco/Escape e organização visual consistente. Busca global de registros fica para entrega de servidor própria. |
| Dashboard | Avisos de contratos e obrigações abaixo de métricas secundárias | Fila com prazos ordenados, avisos ao lado, contadores compactos e funil/receitas em disclosure secundário. Lista curta informa acesso à consulta completa. |
| CRM e ficha | Longa jornada mistura cadastro, diagnóstico e execução | Mantidos cadastro em seções, retorno/filtros e atalhos existentes; padronização de formulários e ações. Próxima etapa: ficha de página inteira com linha de próxima ação e busca global por estabelecimento. |
| Triagem | Risco de confundir rascunho com classificação final | Preservados score parcial, critérios de conclusão e confirmação. Nenhuma classificação inferida de campos ausentes. |
| Agenda | Novos compromissos eram concatenados sem ordenação global | Ordenação por data e chave estável também para contratos/obrigações, mantendo filtros e acesso à origem; reunião de projeto abre diretamente a aba Reuniões. |
| Reuniões | Roteiro completo competia com preparação | Accordion do roteiro; modo de condução o abre, respostas permanecem no registro. Apresentação selecionada e captura local continuam separadas da chamada externa. |
| Apresentação | Risco de confundir notas internas e material de cliente | Conteúdo escolhido preservado, sem atas/notas automáticas; transmissão entre participantes continua não homologada. |
| Catálogo e conhecimento | Repetição de padrões de cards, filtros e tipografia | Estilos compartilhados, filtros e estados preservados. Indexação e materiais anexados são evolução funcional própria. |
| Propostas | Histórico e escopo extenso exigem hierarquia | Versão ativa, aceite e regras de preços preservados; escopo aprovado do projeto recolhido como detalhe. Editor de proposta em etapas é continuação sugerida. |
| Projetos e suporte | Cinco tarefas diferentes empilhadas no mesmo diálogo | Abas Resumo, Entrega e aceite, Reuniões, Atividades e suporte, Histórico; resumo persistente de situação/responsável/prazo. Abas mantêm os painéis montados para não apagar rascunhos. |
| Contratos | Todos os campos, documentos e JSON de histórico simultâneos | Resumo, identificação, vigência/avisos, origem/projetos e valores em accordions; documentos/histórico secundários. Campos financeiros continuam ausentes para papéis sem acesso. |
| Financeiro de clientes | Distinção entre receita prevista e recebida | Separação e CSV mantidos, com estilo comum. Consolidação de lançamentos em tarefa única é evolução posterior. |
| Obrigações da Decifaz | Plano de cobrança e ocorrências competiam na tela | Ocorrências primeiro; planos/assinaturas secundários, busca por fornecedor/categoria/responsável e mesmo recorte no CSV. Linhas viram pares rótulo/valor no celular. |
| Indicadores | Grande grade sem distinção de assuntos | Reorganização visual por área, com fórmula e recorte junto do número; CSV e denominadores preservados. Não se cria histórico sem fonte. |
| Fechamento semanal | Resumo, decisões e plano precisam contexto | Preservadas etapas e histórico, com padrões comuns de controles. Próxima etapa: tornar pendências não concluídas mais evidentes no fechamento. |
| Equipe e convites | Gestão eventual compete com membros existentes | Estados, confirmações e proteção do último administrador preservados. Redução de ruído e procura por integrante orientam a evolução da administração. |
| Rastreabilidade | JSON como explicação principal da alteração | Diferenças com rótulos em português, datas/valores formatados e antes/depois; registro completo continua disponível em detalhe secundário. |

As observações são de revisão técnica e navegação com dados fictícios; não constituem pesquisa com usuários nem auditoria WCAG completa. Não se anuncia equivalência nova com o GPT Sites.

## Padrões de componentes

`Disclosure` usa `details/summary` nativos, oferece título/ajuda/contagem e abre a seção quando um campo inválido precisa de atenção. Informações essenciais e ações críticas não são recolhidas indiscriminadamente. `RecordTabs` usa tablist/tab/tabpanel, setas, Home/End, foco visível e preservação de rascunho. `RecordSummary` mantém situação, responsável e prazo no contexto da ficha. Tabelas com `record-table` mostram rótulos por célula no celular, preservando valores e cabeçalhos acessíveis.

Uma aba não altera autorização: consulta e gravação continuam sujeitas ao servidor; ocultar painel não protege dados financeiros. O frontend continua usando views/RPCs e consultas autorizadas. Permissões, aceite administrativo, confirmação de Ganho, revisões concorrentes e histórico são preservados.

## Validação e publicação

Executar `npm run check`, `npm test`, builds local/compartilhado, `node scripts/mock-validation.mjs` e `node scripts/local-validation.mjs`. A regressão `hierarchy-real` cobre busca, navegação por teclado, rascunho entre abas, campo inválido recolhido, baixa manual, celular escuro e conta restrita. As jornadas existentes passam a abrir a aba/accordion correspondente, mantendo suas asserções de persistência, isolamento, concorrência e auditoria.

Prévia protegida: somente Supabase local, Mailpit e contas/documentos fictícios. O gateway deve identificar o SHA do PR antes da execução externa. Senha/tokens não entram no Git, artefatos ou logs. Capturas antes/depois usam a mesma fixture, tema e largura; emulação não é aparelho físico.

Publicação de frontend: conferir base/head/diff e checks → conferir prévia → integrar → aguardar READY na Vercel → verificar SHA no domínio e smoke. Recuperação: frontend #32, commit `da3fd8a`, deployment `dpl_CL57GGp4hU3q9LbX9jToLJyEttee`, mantendo banco/Edge e todas as restrições. **Não executar migração nesta entrega.** O corpo do PR registra SHA efetivamente validado, resultados e links finais.

## Evidência desta rodada

- Tipagem, 24 testes unitários, builds local/compartilhado, 5 testes com API simulada e 28 testes de navegador com Supabase local aprovados em 19/11/2026. O comando local também executou as oito regressões SQL anteriores. Somente contas e documentos fictícios.
- Busca de integrantes e filtro Ativos/Desativados preservam seleções não salvas; convites ficam em seção secundária. A nova regressão cobre essa preservação.
- `node scripts/hierarquia-comparacao.mjs` gera [24 capturas](hierarquia/capturas) com a mesma fixture antes/depois, em 1440×1000 e 390×844, incluindo tema escuro no candidato. Sem rolagem horizontal na página; a barra de abas tem rolagem própria no celular.
- [Medições reproduzíveis](hierarquia/medicoes.json): controles visíveis no primeiro contexto do projeto diminuíram de 24 para 12 em ambas as larguras. Isso mede densidade inicial, não velocidade ou satisfação de uso.

| Tela | Antes | Depois |
|---|---|---|
| Dashboard desktop | [captura](hierarquia/capturas/dashboard-antes-desktop.png) | [captura](hierarquia/capturas/dashboard-depois-desktop.png) |
| Projeto celular | [captura](hierarquia/capturas/projeto-antes-celular.png) | [captura](hierarquia/capturas/projeto-depois-celular.png) |
| Contrato desktop | [captura](hierarquia/capturas/contrato-antes-desktop.png) | [captura](hierarquia/capturas/contrato-depois-desktop.png) |
| Obrigações celular | [captura](hierarquia/capturas/obrigacoes-antes-celular.png) | [captura](hierarquia/capturas/obrigacoes-depois-celular.png) |
| Indicadores desktop | [captura](hierarquia/capturas/indicadores-antes-desktop.png) | [captura](hierarquia/capturas/indicadores-depois-desktop.png) |

Roteiro de cinco minutos: localizar Projetos na busca lateral; abrir uma ficha e alternar as cinco abas; editar um rascunho sem salvar e verificar sua preservação; abrir contrato e seus documentos; consultar obrigações no celular e distinguir previsto/pago; alternar tema. A prévia usa banco local isolado e pode expirar com o túnel ou processo hospedeiro.

## Próximas entregas

1. Produtividade: #27 → #28 → #29 recuperados e publicados, com bases/diffs revalidados, migrações antes do frontend e preservação da hierarquia. Registros atuais na rotina dos sócios.
2. Trabalho por contexto: ficha dedicada e proposta em etapas no #34; busca global autorizada em entrega própria. Estado efetivo e recuperação na rotina dos sócios.
3. Reuniões: escolher ambiente/provedor de homologação e provar imagem entre dois participantes antes de anunciar transmissão. Captura local e chamada externa continuam identificadas separadamente.
4. Qualidade contínua: revisar formulários com usuários, navegação assistiva e acessibilidade completa; esta rodada não equivale a certificação WCAG.
