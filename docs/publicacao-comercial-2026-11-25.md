# Publicação das melhorias comerciais — 25/11/2026

Somente #47, #48 e #49 foram autorizados nesta rodada. Publicação sequencial, sem dados fictícios ou impersonação em produção; migração exclusiva antes de cada frontend.

| PR | Candidato revalidado | Migração aplicada | Merge | Deployment READY |
|---|---|---|---|---|
| #47 | `5dd1999052c8da6a2dd263d587c51a41468a7af7` | `20261125010000` | `5bdd6c16af095bc64c06efe65e0c7e8ccce92514` | `dpl_EfWPAqNqa5udBuzcUfaLdsAGCXXs` |
| #48 | `71a13e40fc935478918c24a81d913bbb73393f9e` | `20261125020000` | `f7bd516e8cf1cfc49d4bfa4c5a735d5bb08dbf50` | `dpl_EXbF2te5RjuREGcwNos5YykLobmA` |
| #49 | `16dba63864ecb514247ce87f7082b66ac7dbe787` | `20261125030000` | `383db746a4786bc9ec7544068dccb54fb0a258bd` | `dpl_DryVNrTTEiubUUG4MJLmz5nTwbmG` |

#48 e #49 receberam merge da main, sem reescrever ou perder os commits aprovados. Os diffs próprios foram conferidos antes da integração. Canonical `https://decifaz-hub.vercel.app/` confirmado no SHA do #49 acima. Não houve publicação das migrações 040000, 050000 ou 060000.

## Evidências

- #48: [Supabase, navegador e recuperação](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45583175984), [interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45583176011).
- #49: [Supabase, navegador e recuperação](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45587592950), [interface e prévia externa](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45587592622).
- Dry-run exclusivo por fase. Preservação das tabelas anteriores por contagens e digest dos valores anteriores; fonte das funções comparada e grants conferidos sem imprimir linhas, integrantes ou credenciais.
- O verificador inicial de #49 apontou diferença estrutural em `hub_interactions` pela inclusão de quatro colunas nulas. Não foi repetida a migração. A investigação por tabela confirmou contagem igual; a comparação dos campos preexistentes confirmou preservação. A fonte original da migração e os grants foram conferidos separadamente.
- Leitura direta de `hub_proposals.record` e `hub_projects.approved` segue revogada. Avisos internos mantidos, `generation_enabled=true`; `mail_enabled=false`, `sandbox_only=true`. Cron `hub-notice-generation` ativo a cada minuto. A transmissão experimental e sua configuração foram preservadas.
- Smoke canônico somente leitura: formulário de acesso, validação, foco/ARIA e marcadores da versão; nenhum POST de Auth, escrita de negócio ou erro de página. Jornada autenticada e permissões foram verificadas com dados fictícios no CI.

## Recuperação

Para regressão de frontend do #49, recuperar o deployment READY do #48 mantendo a migração aditiva do #49, os eventos, snapshots e revogações. Para regressão do #48, referência de frontend do #47 acima. Não resetar banco, excluir registros ou restaurar acesso aos JSONs brutos. Confirmar alias, SHA e smoke depois da recuperação. Nenhuma recuperação foi necessária nesta publicação.

As novas funcionalidades estão separadas em #50 → #51 → #52, em rascunho. A primeira base passou para main após #49; a árvore de #49 candidato e a publicada são equivalentes, e seu diff contém apenas regularização. As novas migrações ficam exclusivamente no Supabase local/CI até aprovação posterior. Consulte [rotina comercial](rotina-comercial-confiavel.md).
