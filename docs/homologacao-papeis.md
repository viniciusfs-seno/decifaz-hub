# Homologação dos papéis pelos sócios

Proposta para aprovação, sem atribuição de papéis reais. Conferida contra `hub_can`, RLS, privilégios de coluna, views, RPCs e `hub-workspaces` do PR #13. O papel vale para um membro em um espaço; não há isolamento por responsável dentro do mesmo espaço nem combinação de papéis no mesmo vínculo.

| Consulta ou ação | Administração (`admin`) | Comercial (`commercial`) | Operação (`operations`) | Financeiro (`finance`) |
| --- | --- | --- | --- | --- |
| Leads, triagens, reuniões, interações e atividades comerciais | Consultar/editar | Consultar/editar | Consultar | Consultar |
| Escopo e andamento das propostas, inclusive registrar envio, aceite e recusa | Consultar/editar | Consultar/editar | Consultar | Consultar |
| Implantação, mensalidade e condições comerciais nas propostas | **Consultar e definir/alterar** | Ocultos; gravação preserva valores atuais | Ocultos | **Consultar**, sem editar proposta |
| Escopo e andamento dos projetos e suporte | Consultar/editar | Consultar | Consultar/editar | Consultar |
| Abrir projeto, homologar entrega e abrir suporte | Sim | Não | Sim | Não |
| Valores e condições no snapshot aprovado do projeto | Consultar | Ocultos | Ocultos | Consultar |
| Atividades vinculadas a projeto | Consultar/editar | Consultar | Consultar/editar | Consultar |
| Contas, recebimentos, despesas, auditoria e CSV financeiro | Consultar e operar | Sem acesso | Sem acesso | Consultar e operar |
| Definir papel/criar vínculo por `hub_set_role` no próprio espaço | **Sim**, preservando último admin | Não | Não | Não |
| JSON bruto `record`/`approved` após restrição | Sem SELECT direto | Sem SELECT direto | Sem SELECT direto | Sem SELECT direto |
| Outro espaço sem vínculo | Sem acesso | Sem acesso | Sem acesso | Sem acesso |
| Base de Conhecimento | Consultar | Consultar | Consultar | Consultar |

“Editar” não concede exclusão irrestrita nem privilégios de banco. O snapshot aprovado não é um editor de preços. Operações financeiras seguem as RPCs e regras de estados existentes: previsão a partir do aprovado, recebimento parcial/estorno, criação e baixa de despesa ainda não paga; auditoria é somente leitura. Comercial cria propostas com valores iniciais zero, que Administração precisa definir. Comercial pode registrar aceite sem consultar preço/condições: essa alçada precisa de aprovação expressa.

## Correspondência com as regras efetivas

| Superfície | Regra e limite |
| --- | --- |
| `hub_workspaces`, `hub_members` | Associação ao espaço e consulta do próprio vínculo; sem escrita direta autenticada em membros. Backfill mantém vínculos como admin; DEFAULT removido na mesma transação. Novo vínculo exige papel explícito. |
| `hub_leads`, `hub_triages`, `hub_meetings`, `hub_interactions`, `hub_proposals` | Consulta Comercial para os quatro papéis; escrita comercial só admin/commercial. Interações exigem autor autenticado. Grants de tabelas limitam as políticas: propostas gravadas pela RPC. |
| `hub_projects`, `hub_activities` | Projeto escreve admin/operations. Atividade consulta pelo espaço; escrita muda conforme vínculo ao projeto. Campos protegidos e operações de ciclo ficam nas RPCs. |
| `hub_receivables`, `hub_receipts`, `hub_expenses`, `hub_finance_audit` | Só admin/finance; grants restringem escrita direta. Auditoria não admite edição/exclusão. |
| `hub_proposals_visible`, `hub_projects_visible` | Barreira de segurança e autorização explícita por espaço. Admin/finance recebem JSON completo. Outros recebem só `title`, `scope`, `services`, `validity`, `version`, `decisionAt`. Condições, preços, evidências/eventos não passam pela lista. |
| `hub_save_proposal` / implementação privada | Guarda comercial; valores atuais lidos depois do lock do lead. Chaves `setup`, `monthly`, `terms` enviadas por Comercial são recusadas. Só admin reúne escrita comercial e acesso financeiro. |
| `hub_open_project`, `hub_accept_delivery`, `hub_open_support` | Guarda de escrita em Projetos antes de qualquer ação da implementação privada. |
| `hub_forecast`, `hub_receive`, `hub_reverse_receipt` | Guarda financeira antes da implementação privada. |
| `hub_save_triage`, `hub_save_meeting`, `hub_dashboard` | Invoker: RLS do usuário, incluindo isolamento. Dashboard comercial não confere acesso financeiro. |
| `hub_can`, `hub_set_role` | Usuário é `auth.uid()`. Atribuição serializada por espaço; papel inválido/nulo negado e último admin preservado. Trigger proíbe papel restrito antes de revogar leitura bruta, inclusive no provisionamento administrativo. |
| Edge `hub-workspaces` | JWT validado no código, cliente com JWT do usuário, sem chave administrativa; retorna somente seus espaços e papéis. Sem sessão: 401; sem vínculo: 403. |
| Frontend | Mesma matriz, editores somente leitura e cargas independentes. Não consulta Financeiro sem permissão. O banco continua sendo a barreira de autorização. |

A Base de Conhecimento/manual e arquivos em `public/referencias` são estáticos, distribuídos no frontend. O login controla sua navegação, mas não protege o download dos assets públicos por RLS. Não cadastrar conteúdo confidencial ali; exigir proteção de conteúdo requer uma entrega adicional de armazenamento autenticado.

Campos livres permitidos (escopo, título, serviços e histórico comercial) não fazem detecção automática de valores financeiros. Os sócios precisam revisar o conteúdo existente e estabelecer uma regra editorial antes de conceder papéis restritos.

## Decisões pendentes, reunidas

1. Aprovar ou alterar a matriz, especialmente preço/condições exclusivos de Administração para edição, consulta pelo Financeiro e registro de aceite pelo Comercial sem ver valores.
2. Aprovar leitura comercial e operacional compartilhada no espaço, sem recorte por responsável; definir tratamento de pessoas que precisam acumular funções (hoje um papel por vínculo).
3. Informar os vínculos e papéis reais por espaço; confirmar pelo menos um administrador por espaço e quem fará o provisionamento. O backfill admin é compatibilidade temporária, não homologação das alçadas.
4. Revisar informações financeiras em campos livres e decidir se a distribuição pública dos materiais estáticos é aceitável.
5. Aprovar responsável, janela e critérios operacionais de cada fase, com artefato compatível de recuperação guardado antes da revogação.

Preencher a tabela abaixo em registro privado; não colocar nomes, e-mails ou identificadores reais no Git. Linhas vazias não autorizam alteração. `hub_set_role` associa um usuário Auth já existente; não cria a conta Auth nem envia convite.

| Membro / ID Auth | Espaço / ID | Papel proposto explícito | Aprovação dos sócios | Responsável/data da aplicação |
| --- | --- | --- | --- | --- |
| A preencher fora do Git | A preencher | A preencher | Pendente | Pendente |

Roteiro: [publicação e recuperação](publicacao-papeis.md). Evidências automatizadas: [validação](validacao-papeis.md). Nenhum papel real foi atribuído nesta preparação.
