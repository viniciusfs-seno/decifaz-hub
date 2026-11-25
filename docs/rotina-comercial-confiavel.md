# Rotina comercial verificável

Esta entrega fica em PRs em rascunho. Somente as migrações 20261125010000, 020000 e 030000 dos PRs #47–#49 têm publicação autorizada. As novas migrações 20261125040000, 050000 e 060000 não podem ser aplicadas remotamente nesta rodada.

## Regularização assistida

CRM → Regularização cadastral lista estabelecimentos com segmento/origem em texto sem ID, responsável antigo sem vínculo e localização/contato legados. O filtro de informações opcionais começa desligado: ausência não é erro. Um site com formato reconhecidamente inválido é identificado como correção, não como cadastro incompleto.

A fila não altera nada. Revisar abre a ficha existente no campo correspondente, com valor antigo, escolha proposta e confirmação explícita. Não há sugestões de pessoa por semelhança de nome. Novos responsáveis exigem vínculo ativo; categorias arquivadas e vínculos antigos identificados permanecem legíveis no editor/histórico. Segmento e origem originais continuam em seus campos legados; responsável e telefone originais ganham snapshots na primeira regularização. Não há limpeza ou associação automática na migração.

`hub_regularize_lead` exige confirmação, papel de escrita comercial, revisão e identificador idempotente. A gravação, revisão conferida, evento de auditoria e eventual atividade são transacionais. Reenvio não duplica; conflito exige revisar dados atuais. Falha no histórico reverte a mudança. Revisão manual de localização/contato vale somente enquanto os respectivos valores permanecerem iguais. Localização manual ou contato internacional/legado podem ser confirmados sem inventar códigos ou normalização.

Filtros, página, posição e foco são mantidos no retorno. A fila pagina 25 estabelecimentos e calcula o total antes da paginação. Dados opcionais ausentes podem ser consultados por escolha, sem se tornarem obrigações. A fila e a RPC respeitam espaço e vínculo ativo; não consultam preços.

Migração: `20261125040000_regularizacao_assistida.sql`, antes do frontend. Recuperação: frontend anterior mantendo migração aditiva, referências, snapshots e auditoria. Não fazer reset nem exclusão de avaliações. A tabela privada de revisões não é editável pelo app.

Testes locais: `node scripts/local-validation.mjs regularization-real.spec.mjs --workers=1`. Cobertura: ausência opcional, confirmação negada/aceita, revisão, reenvio, duas sessões, isolamento, desativação, falha de auditoria, foco, retorno e capturas 1440 claro/390 escuro.

## Limites

Os catálogos continuam revisáveis; dados ambíguos não recebem conversão automática. Um texto responsável não concede acesso e não identifica uma conta por si só. Não há alteração de dados reais durante a homologação.
