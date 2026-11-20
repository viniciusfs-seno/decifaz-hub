# Mesa de trabalho — revisão Impeccable

Entrega de frontend em `feat/mesa-de-trabalho`, para revisão em prévia isolada. Produção permanece na main; não há migração, Edge, Auth ou nova dependência. O SHA final e os checks ficam no PR, evitando registrar o próprio hash dentro do commit.

## Direção confirmada

Portal e reuniões exclusivamente internos. Mesa de trabalho clara e prática, tom direto, sóbrio e acolhedor; prioridade, vencimento e próxima ação vêm antes de detalhes. Tons oficiais exatos: azul na estrutura/navegação, laranja nas ações principais e superfícies neutras. Orientação curta em tarefas pouco frequentes. Code-first. Contexto em [PRODUCT.md](../../PRODUCT.md), sistema em [DESIGN.md](../../DESIGN.md), exemplos de componentes em `.impeccable/design.json`.

## Método e limitações

As avaliações A (UX) e B (detector/técnica) começaram em agentes independentes. O limite de créditos interrompeu os relatórios dos agentes. O responsável concluiu a avaliação A pelas capturas e pela rubrica antes de abrir B: **DEGRADED: single-context (sub-agent assessments interrupted by usage limit)**. Não declarar o resultado como crítica dupla independente concluída.

Linha de base: main `fb34f0428ce8141f6e75642f3c0d830e45342b60`. A capturou Dashboard, Agenda, CRM/ficha, contrato, ocorrência/baixa, projeto, reunião, apresentação, propostas e Equipe em desktop/celular, com papéis administrativo e comercial. B produziu 36 amostras de seis superfícies, três larguras e dois temas. Dados, contas, PDFs e fornecedores são fictícios locais. Testes em Chromium e viewports emulados não são teste com aparelho físico nem pesquisa com os sócios.

O overlay tentou carregar uma porta diferente da informada pelo helper e falhou em três páginas. Não há overlay confiável no navegador do usuário. Fonte, DOM, estilos computados, interações e capturas constituem as evidências. O helper foi encerrado; credenciais e arquivos de runtime são ignorados pelo Git.

## Revisão inicial

| Heurística | Nota /4 | Questão |
|---|---|---|
| Estado do sistema | 3 | “Seu dia” misturava compromissos futuros. |
| Mundo real | 2 | Reunião interna usava linguagem de cliente. |
| Controle e liberdade | 3 | Escape, fechar e retorno disponíveis. |
| Consistência | 2 | Formulários e ações com estruturas diferentes. |
| Prevenção de erros | 3 | Confirmações, revisões e versões presentes. |
| Reconhecimento | 3 | Abas ajudam; identificação técnica de integrante ainda exige atenção. |
| Eficiência | 2 | Menu extenso e fila abaixo de métricas no celular. |
| Hierarquia | 1 | Ata concorria com apresentação e catálogo. |
| Recuperação | 3 | Feedback e tentativas existentes. |
| Ajuda | 2 | Orientação extensa ou repetida. |
| **Total** | **24/40** | Melhorias significativas necessárias. |

Auditoria técnica: **14/20** (acessibilidade 3, desempenho 3, temas 3, responsividade 3, integridade 2). Sem P0 comprovado. P1: hierarquia/recorte do Dashboard e contexto de reuniões. P2: formulários, orientação, alvos compactos e consistência de estilos.

O detector inicial retornou oito avisos. Três contra Inter são inadequados à identidade oficial e não justificam trocar a fonte. Algumas bordas apontadas eram regras sobrescritas; não contar o mesmo defeito duas vezes. O bundle inicial principal tinha 491.547 bytes, 146.259 em gzip; não foi comprovada regressão de desempenho nem feito teste de campo. A ausência de avisos de contraste em amostra não certifica WCAG.

## Comandos e tratamento

| Comando | Aplicação |
|---|---|
| init | Público interno, contexto duradouro e preferência code-first. |
| document | Tokens, oito seções canônicas e exemplos de sete componentes. |
| critique | Rubrica, evidência visual, prioridades e snapshot local. |
| audit | Fonte/detector, teclado, temas, responsividade e limites da medição. |
| layout / distill | Fila primeiro; indicadores secundários; tarefas da reunião separadas. |
| clarify / onboard | Recortes nomeados, avisos de contrato distintos, linguagem interna e ajuda curta opcional. |
| adapt / typeset | Filtros em grade, labels acima dos campos, controles legíveis e cabeçalho com mais de um espaço. |
| harden | Validação/foco, correção do primeiro valor após erro e bloqueio de ações durante gravação. |
| polish | Conferência de fonte, componentes, estado, capturas e regressões antes da prévia. |

Comandos sem problema correspondente não são aplicados mecanicamente. Não há substituição da identidade, nova biblioteca de UI, efeitos decorativos, transmissão nativa, pagamento automático ou envio de e-mail real.

## Mudanças funcionais da interface

- Dashboard: vencidos, hoje e próximos sete dias usam o mesmo filtro da Agenda; a fila precede KPIs e mantém contagem e acesso ao recorte completo. Avisos de renovação e término/cancelamento têm nomes diferentes. “Próximos sete dias” inclui hoje, como a Agenda.
- Indicadores, funil e receitas continuam disponíveis no disclosure existente; previsto e recebido permanecem separados. Papéis restritos não ganham acesso a valores.
- Reunião: dados, pauta/ata/decisões e próximo acompanhamento estão agrupados. Campos do acompanhamento aparecem quando solicitado. Apresentação selecionada e captura ficam em detalhe opcional. Chamadas externas e captura local mantêm suas coberturas distintas.
- Formulários: rótulos consistentes acima dos campos, ações espaçadas, erro/foco e feedback de gravação. O helper de validação adia a limpeza do feedback para depois do evento do campo; limpar no capture, inclusive em microtask, podia restaurar o valor anterior antes do onChange. A regressão mantém a asserção de valor/foco e confirma a persistência por outra sessão.
- Navegação: grupos recolhíveis preservam destinos e busca de áreas autorizadas. Buscar revela os resultados mesmo quando um grupo estava recolhido. Não há nova regra de autorização no cliente.

## Comparação reproduzível

Mesmo conjunto de contas/registros/documentos fictícios, com fonts.ready, Chromium, largura/tema iguais por par. [Medições](medicoes.json) registram geometria e overflow, não velocidade ou satisfação. O script de comparação é ferramenta local de homologação, sem conexão de produção.

| Tela | Desktop antes / depois | Celular antes / depois |
|---|---|---|
| Dashboard | [antes](capturas/dashboard-antes-desktop.png) · [depois](capturas/dashboard-depois-desktop.png) | [antes](capturas/dashboard-antes-celular.png) · [depois](capturas/dashboard-depois-celular.png) |
| Agenda | [antes](capturas/agenda-antes-desktop.png) · [depois](capturas/agenda-depois-desktop.png) | [antes](capturas/agenda-antes-celular.png) · [depois](capturas/agenda-depois-celular.png) |
| Ficha | [antes](capturas/ficha-antes-desktop.png) · [depois](capturas/ficha-depois-desktop.png) | [antes](capturas/ficha-antes-celular.png) · [depois](capturas/ficha-depois-celular.png) |
| Contrato | [antes](capturas/contrato-antes-desktop.png) · [depois](capturas/contrato-depois-desktop.png) | [antes](capturas/contrato-antes-celular.png) · [depois](capturas/contrato-depois-celular.png) |
| Reunião | [antes](capturas/reuniao-antes-desktop.png) · [depois](capturas/reuniao-depois-desktop.png) | [antes](capturas/reuniao-antes-celular.png) · [depois](capturas/reuniao-depois-celular.png) |
| Obrigações | [antes](capturas/obrigacoes-antes-desktop.png) · [depois](capturas/obrigacoes-depois-desktop.png) | [antes](capturas/obrigacoes-antes-celular.png) · [depois](capturas/obrigacoes-depois-celular.png) |
| Indicadores | [antes](capturas/indicadores-antes-desktop.png) · [depois](capturas/indicadores-depois-desktop.png) | [antes](capturas/indicadores-antes-celular.png) · [depois](capturas/indicadores-depois-celular.png) |
| Equipe | [antes](capturas/equipe-antes-desktop.png) · [depois](capturas/equipe-depois-desktop.png) | [antes](capturas/equipe-antes-celular.png) · [depois](capturas/equipe-depois-celular.png) |

A primeira ação do Dashboard no celular estava entre 848 e 931px e passou para 663–803px, dentro de 844px de altura. Isso prova visibilidade na primeira dobra dessa fixture, não tempo de tarefa. Consultar o JSON para valores fracionários e medição de desktop.

## Validação e recuperação

Executar `npm run check`, `npm test`, builds demo/compartilhado, `node scripts/mock-validation.mjs` e `node scripts/local-validation.mjs`. `workbench-real` verifica contagem/card/lista, primeira dobra, menu recolhido/busca, espaço adicional, perfil restrito e gravação de ata/follow-up pela interface. A suíte existente mantém CSV, snapshots, aceite administrativo, documentos privados, auditoria, concorrência e desativação.

Validar também o endereço HTTPS protegido de outra máquina, com perfis fictícios e Supabase local. O túnel depende do processo hospedeiro e tem validade explícita; a senha fica fora do Git, dos artefatos e dos logs. Não usar credenciais reais no formulário de homologação.

Esta entrega não aplica migração. Para futura publicação, revisar o candidato exato e os checks, aprovar a prévia e só então integrar. Recuperação de frontend: main anterior `fb34f0428ce8141f6e75642f3c0d830e45342b60`, mantendo banco, Edge, documentos, revisões, papéis e auditorias. Nenhuma recuperação deve reabrir leitura de campos protegidos. A produção fica fora desta rodada.

## Resultado local do candidato

- Tipagem, 26 unitários, builds demo/compartilhado e 5 cenários com API simulada aprovados.
- Oito regressões SQL e 43 cenários com Supabase local aprovados. A execução com oito workers revelou dois carregamentos iniciais que excederam a espera e dois seletores/feedbacks afetados pela nova hierarquia. Os testes de indicador agora abrem o disclosure; a validação guiada é opt-in para não duplicar o feedback próprio da proposta. A suíte completa passou com dois workers, preservando as asserções e os limites de abertura.
- [Auditoria visual](auditoria-visual.json): 26 amostras, sem overflow, controles sem rótulo ou falha de contraste detectada. Inclui texto a 200%, com a correção da coluna mínima da grade e quebra do texto longo de aviso em 320px. Amostragem não equivale a WCAG completa ou teste físico.
- [Revisão de UX](revisao-ux.md): 24 → 29/40; [auditoria técnica](auditoria-tecnica.md): 14 → 15/20. São avaliações heurísticas do próprio contexto, não métricas de satisfação ou uma crítica independente concluída.
- Scanner final: três avisos de Inter oficial e 106 avisos de inventário de tokens (21 radius, 76 font-size e 9 color). O novo DESIGN.md passou a revelar divergências legadas antes não verificadas. Não houve supressão global nem classificação de todos esses avisos como falhas renderizadas. Consolidação gradual permanece no backlog.

Os checks remotos e a homologação HTTPS são vinculados ao SHA final na descrição do PR. Não confundir resultado local com CI concluído.

## Limites restantes

Identificação de integrantes sem nome continua dependente dos dados autorizados retornados pelo servidor; não inventar nomes ou expor contas para decorar o seletor. Não há certificação WCAG, estudo com usuários, teste físico de celular ou prova de chamada nativa entre participantes. Alertas externos, assinatura eletrônica e novos provedores são entregas futuras. A avaliação final e os resultados efetivos ficam no PR junto ao SHA validado; não herdar checks da base.
