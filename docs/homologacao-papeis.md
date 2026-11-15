# Homologação dos papéis pelos sócios

Matriz implementada, com publicação ainda não autorizada. Há aprovação explícita para um único vínculo existente receber `admin`, `commercial`, `operations` e `finance`, após a restrição. Identificadores desse vínculo ficam exclusivamente na operação privada; não inserir e-mail ou UUID em Git, artefatos ou logs do CI. Nenhuma atribuição real foi aplicada. Conferida contra `hub_can`, RLS, privilégios de coluna, views, RPCs e `hub-workspaces` do PR #13. Não há isolamento por responsável dentro do mesmo espaço; permissões dos papéis no vínculo são somadas.

| Consulta ou ação | Administração (`admin`) | Comercial (`commercial`) | Operação (`operations`) | Financeiro (`finance`) |
| --- | --- | --- | --- | --- |
| Leads, triagens, reuniões, interações e atividades comerciais | Consultar/editar | Consultar/editar | Consultar | Consultar |
| Escopo e andamento das propostas, inclusive registrar envio e recusa | Consultar/editar | Consultar/editar | Consultar | Consultar |
| Registrar aceite que avança o lead para Ganho | Sim | Não | Não | Não |
| Implantação, mensalidade e condições comerciais nas propostas | **Consultar e definir/alterar** | Ocultos; gravação preserva valores atuais | Ocultos | **Consultar**, sem editar proposta |
| Escopo e andamento dos projetos e suporte | Consultar/editar | Consultar | Consultar/editar | Consultar |
| Abrir projeto, homologar entrega e abrir suporte | Sim | Não | Sim | Não |
| Valores e condições no snapshot aprovado do projeto | Consultar | Ocultos | Ocultos | Consultar |
| Atividades vinculadas a projeto | Consultar/editar | Consultar | Consultar/editar | Consultar |
| Contas, recebimentos, despesas, auditoria e CSV financeiro | Consultar e operar | Sem acesso | Sem acesso | Consultar e operar |
| Definir papel/criar vínculo por `hub_set_roles` no próprio espaço | **Sim**, preservando último admin | Não | Não | Não |
| JSON bruto `record`/`approved` após restrição | Sem SELECT direto | Sem SELECT direto | Sem SELECT direto | Sem SELECT direto |
| Outro espaço sem vínculo | Sem acesso | Sem acesso | Sem acesso | Sem acesso |
| Base de Conhecimento | Consultar | Consultar | Consultar | Consultar |

“Editar” não concede exclusão irrestrita nem privilégios de banco. O snapshot aprovado não é um editor de preços. Operações financeiras seguem as RPCs e regras de estados existentes: previsão a partir do aprovado, recebimento parcial/estorno, criação e baixa de despesa ainda não paga; auditoria é somente leitura. Comercial cria propostas com valores iniciais zero, que Administração precisa definir. Comercial registra a evidência do cliente no histórico do lead. Administração confere a proposta e registra o aceite. Somar Comercial e Financeiro permite ver preços e condições, mas a edição dos valores e o aceite continuam exclusivos da Administração.

## Correspondência com as regras efetivas

| Superfície | Regra e limite |
| --- | --- |
| `hub_workspaces`, `hub_members` | Associação ao espaço e consulta do próprio vínculo; sem escrita direta autenticada em membros. Backfill mantém vínculos como admin; DEFAULT removido na mesma transação. Novo vínculo exige papel explícito. |
| `hub_leads`, `hub_triages`, `hub_meetings`, `hub_interactions`, `hub_proposals` | Consulta Comercial para os quatro papéis; escrita comercial só admin/commercial. Interações exigem autor autenticado. Grants de tabelas limitam as políticas: propostas gravadas pela RPC. |
| `hub_projects`, `hub_activities` | Projeto escreve admin/operations. Atividade consulta pelo espaço; escrita muda conforme vínculo ao projeto. Campos protegidos e operações de ciclo ficam nas RPCs. |
| `hub_receivables`, `hub_receipts`, `hub_expenses`, `hub_finance_audit` | Só admin/finance; grants restringem escrita direta. Auditoria não admite edição/exclusão. |
| `hub_proposals_visible`, `hub_projects_visible` | Barreira de segurança e autorização explícita por espaço. Admin/finance recebem JSON completo. Outros recebem só `title`, `scope`, `services`, `validity`, `version`, `decisionAt`. Condições, preços, evidências/eventos não passam pela lista. |
| `hub_save_proposal` / implementação privada | Guarda comercial; valores atuais lidos depois do lock do lead. Alteração de `setup`, `monthly`, `terms` e registro de aceite exigem admin, inclusive quando a pessoa acumula commercial e finance. |
| `hub_open_project`, `hub_accept_delivery`, `hub_open_support` | Guarda de escrita em Projetos antes de qualquer ação da implementação privada. |
| `hub_forecast`, `hub_receive`, `hub_reverse_receipt` | Guarda financeira antes da implementação privada. |
| `hub_save_triage`, `hub_save_meeting`, `hub_dashboard` | Invoker: RLS do usuário, incluindo isolamento. Dashboard comercial não confere acesso financeiro. |
| `hub_can`, `hub_set_roles` | Usuário é `auth.uid()`. Atribuição serializada por espaço; papel inválido/nulo negado e último admin preservado. Trigger proíbe papel restrito antes de revogar leitura bruta, inclusive no provisionamento administrativo. |
| Edge `hub-workspaces` | JWT validado no código, cliente com JWT do usuário, sem chave administrativa; retorna somente seus espaços e papéis. Sem sessão: 401; sem vínculo: 403. |
| Frontend | Mesma matriz, editores somente leitura e cargas independentes. Não consulta Financeiro sem permissão. O banco continua sendo a barreira de autorização. |

A Base de Conhecimento/manual e arquivos em `public/referencias` são estáticos, distribuídos no frontend. O login controla sua navegação, mas não protege o download dos assets públicos por RLS. Não cadastrar conteúdo confidencial ali; exigir proteção de conteúdo requer uma entrega adicional de armazenamento autenticado.

Campos livres permitidos (escopo, título, serviços e histórico comercial) não fazem detecção automática de valores financeiros. Os sócios precisam revisar o conteúdo existente e estabelecer uma regra editorial antes de conceder papéis restritos.

## Decisões pendentes, reunidas

1. Aprovar ou alterar a matriz, com edição de preços e registro do aceite exclusivos de Administração e consulta dos valores pelo Financeiro.
2. Confirmar a leitura compartilhada no espaço e os demais conjuntos. Papéis cumulativos já implementados; o único conjunto real aprovado contém os quatro papéis.
3. Informar os outros vínculos/papéis por espaço, caso existam no futuro. Não inferir atribuições além do único vínculo aprovado. O backfill admin é compatibilidade temporária.
4. Revisar informações financeiras em campos livres e decidir se a distribuição pública dos materiais estáticos é aceitável.
5. Autorizar explicitamente o rollout coordenado do PR #13 (banco, Edge, merge/frontend, restrição e atribuição aprovada), com responsável/janela e recuperação. A aprovação do conjunto de um vínculo não autoriza publicar o PR.

Preencher a tabela abaixo em registro privado; não colocar nomes, e-mails ou identificadores reais no Git. Linhas vazias não autorizam alteração. `hub_set_roles` associa um usuário Auth já existente; não cria a conta Auth nem envia convite.

| Membro / ID Auth | Espaço / ID | Papéis propostos explícitos | Aprovação dos sócios | Responsável/data da aplicação |
| --- | --- | --- | --- | --- |
| A preencher fora do Git | A preencher | A preencher | Pendente | Pendente |

Roteiro: [publicação e recuperação](publicacao-papeis.md). Evidências automatizadas: [validação](validacao-papeis.md). Nenhum papel real foi atribuído nesta preparação.

## Próxima entrega proposta

PR separado para **Administração → Equipe**: listar os vínculos do próprio espaço para quem tem admin, editar papéis com seleção múltipla e enviar o conjunto completo a `hub_set_roles`. Mostrar os papéis atuais, tratar recusa do último administrador e impedir autoelevação de usuários comuns; testar também isolamento e alterações concorrentes. Não criar listagem ampla nem editar membros diretamente para contornar a RPC. A interface ainda não existe nesta entrega.
