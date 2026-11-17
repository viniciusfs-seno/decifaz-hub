# Publicação integrada — Operacional, Comercial e Gerencial

O solicitante aprovou a prévia `53e70b5d19997410aaec5b8953ab5756d074b34f` em 16/11/2026 (Fortaleza) e autorizou explicitamente a publicação dos PRs #19 → #20 → #21 → #22 em fases. Esta autorização substitui o limite de homologação da rodada anterior, sem autorizar testes que alterem vínculos reais.

## Revisão visual e condições antes do rollout

Revisão registrada da Agenda filtrada, Indicadores no Comercial e menu da Administração. Foram feitas novas capturas com dados fictícios, em desktop e celular. A Agenda em Vencidas mostrou o item atrasado e excluiu o chamado futuro; o menu administrativo incluiu Equipe; Comercial não recebeu os controles administrativos nem cards de receita.

O CSV foi baixado pela interface com sessão Comercial na homologação: nenhuma linha financeira ou valor protegido, e a coluna de valor permaneceu vazia. A apresentação ao cliente foi aberta com uma nota interna sentinela presente no editor: a janela mostrou apenas a solução escolhida e não incluiu a nota, o texto interno persistido nem preços não selecionados. Nenhum e-mail, conta ou dado real foi usado nesses testes. O script de verificação e seus resultados permaneceram no ambiente de validação, sem credenciais no Git.

## Estratégia aplicada

Merges preservando ancestralidade, sem squash nem force push. Cada dependente foi atualizado sobre a main da fase anterior em worktree isolado; a árvore de código foi comparada com seu head aprovado e o diff contra main conferido. Tipagem, unitários, builds e os workflows de interface e Supabase local foram reexecutados no head atualizado antes de aplicar o banco e integrar. Os SHAs e links efetivos constam na tabela de fases e nos PRs.

Cada migração saiu do worktree do seu próprio candidato, com dry-run exclusivo de uma versão. O catálogo exige `20261116030000` e os fechamentos exigem `20261116050000`; #21 não tem migração. Não houve atualização da Edge, configuração Auth/SMTP ou atribuição de papéis reais.

## Preservação e verificações

Antes da expansão, foram calculadas somente contagens e digests das 15 tabelas existentes, no servidor, sem exportar identificadores ou conteúdo real. A comparação após cada expansão confirmou a preservação de registros, papéis, vínculos, revisões e auditoria; as colunas novas de revisão de atividades foram excluídas da comparação por serem expansão aditiva. As tabelas novas são verificadas separadamente.

Em produção foram conferidos histórico de migrações, colunas, índices, triggers, RPCs, grants/RLS, autorização de vínculo ativo e revogação da leitura dos JSONs financeiros brutos. Operações que geram alterações, concorrência, recusas e eventos foram testadas somente em Supabase local/CI com fixtures. O navegador no domínio de produção conferiu HTTP 200 e tela de acesso, sem fazer login ou enviar e-mail.

## Recuperação

Antes da primeira expansão foi identificado o deployment #18 `dpl_LQP3bqoKJmJXtX7zp8X9qHPp9ufm`, SHA `4e59c14d08b5080936d38668c6643e0fc1c0cedf`. A cada fase, seu deployment READY no domínio principal passou a ser a recuperação da fase seguinte. Recuperar o frontend anterior preserva expansões, soluções, snapshots, ações, fechamentos e auditoria. Não remover migrações, não resetar produção e não restituir leitura de JSONs protegidos. Após rollback da Vercel, conferir a configuração de promoção antes de retomar o deploy automático.

Ver também o [roteiro de homologação e integração](homologacao-integrada.md), a [entrega operacional](operacional.md) e os [fluxos comerciais e gerenciais](comercial-gerencial.md). As restrições de publicação descritas nas rodadas anteriores são registros históricos: esta publicação foi autorizada explicitamente nesta rodada.

## Fases conferidas

| PR | Candidato após base | Merge | Migração | Deployment conferido | Checks do candidato |
|---|---|---|---|---|---|
| [#19](https://github.com/viniciusfs-seno/decifaz-hub/pull/19) | `44afc1d7aa54228b3402f78159d22e1150cc8f55` | `6c41e74e7d0836d58f5b86c7b4c0f0099ad93d76` | `20261116020000` | `dpl_ANHZKFjEXC1A7mbTHWHj5RoJjX7E` | [CI 1](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43798148213) · [CI 2](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43798148167) |
| [#20](https://github.com/viniciusfs-seno/decifaz-hub/pull/20) | `227f415ef890760c104fa672463195875a955863` | `bf8781be61b6f5b1291635f82a60bb72b1d846f7` | `20261116030000` | `dpl_bQRrQZcWXXR4bEfQeQYuhsq736mT` | [CI 1](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43986647111) · [CI 2](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43986646919) |
| [#21](https://github.com/viniciusfs-seno/decifaz-hub/pull/21) | `167e3ba0642cea8deca29f32dec026b68f79fd34` | `ea7e511e57f6d32e999afca53fde8733b624e4af` | Sem migração | `dpl_7sxPzR2H1XvDVV1c3uw5nTPrbvZy` | [CI 1](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43987990109) · [CI 2](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43987990127) |

O SHA de merge, deployment e checks finais do #22 são registrados no próprio PR após a integração; não se confunde o candidato aprovado da prévia com um SHA novo após atualização de base.

## Revisão visual aprovada e verificada

| Tela | Desktop | Celular |
|---|---|---|
| Agenda filtrada em Vencidas | [Captura](publicacao-integrada/capturas/agenda-vencidas-desktop.png) | [Captura](publicacao-integrada/capturas/agenda-vencidas-celular.png) |
| Indicadores no Comercial | [Captura](publicacao-integrada/capturas/indicadores-comercial-desktop.png) | [Captura](publicacao-integrada/capturas/indicadores-comercial-celular.png) |
| Menu da Administração | [Captura](publicacao-integrada/capturas/menu-administracao-desktop.png) | [Captura](publicacao-integrada/capturas/menu-administracao-celular.png) |

[Apresentação sem notas internas](publicacao-integrada/capturas/apresentacao-cliente.png) · [CSV fictício exportado pelo Comercial](publicacao-integrada/comercial-indicadores-ficticio.csv). A coluna de valor do CSV mantém o cabeçalho de formato, com células vazias e sem grupos financeiros.
