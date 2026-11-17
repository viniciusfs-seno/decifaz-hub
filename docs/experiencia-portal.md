# Experiência do portal compartilhado

Base desta revisão: `4558ba48b65a46fe40d96e74091c2fc3b377a046`, merge do #22. A publicação integrada dos #19–#22 está registrada em `docs/publicacao-integrada.md` e no histórico de `docs/homologacao-integrada.md`. Esta entrega é de frontend e homologação isolada; não altera banco, Edge, produção nem vínculos reais.

## Referências e paridade funcional

A conexão Sites consultada não retornou projetos acessíveis. A equivalência com o GPT Sites original **não é verificável** nesta rodada. A matriz abaixo compara as funções observáveis da demo (`src/main.tsx` e componentes reutilizados) com o compartilhado atual. “Equivalente” trata do fluxo, não de identidade visual pixel a pixel. Nenhum fluxo principal está ausente; as diferenças funcionais remanescentes estão explicitadas.

| Fluxo | Situação frente à demo | Fonte e evidência | Entrega / limite |
|---|---|---|---|
| Dashboard | Equivalente | `operational-dashboard`, `operational-real`, capturas comparativas | Fila antes de métricas; vencidas/hoje e atalhos do mesmo conjunto filtrado; financeiro separado por papel |
| CRM | Parcial | `commercial`, `pilot-app`, `experience-real` | Busca, tabela/Kanban e retorno conservam filtros; cadastro compartilhado ainda não possui todos os campos de contato/origem/verificação do editor da demo |
| Triagem | Equivalente | `TriageEditor`, `shared-real`, `commercial-management-real` | Rascunho parcial claramente distinto da prioridade final; sete critérios, soluções e encaminhamento persistidos |
| Agenda | Equivalente | `shared-operational`, `operational-real`, `experience-real` | Recorte ativo, contagem, responsável, prazo e ação; retorno preserva filtros; atalho explícito substitui o recorte anterior |
| Reuniões | Equivalente | `MeetingEditor`, `meeting-studio-real` | Pauta, roteiro, respostas, diagnóstico e acompanhamento existentes; agenda unificada abre a origem |
| Apresentação | Parcial | `client-presentation`, `meeting-studio-real`, homologação externa | Seleção de conteúdo e janela limpa; captura local preservada. Não há transmissão nativa entre participantes; usar a videochamada externa vinculada |
| Catálogo | Equivalente | `shared-catalog`, `catalog-real` | Busca/categoria/arquivo com recorte preservado; edição admin e snapshots de propostas existentes |
| Propostas | Equivalente | `proposals`, `commercial-management-real`, `concurrency-real` | Versão atual destacada, filtros conservados; versões/aceite/preços e Ganho explícito mantidos |
| Projetos | Equivalente | `pilot-projects`, `shared-real` | Busca, responsável, vencidos, prazos destacados e abertura de suporte/entrega; filtro de vencidos exclui Entregue |
| Suporte | Equivalente | `project-support`, `shared-real`, `operational-real` | Chamados vinculados ao projeto, prazo/responsável/situação e Agenda; não há central de tickets externa |
| Financeiro | Equivalente | `pilot-finance`, `shared-finance`, SQL financeiro | Previsto, realizado e atrasado separados, recorte mensal/CSV existente; formulários responsivos e filtro de atraso conservado |
| Indicadores | Parcial | `management-data`, `management-real`, unitários | Cálculo e data de cada métrica junto ao número, filtros/CSV idênticos; evolução histórica de etapas e SLA não podem ser reconstruídos dos registros atuais |
| Fechamento semanal | Equivalente | `weekly-closure`, `management-real`, SQL fechamentos | Resumo/decisões/ações/histórico e revisão concorrente preservados; não se alterou o contrato |
| Conhecimento | Equivalente | `secondary`, `central-knowledge` | Busca/categoria/material conservados na navegação. Corrigido atalho de Scripts que abria Central em vez de Reuniões (commit próprio) |
| Administração | Equivalente | `team`, `team-real`, `member-state-real` | Estado e efeito da desativação, ajuda por papel cumulativo; confirmação, conflito, último admin, convites e auditoria preservados |

O teste integrado já percorre cadastro → triagem → reunião → proposta versionada → aceite administrativo/Ganho → projeto/suporte → indicadores/fechamento. Não foi identificado um bloqueio nessa jornada que exigisse migração. A correção do atalho de Conhecimento está separada no commit `bcc115d`.

## Estrutura e continuidade

Mantidas as seis áreas: Visão Geral, Comercial, Operação, Gestão, Conhecimento e Administração. O cabeçalho reúne navegação, contexto, seletor de espaço, tema e saída. “Novo lead” permanece no Dashboard/CRM. O menu móvel informa expansão, aceita Escape, recebe foco ao abrir e torna o conteúdo de fundo inerte; o menu fechado fica fora da navegação por teclado. Há atalho “Ir para o conteúdo” e foco visível. Diálogos continuam nativos, com Escape e retorno de foco.

`ViewStateProvider` guarda somente preferências de tela em memória durante a sessão no espaço atual. CRM/triagem, Agenda/reuniões, Indicadores, catálogo, propostas, projetos, conhecimento e atraso financeiro preservam recortes ao navegar. Trocar de espaço recria o cache e abre Dashboard; sair encerra a sessão e elimina o cache. Não são armazenados registros, valores, tokens ou permissões nesse estado. Recarregar a página reinicia os filtros. Abrir uma ficha não deixa a tabela inteira acima dela; o botão de retorno informa Agenda, Indicadores ou lista. Detalhes de projetos abertos por indicadores/agenda também voltam à origem.

## Evidência visual e medidas

`node scripts/experiencia-comparacao.mjs` extrai a base por `git archive`, inicia duas versões somente em loopback e usa **a mesma fixture** Supabase local nas duas. Desktop 1440×1000 e celular 390×844, Fortaleza. São 16 capturas antes/depois e duas adicionais de Dashboard escuro. As capturas não contêm contas reais.

| Tela | Desktop antes / depois | Celular antes / depois |
|---|---|---|
| Dashboard | [Antes](experiencia/capturas/dashboard-antes-desktop.png) · [Depois](experiencia/capturas/dashboard-depois-desktop.png) | [Antes](experiencia/capturas/dashboard-antes-celular.png) · [Depois](experiencia/capturas/dashboard-depois-celular.png) |
| Agenda | [Antes](experiencia/capturas/agenda-antes-desktop.png) · [Depois](experiencia/capturas/agenda-depois-desktop.png) | [Antes](experiencia/capturas/agenda-antes-celular.png) · [Depois](experiencia/capturas/agenda-depois-celular.png) |
| Ficha | [Antes](experiencia/capturas/ficha-antes-desktop.png) · [Depois](experiencia/capturas/ficha-depois-desktop.png) | [Antes](experiencia/capturas/ficha-antes-celular.png) · [Depois](experiencia/capturas/ficha-depois-celular.png) |
| Indicadores | [Antes](experiencia/capturas/indicadores-antes-desktop.png) · [Depois](experiencia/capturas/indicadores-depois-desktop.png) | [Antes](experiencia/capturas/indicadores-antes-celular.png) · [Depois](experiencia/capturas/indicadores-depois-celular.png) |

[Dashboard escuro desktop](experiencia/capturas/dashboard-escuro-desktop.png) · [celular](experiencia/capturas/dashboard-escuro-celular.png). [Medições reproduzíveis](experiencia/medicoes.json):

| Tarefa / medida | Antes | Depois |
|---|---|---|
| Voltar da ficha ao mesmo recorte da Agenda (Vencidas + busca), desktop | 3 ações: Agenda, Vencidas, busca | 1: Voltar à agenda |
| Mesmo retorno, celular | 4 ações: menu, Agenda, Vencidas, busca | 1: Voltar à agenda |
| Início da fila no Dashboard, desktop | y=986 px CSS | y=504 px CSS |
| Início da fila no Dashboard, celular | y=1218 px CSS | y=560 px CSS |

Conta-se clique ou entrada de texto; rolagem não entra na contagem. Novo lead e exportar CSV continuam com um acionamento a partir da respectiva tela; não se anuncia redução onde ela não foi medida. Medidas são da fixture e larguras indicadas, não um estudo com usuários.

## Validação e prévia

Comandos: `npm run check`, `npm test`, `npm run build`, `node scripts/mock-validation.mjs`, `node scripts/local-validation.mjs`, Playwright `backup.spec.mjs` com modo local, comparação visual e workflow externo `homologacao.config.mjs`.

O cenário `experience-real` cobre Administração e Comercial em 1440 e 390 px, claro/escuro, retorno com filtros, substituição por atalhos, estado vazio, Escape, foco e ausência de overflow do documento. As tabelas mantêm rolagem horizontal **dentro do componente**, sem ocultar colunas essenciais. Testes existentes cobrem formulários, apresentação sem notas/preços não selecionados, CSV restrito, duas sessões, isolamento, sessão desativada, concorrência de preços/Equipe e proteção do último admin. Não se alteram RPC, RLS, grants, Edge ou migrações.

O workflow Supabase revalida também os ensaios de migração/transição existentes em infraestrutura fictícia do CI; não executá-los enquanto a prévia local está em revisão, pois resets invalidam as fixtures. As evidências e o SHA exato do candidato ficam no corpo atualizado do PR. Avisos de build de `use client` do Lucide permanecem sem erro de compilação.

Prévia: gateway HTTPS protegido existente, Supabase exclusivamente local, Mailpit e personas fictícias. URL/validade são conferidas na entrega e no PR; senha é entregue separadamente, fora do Git/artefatos/logs. APIs/Auth também passam pela proteção. O workflow externo exige que `/__health` identifique exatamente o head do PR e exercita Chromium e WebKit com perfil de iPhone a partir de runner GitHub. Emulação não é prova de aparelho físico; o seletor nativo de captura tem limitações documentadas em `comercial-gerencial.md`.

## Revisão em até cinco minutos

1. Abrir a URL protegida e escolher Administração fictícia. Conferir a fila, “Novo lead” e o atalho de vencidas (1 min).
2. Na Agenda, filtrar Hoje/Vencidas e buscar; abrir uma ficha e voltar conservando o recorte (1 min).
3. No CRM, buscar Studio Aurora, conferir a jornada/triagem; Mercado Sol abre reunião, roteiro e apresentação selecionada, sem notas internas (1 min).
4. Indicadores: variar responsável, abrir um número, voltar e exportar o mesmo CSV. Conferir previstas e realizadas separadas (1 min).
5. Alternar tema, visitar Equipe e trocar para a persona Comercial em `/__review`. Valores e gestão administrativa devem estar indisponíveis (1 min).

## Publicação futura e recuperação

Uma entrega coesa em PR em rascunho sobre main; o commit do atalho é identificável separadamente. A branch tem deploy Git da Vercel desabilitado para evitar preview usando variáveis de produção.

Após aprovação: (1) atualizar refs/main e conferir diff/head; (2) revalidar se a base mudou e esperar todos os checks do SHA candidato; (3) registrar deployment ativo de recuperação; (4) integrar o PR, o que pode disparar frontend na Vercel; (5) conferir SHA/deployment e domínio principal, login e jornada autenticada. **Sem migração e sem publicação de Edge nesta rodada.** Não executar `db push`. Se houver regressão, recuperar frontend `4558ba4` (ou deployment verificado imediatamente antes da publicação), mantendo todo o banco, RLS, papéis, convites, estado dos vínculos e auditoria dos #13–#22.

Pendências: comparação direta com GPT Sites depende de acesso ao projeto original; editor completo de contatos/origem/verificação, paginação para espaços volumosos e séries históricas exigem entregas próprias. A homologação automatizada não substitui auditoria completa WCAG nem teste físico de telefone/leitor de tela. Publicação depende de aprovação posterior.
