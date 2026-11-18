# Contratos e rastreabilidade

Base independente: main após #26 (`e370a62`). #27–#29 permanecem intactos; esta prioridade não depende da prospecção. Migração `20261118000000`, anterior às migrações ainda não publicadas da pilha #27–#29, evitando inversão da ordem futura.

Administração cadastra contratos existentes ou referencia uma proposta/versão e seus projetos do mesmo estabelecimento/espaço. A origem fica imutável e o snapshot da proposta é preservado. Estados de contrato, proposta e projeto são independentes: cadastrar/ativar contrato não aceita proposta, não marca Ganho e não abre projeto. Toda gravação exige confirmação, revisão e vínculo administrativo ativo; conflito devolve o registro vigente. Operação repetida pelo mesmo ator/payload é idempotente.

## Permissões e documentos

Integrantes ativos consultam metadados de contratos. Somente Administração altera. Valores, condições e snapshot financeiro ficam no schema privado; a RPC só os inclui quando `hub_can(finance)` autoriza. Não existem colunas financeiras na tabela pública de metadados. Papéis são cumulativos e conferidos no servidor a cada chamada.

PDFs de até 10 MB ficam no bucket privado `hub-private-documents`, vinculados a espaço/contrato/identificador estável. Administração envia; consulta exige Financeiro, pois o PDF pode conter preços. O download usa sessão e RLS em cada requisição, sem URL pública ou signed URL persistente. Objetos registrados não podem ser sobrescritos pelo app. Upload e registro são duas fases: falha no registro permite repetir o mesmo identificador; upload isolado não fica consultável. Não há limpeza automática de anexos nem exclusão de documentos assinados. O Hub identifica o arquivo como **documento assinado informado**; não verifica assinatura e não implementa assinatura eletrônica. Essa integração é futura.

## Cobertura de eventos

Triggers gravam criação/edição de contratos, condições privadas, projetos, reuniões e despesas legadas na mesma transação, com ator, horário de servidor, antes/depois e revisão quando disponível. Snapshot financeiro do projeto é removido dos eventos operacionais; eventos financeiros exigem Financeiro. Anexos e confirmação administrativa também geram eventos. A consulta filtra registro e integrante e pagina 50 eventos por vez. Usuários do app não podem inserir, editar ou apagar eventos. Ator nulo indica operação de servidor, não uma identidade inventada.

A cobertura começa na implantação; não há backfill de ações anteriores. As auditorias anteriores de papéis, ficha e Financeiro continuam preservadas nas telas existentes. A nova linha mostra apenas eventos das fontes cobertas desde sua implantação. Não equivale a auditoria de leitura, acesso a PDF, exclusão administrativa direta ou ações feitas no fornecedor.

Dashboard mostra contratos vigentes próximos do término e do aviso de renovação (janela de 30 dias, Fortaleza), responsável e acesso à ficha. Avisos são internos ao abrir/atualizar o portal; nenhum e-mail externo é enviado.

## Publicação e recuperação

Depois dos checks/homologação autorizados: dry-run exclusivo `20261118000000` → aplicar → verificar RLS, funções, triggers, bucket privado/políticas e preservação de vínculos/dados → integrar/publicar frontend. Recuperar frontend #26 preservando expansões, objetos/documentos e eventos; não abrir bucket nem reverter restrições financeiras. Produção só recebe a migração desta fase; futuras entregas entram em fases separadas. Comandos, SHAs e links finais ficam no PR.
