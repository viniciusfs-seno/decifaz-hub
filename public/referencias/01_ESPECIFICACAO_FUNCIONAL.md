# Decifaz Hub — Especificação funcional v0.1

## 1. Propósito e princípios

Portal privado para centralizar o ciclo comercial e operacional da Decifaz: pesquisa de estabelecimentos → triagem → abordagem → reunião → proposta → contrato → projeto → faturamento → pós-venda. O mesmo registro acompanha o lead ao longo de cada etapa.

**Princípios:** simplicidade no dia a dia; visão clara da próxima ação; dado único com histórico; telas orientadas a processos; conteúdo editável; acessibilidade; responsividade; privacidade; e migração futura do código-fonte.

## 2. Módulos do MVP (primeira entrega)

### 2.1 Visão geral / dashboard

- KPIs calculados a partir dos dados: leads cadastrados, qualificados, em reunião, propostas enviadas, negociações ganhas/perdidas, taxa de conversão, tarefas vencidas e próximas atividades.
- Funil por estágio, prioridades de leads, atividade por responsável, agenda de próximas reuniões.
- Filtros por período, responsável, segmento, região e origem.
- Valores financeiros de exemplo apenas se marcados claramente como fictícios.

### 2.2 CRM e captação

- Lista com pesquisa, filtros, ordenação, status, responsável, próxima ação e prazo.
- Criação, edição, detalhes de lead e registro cronológico das interações.
- Segmento, localização aproximada, origem, canais de contato, links para redes e presença digital.
- Motivo e data de perda ou arquivamento; indicador de dados não confirmados.
- Visualização em tabela e kanban.
- Deduplicação sugerida por nome + cidade + canais, com confirmação humana.

**Estágios sugeridos:** identificado → pesquisando → qualificado → contato planejado → abordado → reunião marcada → diagnóstico realizado → proposta enviada → negociação → ganho / perdido / arquivado. Apenas ganho pode abrir onboarding/projeto após confirmação.

### 2.3 Triagem guiada

Fases do formulário:
1. Identificação do estabelecimento e área de atuação.
2. Presença digital (perfil de negócio, site, Instagram, WhatsApp, cardápio/catálogo).
3. Hipóteses de problema e evidências/links; distinguir observação, relato e hipótese.
4. Oportunidades de solução (cardápio, pedidos, telas/TV, NFC/QR, agendamento, presença digital, automação, sistema sob medida).
5. Pontuação objetiva.
6. Parecer, responsável, abordagem escolhida, próximo passo e prazo.

**Score (0–15):** encaixe com oferta (0–3), necessidade evidenciada (0–3), acesso a decisor (0–2), urgência (0–2), potencial de receita (0–2), reutilização (0–2), logística (0–1).
**Prioridade:** A = 11–15; B = 7–10; C = 0–6. Com critérios ainda não avaliados, usar `triagem incompleta` e nunca atribuir zero automaticamente a desconhecido.

### 2.4 Reuniões e script

- Página de preparação com nome da empresa, histórico, contexto e hipótese de problema.
- Roteiro dividido em abertura/rapport, operação atual, dores, impacto, orçamento/decisão, demonstração orientada, dúvidas, próximos passos.
- Campos para registrar: data, participantes, problemas relatados, sistemas atuais, objeções, soluções cogitadas, expectativas, faixa orçamentária (se declarada), consentimentos necessários e próximos passos.
- Checklist de saída: quem decide, qual proposta enviar, para quem, até quando e responsável pelo follow-up.
- Modo apresentação com perguntas-chave durante reunião (sem linguagem robótica).

### 2.5 Base de conhecimento

- Transformar manual em artigos navegáveis: processo de prospecção, triagem, reunião, proposta, entrega, suporte, financeiro, uso do CRM.
- Busca textual, filtros por departamento, versão, data de revisão, status (rascunho/publicado) e responsável pelo conteúdo.
- Uma página central de modelos: triagem, reunião, proposta, checklist de escopo, termo de aceite, handoff comercial→dev, encerramento e pós-venda.
- Conteúdo é adaptado para uso no portal; manter acesso aos arquivos originais.

### 2.6 Agenda e atividades

- Atividade vinculada a lead/proposta/projeto.
- Tipo: pesquisa, contato, visita, reunião, follow-up, proposta, entrega, cobrança.
- Responsável, prazo, prioridade, status e resultado.
- Visões de atividades para hoje, vencidas e próximas 7 dias.

## 3. Módulos pós-MVP

### 3.1 Propostas e contratos

Proposta vinculada a lead/diagnóstico, com versão, serviços, escopo, premissas, exclusões, preço, implantação, recorrência, pagamento, validade e status. Contrato somente como registro/arquivo na fase inicial; assinatura eletrônica e geração automática depois.

### 3.2 Projetos e execução

Projeto vinculado a proposta aceita, com responsável, etapas, tarefas, marcos, entregáveis, anexos, riscos, mudanças de escopo, checklist de QA, homologação, entrega e suporte.

### 3.3 Financeiro

- Previsão vs realizado (com separação rigorosa).
- Receitas, despesas, contas a receber, parcelas, recorrências, vencimentos e inadimplência.
- Vínculo opcional com cliente/proposta/projeto; status orçado, previsto, faturado, recebido, atrasado.
- Dashboards mensais, MRR, receita por serviço, margem estimada quando custos estiverem cadastrados.
- Nada de conexão bancária ou processamento de pagamentos na primeira etapa.

### 3.4 Catálogo de soluções e precificação

Categorias discutidas: presença digital, automações, sistemas e soluções sob medida. Modelar serviços com checklist de escopo, itens opcionais, custos e política de descontos (quando aprovada internamente).

## 4. Dados principais (entidades)

- `users`: id, nome de exibição, e-mail, papel, ativo.
- `leads`: id, nome, cidade/região, segmento, estágio, origem, responsável, descrição, canais, status de verificação, datas de criação/atualização.
- `triages`: id, lead_id, respostas, evidências, notas, prioridade calculada, data, autor, versão.
- `activities`: id, lead_id?, proposal_id?, project_id?, tipo, responsável, prazo, status, resultado, data de conclusão.
- `meetings`: id, lead_id, data, participantes, roteiro/respostas, dores, objeções, resumo, próximos passos.
- `proposals`: id, lead_id, versão, escopo, preço único, recorrência, status, validade, responsável.
- `projects`: id, lead_id, proposal_id, etapas, prazo, escopo aprovado, responsável, status.
- `financial_entries`: id, project_id?, lead_id?, tipo, categoria, valor, vencimento, pagamento, situação, observações.
- `knowledge_articles`: id, título, slug, categoria, conteúdo, etiquetas, versão, estado, revisor, última revisão.
- `attachments`: id, entidade de origem, nome, tipo, armazenamento, autor, data.
- `audit_events`: id, ator, ação, objeto, horário, alterações relevantes.

## 5. Permissões (fase produção)

- Administrador: configurações, usuários, escopos e gestão integral.
- Comercial: leads, triagens, reuniões e propostas segundo as permissões definidas.
- Operação: projetos, entregas e base de conhecimento; acesso apenas ao contexto comercial necessário.
- Financeiro: lançamentos, contratos e valores.
- Leitura: apenas conteúdo explicitamente permitido.

O controle precisa ser validado no servidor e no banco (não apenas esconder botões). Restringir documentos internos por perfil; registrar alterações críticas.

## 6. Regras de negócio

1. Todo lead ativo tem responsável, estágio e próxima ação (com prazo ou motivo documentado para ausência).
2. Mudanças de etapa registram autor, data e contexto.
3. Uma observação não equivale a fato confirmado pelo cliente; guardar fonte e grau de certeza.
4. A triagem pode ficar incompleta, sem pontuar automaticamente critérios desconhecidos.
5. Propostas são versionadas; preço e escopo só passam a valer após aprovação explícita.
6. Receitas previstas não entram como realizadas no dashboard.
7. Não criar projeto automaticamente a partir de uma manifestação informal de interesse.
8. Não armazenar dados de pacientes, credenciais de clientes ou documentos pessoais sensíveis.
9. Dados importados podem conter duplicatas; oferecer prévia e reconciliação, sem sobrescrever silenciosamente.
10. Conteúdo de referência deve ter responsável e data de revisão.

## 7. Critérios de aceite do primeiro protótipo

- Navegar pelo portal em desktop e celular, sem links mortos.
- Criar/editar um lead de demonstração e localizá-lo por filtro.
- Preencher uma triagem, recalcular classificação e distinguir incompleta de concluída.
- Agendar próxima ação, visualizar vencimentos e marcar execução.
- Criar e registrar uma reunião de demonstração usando o script.
- Exibir dashboard consistente com os registros de exemplo, sem KPI inventado.
- Consultar os manuais em páginas internas e localizar um artigo por busca.
- Exportar dados principais em CSV ou JSON para evitar aprisionamento tecnológico (caso suportado na versão).
- Interface identifica claramente dados fictícios e nunca apresenta login meramente visual como proteção real.

## 8. Estilo e UX

- Visual profissional, contemporâneo e coerente com a identidade visual da Decifaz quando a marca for anexada; não inventar logo oficial.
- Sidebar com agrupamentos: Visão geral; Comercial; Operação; Gestão; Conhecimento; Configurações.
- Componentes reutilizáveis, formulários curtos com etapas, cards objetivos, filtros, calendário e tabelas adequadas a telas pequenas.
- Ações frequentes visíveis: `Novo lead`, `Nova triagem`, `Registrar reunião`, `Criar atividade`.
- Estados vazios úteis, validação de erros, carregamento e feedback de salvamento.

## 9. Questões a validar com os sócios

- Responsáveis e alçadas de aprovação para preços, propostas e contratos.
- Política de descontos, permutas e autorização de uso de imagens de clientes.
- Templates de propostas e contratos aprovados.
- Regras de distribuição de leads e atendimento pós-venda.
- Catálogo efetivamente disponível versus ideias ainda em pesquisa.
- Onde ficará hospedado o ambiente definitivo e qual política de backups.
