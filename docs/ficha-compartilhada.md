# Ficha compartilhada do estabelecimento

Base: main após #23, merge `d0ae5dd47a48813d2d9c15166bcc5c3cd30a37b0`. Entrega em rascunho; não aplicar a migração em produção nesta rodada.

O cadastro inicial pede somente Nome; Segmento e Cidade continuam opcionais, inclusive para registros antigos. As seções complementares reaproveitam `hub_leads.profile`: Região/endereço; WhatsApp, Instagram, Site e outros canais; responsável do estabelecimento e seu contato; origem/verificação; necessidades; responsável Decifaz, próxima ação, prazo e motivo sem prazo; soluções aplicáveis. Observações e evidências usam `notes`, sem criar uma segunda cópia. Soluções arquivadas já selecionadas continuam visíveis; novas escolhas vêm do catálogo ativo. A ficha exibe um resumo de localização, canais e contato.

Nenhuma etapa, preço, aceite ou Ganho é editado por esse formulário. Diagnóstico e seleção já existentes são preservados; alterações da ficha não modificam snapshots de propostas.

## Servidor, concorrência e auditoria

`20261117010000_ficha_estabelecimento.sql` adiciona revisão aos vínculos de lead existentes (zero), RPC `hub_save_lead`, triggers e `hub_lead_audit`. A RPC exige Administração/Comercial ativo no próprio espaço, aceita somente os campos conhecidos, bloqueia o registro e compara revisão. Conflito devolve a ficha atual para revisão explícita. O perfil é mesclado no servidor, preservando chaves antigas não editadas. A revisão também avança em edições feitas pelas RPCs legadas e API permitida.

Auditoria é gravada na mesma transação, com espaço, lead, ator autenticado, antes/depois, revisão e horário. Seeds/operações administrativas sem sessão têm ator nulo; não são atribuídas a uma pessoa. Consulta somente administrativa no próprio espaço; sem escrita/edição/exclusão pelo app. Falha na auditoria reverte a ficha. Não há backfill de eventos anteriores à implantação.

## Verificação e publicação futura

`node scripts/local-validation.mjs lead-details-real.spec.mjs shared-real.spec.mjs commercial-management-real.spec.mjs`, tipagem, unitários, builds, workflows. A regressão usa duas sessões fictícias, desktop/celular, preservação de perfil antigo, conflito, persistência, isolamento, recusa operacional, escrita de auditoria negada e falha injetada no histórico. Os links e SHA validado ficam no PR.

Após aprovação específica: dry-run contendo somente `20261117010000`, aplicar expansão, verificar grants/RLS/revisão/auditoria e frontend #23; depois integrar/publicar o frontend da ficha. Recuperar frontend #23 mantendo revisão, auditoria, RPC e permissões. Não apagar eventos, não reabrir JSON financeiro e não remover vínculos. Nenhuma configuração Auth/Edge é necessária.

## Publicação autorizada do #23

O candidato aprovado `b07888b` foi integrado em `d0ae5dd47a48813d2d9c15166bcc5c3cd30a37b0`. Vercel READY no domínio `decifaz-hub.vercel.app`: deployment `dpl_2s1fkRpSS8gpJbRpdkUyUSXqo2JU`. Smoke público HTTP 200, tela de acesso e campo E-mail, sem enviar mensagem ou entrar em conta real. Jornada autenticada e navegação são verificadas nos checks com contas fictícias. Recuperação identificada antes do merge: `dpl_AZSiUr1CXGKLA7bTN2KxfN6jdpJj`, SHA `4558ba4`. Não houve banco ou Edge nesse rollout.
