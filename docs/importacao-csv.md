# Importação assistida de estabelecimentos

Em revisão; não publicar sem aprovação. Depende da Prospecção (#27) e da pilha publicada de ficha, CRM e histórico (#24–#26). Migração `20261118020000_importacao_csv.sql`; sem Edge/Auth.

Fluxo: baixar modelo → escolher CSV → mapear colunas → escolher Identificado/Em pesquisa → validar no servidor → conferir dados/erros e possíveis duplicidades → escolher atualizar/criar separado/ignorar → confirmar. Até 1000 linhas e 2 MB por arquivo, UTF-8 ou Windows-1252, separadores `;`, `,` ou tabulação, aspas e quebras internas. O navegador mantém o arquivo somente em memória; não o envia como artefato nem o grava no Git.

Nome é obrigatório; os demais campos são opcionais. WhatsApp aceita DDD/número com 55 opcional; site exige HTTP/HTTPS completo. Necessidades são dados a verificar, não diagnóstico confirmado. Não há colunas para preço, orçamento, interesse confirmado, aceite ou Ganho. O servidor recusa essas entradas e etapas avançadas, mesmo por chamada direta.

## Possíveis duplicidades

Critérios verificáveis: nome+cidade normalizados, número de WhatsApp igual ou URL de site equivalente sem esquema/www/barra final. São **indícios**, não prova de que o estabelecimento é o mesmo. O usuário escolhe explicitamente atualizar um candidato, criar separado apesar da coincidência ou ignorar. Atualização mescla somente campos mapeados (inclusive vazios), preserva perfil legado, etapa, triagem, propostas e vínculos. Revisão desatualizada devolve conflito para revisão.

Importações no mesmo espaço serializam detecção/gravação. Se surgir um candidato depois da prévia, a criação retorna para decisão. Isso não impõe unicidade universal nem impede um cadastro manual independente; futuras coincidências continuam sujeitas à revisão humana.

## Falha parcial e retomada

Cada linha confirmada é uma transação independente, incluindo auditoria e recibo idempotente. O identificador deriva de espaço, ator, conteúdo do arquivo, mapeamento, etapa e posição da linha; não contém dados legíveis. Repetir a mesma operação devolve seu resultado, inclusive depois de recarregar e reenviar o mesmo arquivo/mapeamento. Nunca muda uma gravação já confirmada silenciosamente. Mudança de conteúdo/mapeamento constitui nova operação e passa novamente pela detecção de duplicidades.

Erros por linha não desfazem linhas confirmadas. Linhas inválidas ou sem decisão não são gravadas. Retome pendentes ou baixe as rejeitadas, corrija e envie outro arquivo. Não há promessa de transação única para o arquivo inteiro. A prévia consulta linha a linha para manter o consumo limitado; lotes grandes podem levar mais tempo.

## Publicação e recuperação

Após aprovação e #27: dry-run exclusivo `20261118020000` → aplicar/verificar função, grants, isolamento, revisão, duplicidade concorrente e recibos → frontend. Recuperar frontend #27 mantendo RPC/recibos/auditoria e registros. Não excluir linhas importadas automaticamente como rollback. Testes e resultados finais ficam no PR.
