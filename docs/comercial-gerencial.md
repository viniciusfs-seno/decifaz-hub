# Decifaz Hub Comercial e Gerencial

Prévia integrada com Supabase local e dados fictícios. Produção depende de revisão e autorização posterior. Base conferida: main `4e59c14d08b5080936d38668c6643e0fc1c0cedf`, PR #19 aberto em `44afc1d7aa54228b3402f78159d22e1150cc8f55`.

## Referência, entregas e dependências

O GPT Sites salvo em `.openai/hosting.json` retornou `project_not_found`; a listagem da conexão veio vazia. Referências usadas: `src/main.tsx`, catálogo estático, editor/modo reunião, `MeetingPresentation`, revisão e relatórios da demo, mais identidade oficial do repositório. Nenhuma reconstrução presumida do Sites foi publicada.

| Experiência | Demo / compartilhado #19 | Esta entrega |
|---|---|---|
| Catálogo | Oito soluções estáticas na demo | Catálogo por espaço, edição administrativa, arquivo, revisão concorrente e snapshots vinculados |
| Propostas | Versões, preço/aceite protegidos no compartilhado | Composição do escopo pelo catálogo sem duplicatas, snapshots por ID/revisão, versões anteriores preservadas |
| Reunião | Roteiro e captura na demo; editor persistido no compartilhado | Pauta e seleção de soluções persistidas, modo reunião, apresentação limpa em janela separada e captura local |
| Indicadores | Relatório local e financeiro mensal | Período/responsável/etapa, cards que abrem listas, CSV do mesmo conjunto filtrado e definições explícitas |
| Revisão semanal | Ações persistidas no #19, fechamento só local | Fechamento por espaço/semana, resumo/decisões/plano, histórico de revisões e gravação atômica |

Encadeamento no GitHub: #19 → [#20 Catálogo](https://github.com/viniciusfs-seno/decifaz-hub/pull/20) → [#21 Reunião](https://github.com/viniciusfs-seno/decifaz-hub/pull/21) → branch `feat/indicadores-fechamento` (prévia integrada). Após integrar uma base, conferir ancestry/diff, retarget para main e revalidar o head; não carregar novamente o código já integrado por squash. Os três novos PRs permanecem em rascunho.

## Catálogo, triagem e proposta

Ver [catálogo compartilhado](catalogo-compartilhado.md). Administração cria/edita/arquiva por RPC com revisão, sem grants diretos de escrita. Os oito itens iniciais são pontos de partida a detalhar antes do uso real. Não há tabela de preços no catálogo. Comercial usa soluções ativas; itens históricos arquivados continuam nos registros. Seleções são associadas aos IDs e snapshots no servidor; repetir nomes ou selecionar o nome antigo e novo da mesma solução não duplica a identidade. Alterar o catálogo não reescreve escopos/condições de versões de propostas já registradas.

Proposta em rascunho pode ser editada. Após registrar envio, use “Criar nova versão” para revisar o escopo. Preços e condições continuam sob as regras do #13, com leitura dos JSONs brutos revogada. Apenas Administração registra aceite com evidência explícita e avança para Ganho. O projeto parte do aceite registrado, preservando seu escopo e valores aprovados.

## Reunião e visão do cliente

Ver [reunião e apresentação](reuniao-apresentacao.md). Na ficha, registrar pauta, escolher soluções, abrir o modo reunião, marcar perguntas e anotar respostas. Salvar diagnóstico e acompanhamento com responsável/prazo reutiliza `hub_save_meeting`: o vínculo de acompanhamento é único por reunião, sem duplicar a cada salvamento.

“Visão para o cliente” começa sem conteúdo selecionado. Abra uma janela limpa contendo somente soluções marcadas. Notas internas, respostas, histórico e condições não são incluídos. Usuários com acesso financeiro podem selecionar explicitamente os valores de uma versão de proposta; para os demais, não há controle de valores e os JSONs financeiros não são recebidos pela API. Conteúdo textual é escapado; a janela não recebe sessão/Auth nem consulta o Supabase. Não é um link público permanente.

A captura chama `getDisplayMedia` com seleção nativa de aba/janela/tela; possui estado de espera/captura, encerramento e tratamento de recusa/cancelamento e incompatibilidade. **Captura local não é transmissão pelo Hub.** Para participantes remotos, abrir a chamada HTTPS vinculada e compartilhar a janela “Decifaz · Apresentação” dentro da ferramenta de videoconferência. Não se anuncia transmissão nativa entre participantes: ela não foi implementada.

## Indicadores

Período inclusivo por datas de negócio, responsável e etapa atual. Cards e CSV usam `managementData`, sem recalcular outro recorte na exportação. Valores financeiros só entram nos grupos/CSV de quem tem acesso. Recebimentos estornados ficam fora da receita realizada. Propostas consideram a versão atual de cada série.

| Indicador | Data de referência / significado |
|---|---|
| Funil | Etapa atual dos estabelecimentos criados no período, criação convertida para Fortaleza |
| Conversão | Ganho ÷ (Ganho + Perdido) na mesma coorte; oportunidades abertas ficam fora do denominador; zero encerradas mostra `—` |
| Reuniões | Data da reunião; situação atual, inclusive canceladas na lista |
| Propostas enviadas | Data `sentAt` da versão atual; rascunhos sem envio são identificados e excluídos deste recorte |
| Pendências e suporte | Vencimento; pendências excluem concluídas/canceladas; suporte mostra situação de cada chamado |
| Entregas previstas / realizadas | Prazo do projeto / data de aceite da entrega, separadamente |
| Receita prevista / realizada | Vencimento da previsão / recebimento efetivo, separadamente e sem estornos no realizado |

Responsável é o do registro. Nas propostas, usa-se o responsável atual do estabelecimento; no financeiro, o do projeto. Etapa é a atual do estabelecimento vinculado. Reclassificações atuais podem alterar a coorte anterior. Não há eventos estruturados suficientes para reconstruir evolução histórica das etapas, criação de rascunhos, tempo de ciclo ou SLA do suporte. Esses números não são apresentados como séries históricas. A consulta ainda herda o limite de linhas do PostgREST; homologar paginação/volume antes de usar em espaços grandes.

## Fechamento semanal

Administração fecha a semana; integrantes ativos consultam seu histórico operacional. Segunda a domingo em `America/Fortaleza`, inclusive semanas que cruzam mês/ano. Selecionar uma data normaliza para a segunda-feira. Não é permitido fechar semanas futuras. Resumo obrigatório, decisões, atividades existentes e novas ações com origem, responsável e prazo. Os valores financeiros não são copiados automaticamente para o resumo operacional.

`hub_close_week` bloqueia o espaço e compara a revisão. Ações, fechamento atual e histórico são gravados na mesma transação; falha em qualquer parte reverte tudo. Uma ação pendente de revisão já existente na origem é reutilizada e seu título/responsável efetivos aparecem no snapshot. Duas sessões com a mesma revisão produzem um salvamento e um conflito, sem sobrescrever silenciosamente. A tela carrega os valores atuais e exige revisão antes da nova tentativa. Histórico é somente leitura para usuários do app; não há grants de INSERT/UPDATE/DELETE. A atualização de fundo acrescenta o histórico sem apagar uma edição local em andamento.

## Publicação futura e recuperação

1. Revisar e integrar #19; aplicar sua migração `20261116020000` antes do respectivo frontend, conforme [roteiro operacional](operacional.md).
2. Catálogo: dry-run de `20261116030000_catalogo.sql` em homologação; aplicar/verificar tabela, RPC, triggers, grants, isolamento, arquivo/renomeação e snapshots. Depois frontend #20.
3. Reunião: frontend #21. Sem migração própria: pauta/seleção são campos opcionais no JSON existente. Edge continua a versão compatível com RLS do #18.
4. Gerencial: dry-run/aplicar `20261116050000_fechamentos.sql`; verificar tabelas atual/histórico, consulta restrita ao espaço ativo, RPC admin, concorrência, rollback de falha e negação de escrita direta. Depois frontend integrado.
5. Somente após autorização de produção, conferir SHA/deployment e domínio canônico. As branches desta rodada estão com deploy automático desabilitado.

Recuperação do gerencial: frontend #21, mantendo fechamentos, histórico e ações. Recuperação da reunião: frontend #20, preservando campos opcionais. Recuperação do catálogo: frontend #19, mantendo catálogo/snapshots; nomes alterados podem exigir pausar novas seleções no frontend legado. Pode-se suspender EXECUTE das novas RPCs durante diagnóstico, sem liberar escrita em tabelas ou leitura financeira. Não remover migrações, registros ou revogações dos #13/#18. Não resetar produção. Nenhuma migração, Edge, papel ou vínculo real foi alterado nesta rodada.

## Validação e prévia

Comandos: `npm run check`, `npm test`, `npm run build`, `node scripts/mock-validation.mjs`, `node scripts/local-validation.mjs`, `npx playwright test backup.spec.mjs`, ensaios existentes de migração de vínculos e transição/recuperação. A bateria integrada inclui `catalog-real`, `meeting-studio-real`, `management-real` e `commercial-management-real`, além das regressões de papéis, concorrência de preços, último admin, convites, auditoria e vínculo desativado. Fechamento também tem regressão SQL que injeta falha no histórico e prova rollback das ações. Testes de mês/ano, Fortaleza na virada UTC, denominador e CSV estão em `tests/management.test.mjs`.

Fixtures usam somente Supabase local (`127.0.0.1:54321`) e e-mails fictícios; envio dos testes existentes vai ao Mailpit. Captura foi testada com MediaStream sintético, encerramento, recusa e ausência da API. Não foi comprovada transmissão entre participantes; ela não faz parte do produto entregue.

Prévia integrada: `node scripts/operacional-preview.mjs`, após iniciar/atualizar somente o Supabase local. URL `http://127.0.0.1:4190/__preview/admin`, com alternância Administração/Comercial/segunda sessão admin e fixtures enriquecidas. Chaves administrativas e senhas fictícias ficam na memória do processo; não são incorporadas ao frontend. O servidor escuta apenas loopback.

Não há backend isolado externo nem túnel HTTPS protegido configurado nesta sessão. Por isso **não há URL HTTPS validada fora desta máquina**; não se substituiu a validação externa por um endereço local. Uma prévia móvel externa exigirá esse ambiente isolado e controle de acesso. As capturas abaixo são a evidência responsiva disponível nesta rodada.

| Tela | Desktop | Celular |
|---|---|---|
| Catálogo | [Captura](comercial-gerencial/capturas/catalogo-desktop.png) | [Captura](comercial-gerencial/capturas/catalogo-celular.png) |
| Reunião | [Captura](comercial-gerencial/capturas/reuniao-desktop.png) | [Captura](comercial-gerencial/capturas/reuniao-celular.png) |
| Visão do cliente | [Captura](comercial-gerencial/capturas/apresentacao-desktop.png) | [Captura](comercial-gerencial/capturas/apresentacao-celular.png) |
| Indicadores | [Captura](comercial-gerencial/capturas/indicadores-desktop.png) | [Captura](comercial-gerencial/capturas/indicadores-celular.png) |
| Fechamento | [Captura](comercial-gerencial/capturas/fechamento-desktop.png) | [Captura](comercial-gerencial/capturas/fechamento-celular.png) |

Gerar novamente: `node scripts/comercial-gerencial-capturas.mjs`, usando o mesmo conjunto fictício nos dois tamanhos. SHA e links dos checks efetivos ficam nos corpos dos PRs; a aprovação de um commit anterior não substitui a do head.

Próximas entregas: catálogo (conteúdo/validação dos sócios e catálogo histórico mais rico); reunião (homologação em navegadores/dispositivos e eventual transmissão nativa apenas com prova entre participantes); gestão (eventos estruturados para séries históricas e paginação para volume). Publicação permanece para aprovação separada.
