# Catálogo compartilhado

Parte 1 de Comercial e Gerencial. Depende do PR #19, base `44afc1d7aa54228b3402f78159d22e1150cc8f55`. Sem publicação em produção.

Administração cadastra, edita e arquiva soluções no próprio espaço; Comercial consulta e seleciona as ativas na triagem e na proposta. Campos: nome único por espaço, categoria, descrição, itens de escopo e situação, sem dados financeiros. A RPC compara revisão e devolve os dados atuais em conflito para revisão explícita.

O catálogo da demo era estático. `20261116030000_catalogo.sql` cria `hub_solutions`, RLS, RPC e snapshots. Inicializa as oito soluções da demo em espaços existentes e novos, sem tocar em membros. Os textos iniciais devem ser detalhados pela Administração. GPT Sites retornou projeto não encontrado; referência: demo e identidade oficial.

Selecionar solução não duplica lead/projeto. A composição adiciona itens ao escopo sem repetir linhas idênticas. Cada proposta guarda snapshot não financeiro identificado por ID/revisão. O bloqueio do lead, o versionamento, o controle de preços e o aceite administrativo permanecem nas RPCs existentes. Snapshots herdados permanecem estáveis quando o catálogo muda; versões anteriores preservam escopo e condições. Arquivadas saem das novas seleções, mantendo registros históricos. A triagem valida novas seleções no servidor. Manutenção com subject nulo é um caminho confiável do servidor, não uma API disponível ao usuário do app.

Usuários do app não têm escrita direta no catálogo. A RPC exige Administração ativa do espaço. Views continuam removendo preços e condições para papéis restritos; leitura dos JSONs brutos continua revogada.

Validação: `npm run check`; `node scripts/local-validation.mjs catalog-real.spec.mjs`. Contas fictícias cobrem arquivo, isolamento, API financeira restrita e snapshots de duas versões. SHA e checks finais: PR da branch `feat/catalogo-compartilhado`.

Publicação futura: integrar #19, atualizar base, dry-run/aplicar `20261116030000`, conferir grants/RPC/triggers, depois frontend. Edge sem mudança de runtime. Recuperação: frontend do #19 mantendo catálogo, snapshots, migração e restrições. Sem apagar dados ou liberar JSON. PRs seguintes dependem deste; publicação requer autorização separada.
