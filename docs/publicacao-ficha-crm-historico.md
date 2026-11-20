# Publicação de ficha, CRM e histórico (#24 → #25 → #26)

Rollout autorizado por Vinícius, aplicado em fases. Cada migração precedeu o merge/frontend correspondente, com dry-run exclusivo e verificações antes de avançar.

| PR | Candidato validado | Merge | Migração | Deployment READY |
|---|---|---|---|---|
| #24 | `6fa28fc6d2afebb15cbbc542dbfa4079c3c19df9` | `8694568420fafc054c60d8f107e20b34cff3d5a8` | `20261117010000` | `dpl_9Rfha5fFgNVJ1FVtbWbFz1DkW8dm` |
| #25 | `778cc084dc95c2ce55e4f6d298c25877f2e59916` | `21cc57b7071389b983d42c403209eb6c2fd97f43` | `20261117020000` | `dpl_DmckbBqesRBkEFtWF366nhTy7BxB` |
| #26 | `919fb67223afe1e3bbff460f0ff4ae503410c4d0` | `e370a62ee8af043ad0ea9d77acdbba1f066844e1` | `20261117030000` | `dpl_APY4hdTr6XnwE9yk1r6Ev4ga9e2r` |

Checks dos candidatos: #24 [interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44192783919) / [Supabase](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44192783863); #25 [interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44208391488) / [Supabase](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44208391440); #26 [interface e prévia externa](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44212549430) / [Supabase e recuperação](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44212549355). Todos aprovados nos SHAs acima.

Na revisão: corrigido recorte esvaziado enquanto o CRM estava em página posterior, com regressão de mudanças de filtros e edição concorrente de itens; eliminadas execuções duplicadas de teste/ensaio no CI. Um runner Ubuntu mais recente excedeu o timeout baixando dependências, antes de executar a checagem externa: fixado Ubuntu 24.04 e repetida a mesma suíte, aprovada.

## Verificações

Em produção: histórico de migrações, colunas/revisões, RPCs, triggers, grants, RLS de todas as tabelas Hub, auditoria sem escrita pelo app e guarda financeira. Fingerprints privados e agregados confirmaram preservação dos vínculos, leads, propostas e atividades em cada fase, sem registrar dados/identificadores no Git. Após a pausa, o estado remoto havia mudado desde o dry-run; a proteção impediu a aplicação até uma nova preparação. Nenhum registro real foi alterado nos testes.

Vercel confirmou cada SHA pelo domínio `https://decifaz-hub.vercel.app/`. Smoke público HTTP 200/tela de acesso e Edge sem sessão recusada; sem e-mail, login ou mutação de conta real. Navegação autenticada, valores protegidos, edição simultânea, isolamento, mais de mil registros, CSV e recuperação foram testados com contas fictícias localmente/CI, incluindo Chromium e WebKit externo.

## Recuperação

Manter as três expansões e todas as restrições financeiras/RLS. Recuperação por frontend anterior: #25 (`dpl_DmckbBqesRBkEFtWF366nhTy7BxB`) ou #23 (`dpl_2s1fkRpSS8gpJbRpdkUyUSXqo2JU`) conforme a regressão, sem apagar revisão, eventos, recibos futuros, vínculos ou dados. Não houve mudança de Edge/Auth nesse rollout. Recuperação deve ser confirmada na Vercel; rollback pode suspender atribuição automática de deployments futuros.

As novas migrações `20261118010000`, `20261118020000` e `20261118030000` dos PRs #27–#29 permanecem **somente local/CI**, sem autorização de produção. Ordem futura: Prospecção → CSV → Atividades, banco antes de cada frontend, atualizando base/diff/checks após cada integração.
