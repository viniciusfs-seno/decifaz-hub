# Decifaz Hub Operacional

Prévia integrada, sem publicação em produção. Base conferida por `git fetch origin main`: `4e59c14d08b5080936d38668c6643e0fc1c0cedf` (#18). Branch `feat/hub-operacional`.

## Referência e escopo

Comparação feita entre `src/main.tsx` (demonstração em armazenamento local) e `src/pilot-app.tsx` (Supabase). O projeto GPT Sites salvo no repositório retornou `project_not_found` na conexão disponível; a listagem de sites acessíveis veio vazia. A referência aplicada foi a demo e os SVGs oficiais de `public/identidade`, sem reconstruir uma versão presumida do Sites.

| Área | Compartilhado antes | Só na demonstração / diferença | Entrega desta rodada |
|---|---|---|---|
| Navegação | Módulos concentrados em Comercial | Grupos por função | Visão Geral, Comercial, Operação, Gestão, Conhecimento e Administração |
| Dashboard | Contagens, funil textual e financeiro mensal | Fila e indicadores navegáveis | Fila por prazo, vencidas/hoje, reuniões, funil e projetos com listas e atalhos; receita prevista e recebida separadas |
| Agenda | Lista de atividades de pós-venda | Reuniões, atividades, contatos e entregas juntos | Agenda persistida, tipos, responsável, busca, vencidas/hoje/próximos sete dias, concluídas e estados vazios |
| Revisão semanal | Ausente | Revisão e ações locais | Revisão por frente, ações vinculadas com responsável/prazo e deduplicação no servidor |
| Ficha | Cadastro, triagem e reuniões com atalhos separados | Resumo da jornada | Marcos cadastro → triagem → reunião → proposta → projeto → pós-venda; atalhos aos registros existentes |
| Administração | Equipe, convites, histórico e estado ativo | Configuração/backup da demo | Mantidos no servidor; configurações e backup locais continuam exclusivos da demo |

O fechamento histórico de semanas da demo e revisão financeira com geração de cobranças não foram importados: nesta entrega, as decisões da revisão persistem como atividades vinculadas. Não há um segundo banco de CRM nem importação automática dos dados da demonstração.

## Uso e atualização entre sessões

- Dashboard: cada cartão abre o recorte correspondente. A fila e a agenda reabrem a ficha do estabelecimento ou do projeto. O funil abre somente os estabelecimentos daquela etapa.
- Agenda: reuniões, atividades comerciais, chamados, prazos de projetos e próximos contatos. `Hoje` usa `America/Fortaleza`; `Próximos 7 dias` inclui hoje e os seis dias seguintes. Datas sem horário são mantidas como datas de negócio. Registros sem prazo têm filtro próprio.
- Revisão semanal: selecione a frente, reabra a origem ou planeje uma ação, informando título, responsável e prazo. A RPC deriva o vínculo no servidor. Uma ação pendente/em andamento por origem é reutilizada, mesmo entre sessões; não sobrescreve o título ou responsável escolhido pela outra sessão. Depois de concluir ou cancelar, outra ação pode ser planejada. Propostas reabrem o editor; reuniões reabrem a ficha com a reunião vinculada.
- Ficha: dados básicos ficam em um painel expansível; a jornada, propostas e projetos continuam visíveis. Criar projeto e aceite reutilizam as RPCs existentes. Apenas Administração registra aceite comercial, com evidência explícita, que muda o lead para Ganho. Nenhum novo atalho marca Ganho automaticamente.
- Atualização: ao focar a aba, a cada 15 segundos e pelo botão Atualizar, o Hub revalida o vínculo na Edge e recarrega as consultas. Formulários abertos são preservados durante atualização de fundo. Escritas continuam sujeitas à autorização do banco com a sessão atual.
- Módulos carregam independentemente; falha financeira não bloqueia CRM, agenda, Central ou conhecimento. Indicadores de módulos indisponíveis mostram `—`, em vez de afirmar que não existem registros.
- Financeiro: previsão por vencimento e recebimento por data efetiva são separados, excluindo estornos do recebido. Dashboard, Financeiro e CSV compartilham o mês selecionado. Comercial/Operação não recebem preços/condições das views nem acessam a leitura dos JSONs brutos.

## Artefato de banco, publicação futura e recuperação

Migração aditiva: `supabase/migrations/20261116020000_revisao_operacional.sql`.

1. Revisar o PR em rascunho, seu SHA e os dois workflows. Obter autorização de publicação; esta rodada não autoriza merge/deploy.
2. Em homologação, executar dry-run e aplicar somente a migração acima após o #18. Ela acrescenta origem opcional em atividades, índice único parcial e `hub_review_action(uuid,text,uuid,text,text,date)`. Atividades antigas permanecem sem origem de revisão; não há alteração de membros, papéis, preços, convites ou auditoria.
3. Verificar RPC autenticada, `anon` sem EXECUTE, negação para origem de outro espaço e papel sem escrita. Campos de origem não ganham grants diretos de INSERT/UPDATE. A RPC valida a origem e o módulo, exige título/responsável/prazo e serializa planejamento por espaço.
4. Não há mudança de runtime da Edge. Manter a Edge `hub-workspaces` do #18 e as proteções já publicadas. Somente após validar o banco, integrar o frontend com as novas consultas.
5. Em publicação futura autorizada, conferir SHA e deployment no domínio principal e percorrer os recortes com fixtures de homologação. A branch desta prévia está com deploy automático desabilitado em `vercel.json`.

Recuperação: voltar o frontend ao deployment do #18, mantendo a migração aditiva e todas as atividades criadas. O frontend anterior ignora as colunas novas e continua vendo ações como atividades normais. Não remover colunas, índice, dados ou revogações de leitura dos JSONs. Se a nova RPC precisar ser suspensa, revogar seu EXECUTE para `authenticated` e recuperar o frontend; não liberar tabelas protegidas nem modificar vínculos reais. O Supabase local pode ser recriado para ensaio; produção nunca deve ser resetada.

## Validação automatizada e prévia

Somente Supabase local em `127.0.0.1:54321`, usuários `example.invalid`/fixtures existentes e Mailpit. Nenhum e-mail, vínculo ou dado real foi usado.

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/member-state-migration-validation.mjs --reset-local-fixtures
node scripts/transition-validation.mjs --reset-local-fixtures
node scripts/operacional-comparacao.mjs
node scripts/operacional-preview.mjs
```

A prévia exige a migração local atualizada e fica em `http://127.0.0.1:4190/__preview/admin`; o banner alterna Administração e Comercial fictícios. O serviço escuta somente loopback, guarda credenciais fictícias em memória e usa exclusivamente a pilha local. Para testar outra sessão, abra a segunda sessão admin em outro perfil/navegador. Encerrar o processo limpa apenas suas fixtures. Não é um endereço público de hospedagem.

Cobertura nova: virada UTC/Fortaleza, limites dos sete dias, filtros/vazio e deduplicação; revisão em duas telas e chamadas concorrentes, ação persistida com vínculos derivados; atualização do dashboard e agenda em outra sessão; JSON financeiro negado; espaço externo negado; sessão anterior à desativação sem acesso e preservação do outro espaço. As regressões existentes cobrem cadastro → triagem → reunião → proposta → aceite explícito → projeto → entrega → pós-venda, preços concorrentes, último admin, auditoria e convites antigos.

Código validado: `36a376997be9241b24d4071ab69084c992fc9429`. A revisão seguinte atualiza o teste da Central para abrir o painel de dados básicos antes de conferir seus campos; não altera o código do produto. O SHA final e seus dois checks ficam registrados no [PR #19](https://github.com/viniciusfs-seno/decifaz-hub/pull/19), sem confundir evidência de um commit anterior com aprovação do head.

| Verificação local | Resultado |
|---|---|
| Tipagem | Aprovada |
| Testes unitários | 20/20 |
| Builds demo e compartilhado | Aprovados; avisos já existentes de `use client` do Lucide |
| SQL com fixtures revertidas | 7 arquivos aprovados |
| Playwright com Supabase real local | 14/14 |
| Playwright de interface simulada | 5/5, incluindo o teste atualizado da ficha expansível |
| Playwright de backup da demo | 1/1 |
| Transição/recuperação dos papéis | 1/1; pilha restaurada com todas as migrações |
| Migração de vínculos anteriores ao #18 | Dois vínculos e três eventos preservados, sem mudança de papéis/revisões/atores/horários |
| Capturas | 13 geradas e inspecionadas, com fixtures iguais nas duas versões |

O primeiro CI de interface apontou apenas o seletor antigo `Editar estabelecimento`; o teste foi atualizado para verificar a jornada, abrir `Editar dados do estabelecimento` e conferir o nome, sem remover a verificação de navegação. Os [checks do PR](https://github.com/viniciusfs-seno/decifaz-hub/pull/19/checks) distinguem essa execução do head corrigido. Ambos os workflows continuam obrigatórios para promover o rascunho a revisão.

## Capturas comparativas

Para a homologação das quatro entregas juntas, consulte o [ambiente HTTPS protegido e roteiro integrado](homologacao-integrada.md). O acesso de loopback acima pertence à validação inicial; a URL vigente e os checks do candidato ficam no #22.

Mesmo conjunto fictício no #18 e nesta implementação, 1440×1000 e 390×844. Geradas por `scripts/operacional-comparacao.mjs`. Animações desabilitadas apenas no navegador da captura.

| Tela | Antes desktop | Depois desktop | Antes celular | Depois celular |
|---|---|---|---|---|
| Dashboard | [Antes](operacional/capturas/dashboard-antes-desktop.png) | [Depois](operacional/capturas/dashboard-depois-desktop.png) | [Antes](operacional/capturas/dashboard-antes-celular.png) | [Depois](operacional/capturas/dashboard-depois-celular.png) |
| Agenda | [Antes](operacional/capturas/agenda-antes-desktop.png) | [Depois](operacional/capturas/agenda-depois-desktop.png) | [Antes](operacional/capturas/agenda-antes-celular.png) | [Depois](operacional/capturas/agenda-depois-celular.png) |
| Ficha | [Antes](operacional/capturas/ficha-antes-desktop.png) | [Depois](operacional/capturas/ficha-depois-desktop.png) | [Antes](operacional/capturas/ficha-antes-celular.png) | [Depois](operacional/capturas/ficha-depois-celular.png) |

[Dashboard em tema escuro](operacional/capturas/dashboard-escuro-desktop.png).

## Próximas entregas

1. **Operacional:** revisão de produto desta prévia, volume realista/paginação e eventual atualização por Realtime. O recarregamento atual é por foco/intervalo.
2. **Revisão semanal:** fechamento de semana e histórico de decisões, com escopo e permissões próprios, se aprovados.
3. **Ficha e gestão:** enriquecer dados de contato e agenda externa, sem duplicar o CRM ou alterar o fluxo de aceite. Publicação desta rodada depende de revisão e autorização separadas.
