# CRM e triagem com paginação no servidor

Dependência: ficha compartilhada (#24). Migração `20261117020000_crm_paginado.sql`; produção não autorizada nesta rodada.

CRM e Triagem usam `hub_crm_page` para busca textual, etapa, responsável, prioridade e ordenação no servidor. São 25 registros por página (limite de RPC 100), com total exato do recorte e desempate por ID em todas as ordenações. Busca ignora caixa e os acentos portugueses usuais. Tabela e Kanban mostram a mesma página, explicitamente identificada. Filtros alterados voltam à primeira página; retorno da ficha conserva página, filtros, foco e posição de rolagem no espaço da sessão. Inserções/remoções concorrentes podem deslocar posições de paginação por offset; não se promete uma sessão congelada, e páginas removidas são ajustadas para a última disponível.

`hub_crm_export` usa o mesmo filtro e ordem, em uma consulta ao banco; exporta **todo** o recorte, sem o limite da página ou o teto de linhas do PostgREST. Campos exportados são Nome, Segmento, Cidade, Etapa, Responsável, Próxima ação e Prazo. Fórmulas CSV são neutralizadas. Não lê propostas/projetos financeiros. Permissão no servidor exige vínculo ativo e consulta comercial no próprio espaço, sem usar um papel fornecido pelo navegador.

Dashboard, indicadores e seletores ainda precisam de snapshots completos. Suas consultas de leads, triagens, atividades, propostas, reuniões, projetos, catálogo e financeiro passam a ler lotes ordenados de 500, evitando truncamento silencioso após 1000 registros. Isso corrige os totais/exportações existentes; **não é paginação visual dessas outras listas nem um snapshot transacional de todas as tabelas**. Agregações de grande escala no banco, diretórios pesquisáveis e paginação das listas restantes são próximas otimizações. Auditoria financeira mantém o limite explícito dos 30 eventos recentes.

## Evidência

`node scripts/local-validation.mjs crm-pagination-real.spec.mjs experience-real.spec.mjs lead-details-real.spec.mjs`. Fixture de 1005 novos leads em um espaço fictício, mais três existentes: total/CSV completos, páginas sem IDs duplicados em empate de data, busca `cafe` encontra `Café`, responsável filtra exportação, retorno à segunda página e foco, Dashboard com 1008 registros. CSV Comercial não contém valores protegidos; admin de outro espaço é recusado. A suíte anterior continua cobrindo desativação, JSONs protegidos e isolamento.

Checks remotos estão bloqueados no momento da abertura por Billing & plans do GitHub: jobs não iniciaram. O PR distingue essa condição dos resultados locais; regularizar a conta e executar os workflows do head final antes de integrar.

## Publicação futura e recuperação

Integrar/publicar #24 primeiro. Depois dry-run exclusivo de `20261117020000`, aplicar e verificar funções, grants, isolamento, contagem e CSV; só então frontend deste PR. Manter os índices/RPCs ao recuperar frontend #24. Sem alteração de Edge/Auth e sem remover permissões, auditoria ou registros. As novas migrações são validadas somente localmente/CI nesta rodada.
