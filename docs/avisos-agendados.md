# Avisos com o portal fechado

**Homologação isolada. Produção desativada.** PR dependente da Central (#42), sobre a main publicada #41 (`100dc1a`). Não depende do #40, da migração de tela ou de TURN. Não houve envio real, mudança de SMTP, migração remota ou contratação.

Para revisão e execução futura, seguir o [roteiro único de publicação dos avisos internos](publicacao-avisos.md). Ele mantém e-mail desativado e não exige Edge, pg_net ou Vault para gerar avisos internos.

## Comportamento

O servidor lê os cadastros existentes: contratos/avisos de renovação, obrigações, assinaturas, despesas e previsões de receita. Não cria cadastros paralelos. Para planos ativos, a geração de ocorrências existente é chamada com horizonte de um ano. Ocorrências e competências preservam suas chaves; pagar uma não paga as demais. Planos pausados/cancelados não geram lembretes novos. O gerador antigo limita cada plano a 132 intervalos desde a data-base; planos muito antigos exigem revisão da geração na origem e aparecem como execução parcial, sem descartar os demais planos.

Padrões aprovados: avisos em 30/7/1/0 dias, resumo diário às 9h de **America/Fortaleza**, e-mail desligado. Preferências são pessoais por espaço. “Somente meus registros” exige responsável associado pelo UUID do vínculo; nomes históricos em texto não são inferidos.

Uma chave por espaço/integrante/origem/data impede repetição do mesmo aviso. Aproximar-se de outra antecedência configurada reabre a leitura uma vez, preservando a identidade. A execução atrasada recupera o limiar aplicável; não exige ter rodado exatamente no dia 30, 7 ou 1. Avisos vencidos continuam pendentes até a origem mudar. O resumo interno é preparado uma vez por dia após o horário escolhido, mesmo com e-mail desligado; sua contagem é recalculada com as permissões e a situação vigentes. Resumos de e-mail de dias anteriores são suprimidos, evitando envio acumulado de resumos obsoletos.

**Lido não é resolvido.** A leitura altera somente `read_at`. Pagamento/cancelamento/pausa ou mudança de prazo resolve o aviso anterior, sem alterar a data contratual. O gerador reconcilia o estado persistido; a consulta já confere a origem, mesmo antes da próxima execução. Desligar avisos impede sua evolução/geração quando e-mail também está desligado; os avisos históricos já existentes são preservados.

## Caixa de saída e autorização

A caixa de saída privada registra pendente, em processamento, aceita pelo provedor, entregue, falhou, incerta e suprimida. Chaves estáveis por aviso/antecedência ou resumo/data; `FOR UPDATE SKIP LOCKED` impede que dois processadores capturem a mesma mensagem. Lease de 90 segundos. Lease perdido vira **incerto**, sem repetição automática.

Antes de capturar e imediatamente antes de enviar, o banco verifica: vínculo ativo, conta confirmada/não bloqueada, preferência de e-mail, escopo, papel financeiro quando necessário, situação e data da origem, antecedência e destinatário inalterado. O aplicativo não pode executar RPCs de processamento nem ler/editar as tabelas privadas. Administração consulta somente metadados do próprio espaço e pode confirmar até dois reprocessamentos, com motivo, revisão do número de tentativas e aviso de duplicidade; isso gera auditoria. O monitor não devolve endereço, corpo ou credenciais.

Até cinco tentativas por rodada, intervalos de 60/120/240/480 segundos; erro de limite/servidor é classificado. Resposta de rede incerta ou JSON inválido fica retida. O envelope é congelado antes do primeiro envio; trocar destinatário/provedor bloqueia reutilização. Resend recebe `Idempotency-Key` estável. A [retenção oficial é de 24 horas](https://resend.com/changelog/idempotency-keys); o worker interrompe repetição automática após 23 horas. Reprocessamento manual fora dessa janela ou após resultado incerto **pode duplicar**: não há promessa de entrega exatamente uma vez.

Aceite HTTP do Resend **não confirma entrega**. Somente callback autenticado `email.delivered` atualiza esse estado. Assinatura Svix/HMAC, corpo bruto, tolerância de cinco minutos e ID único de evento protegem o callback; bounce fica como falha. No Mailpit, entregue significa mensagem consultável no sandbox, não entrega externa. A [distinção entre aceite, atraso e entrega](https://resend.com/guides/email/users-never-got-login-code) deve orientar a operação.

Existe uma janela inevitável entre a última verificação no banco e o aceite pelo provedor. Pagamento ou revogação nesse intervalo não permite retirar e-mail já aceito. Por isso a mensagem é genérica, em português, sem valores, nomes de clientes, documentos, sessão ou links privados; aponta somente para `/?central=1`, que exige login e autorização atuais.

## Agendamento e limites

Foi escolhido **pg_cron + caixa transacional no PostgreSQL existente**, sem nova fila contratada. A pilha local disponibiliza pg_cron 1.6.4 e pg_net 0.20.4. A migração **não instala nem agenda extensões/jobs**. Disponibilidade, versão, privilégios e limites do projeto remoto ainda precisam ser conferidos por leitura antes de qualquer ativação; nenhuma consulta local prova a configuração remota.

Modelo futuro: geração a cada minuto (`hub_private.notice_tick`), despacho a cada minuto (`pg_net` → Edge `hub-notice-worker`). Agenda usa UTC, mas a regra de negócio converte horário no banco para Fortaleza. A execução seguinte recupera pendências elegíveis após indisponibilidade. Erro por espaço/plano é registrado sem impedir os demais. Monitor mostra até 20 execuções e 50 mensagens por espaço; “parcial”/“falhou” pede revisão. Ainda não há alerta externo de falha do próprio agendador.

O worker processa no máximo cinco mensagens por chamada e espaça aceitações em 500 ms. Esses valores são conservadores para a homologação, **não garantem atendimento a qualquer volume**. Antes de ativar: medir duração/backlog, checar quota e plano efetivamente existentes, remetente e consentimento/preferências; impedir sobreposição excessiva. Nenhum plano pago ou excedente foi autorizado nesta entrega.

## Variáveis somente no servidor

Exemplo sem segredos em `supabase/functions/.env.example`. Nada em `VITE_*`:

| Variável | Uso |
|---|---|
| `HUB_NOTICE_MODE=off` | Padrão seguro. `mailpit` somente pilha local e destinatários/remetente `@example.invalid`; `resend` somente aprovação futura. |
| `HUB_NOTICE_WORKER_SECRET` | Segredo aleatório ≥32 caracteres, compartilhado exclusivamente entre Vault e Edge. JWT do app não o substitui. |
| `HUB_NOTICE_MAILPIT_URL` | API local do Mailpit, sem relay externo. Não usar endpoint de liberação de mensagens. |
| `HUB_NOTICE_PORTAL_URL` | Origem do portal; worker remove caminho/parâmetros e usa somente `/?central=1`. |
| `HUB_NOTICE_FROM` | Remetente verificado no futuro; sandbox exige `@example.invalid`. |
| `HUB_NOTICE_REAL_SEND=disabled` | Trava extra; `approved` é necessário para Resend, além das travas do banco. Não habilitar nesta rodada. |
| `HUB_NOTICE_RESEND_KEY` | Chave do provedor existente, no secret manager; não reaproveitar ou alterar a configuração SMTP de Auth. |
| `HUB_NOTICE_WEBHOOK_SECRET` | Assinatura do callback do provedor; nunca retornada ao navegador. |

## Publicação futura e recuperação

| Fase | Artefato e critério para avançar | Recuperação |
|---|---|---|
| Central | Revalidar #42/SHA/base/checks; dry-run exclusivo `20261122010000`; grants/RLS, dados preservados; frontend compatível. | Frontend #41, mantendo expansão e histórico. |
| Processamento | Dry-run exclusivo `20261122020000`; funções service-only, monitor administrativo, flags false/false/true; frontend do PR dependente. | Frontend #42 ou #41; preservar tabelas, avisos, caixa e permissões. |
| Edge inativa | `hub-notice-worker`/`hub-notice-events` em `off`; sem segredo retorna 401; nenhum envio. | Manter `off`; nenhuma mudança de SMTP/Auth. |
| Geração interna | Aprovação própria, conferir extensões/jobs/quota remotos; template manual `supabase/ops/avisos-internos-ativacao.sql`, travado por configuração da sessão; um job SQL, sem dispatcher; **mail_enabled continua false**. | `supabase/ops/avisos-pausa.sql`: parar jobs e flags; não remover registros. |
| E-mail | Aprovação posterior explícita, provedor/remetente/limites/callback verificados, Vault configurado por mecanismo privado, monitor e teste autorizado; só então modo/flags de envio. | Desativar flags/jobs e modo; reter incertos. E-mail já aceito não pode ser recolhido. |

O template usa nomes do Vault, nunca credenciais literais na definição do cron. Antes de ativar pg_net, verificar que filas/respostas não são consultáveis pelo app; segredos podem passar pela fila transitória do servidor. Proteger acesso administrativo e retenção/logs. Não copiar conteúdo do Vault para PRs, CI, argumentos ou chat. Reexecutar uma pausa é seguro; não resetar mensagens aceitas/entregues para “pendente”.

## Evidências reproduzíveis

`npm run check`; `npm test`; builds demo e compartilhado; `node scripts/local-validation.mjs due-center-real.spec.mjs notice-processing-real.spec.mjs --workers=1`; `node scripts/notice-validation.mjs`; `node scripts/notices-upgrade-validation.mjs --reset-local-fixtures`.

O ensaio de servidor usa somente `127.0.0.1:54321`, contas `@example.invalid` e Mailpit. Cobre concorrência de geração/captura, fases e catch-up, virada UTC/Fortaleza, resumo às 9h, dia 31/fevereiro bissexto/anual, autorização financeira/espaço, pagamento antes do envio, desativação, preferência alterada, erro 429/backoff/limite, resultado incerto, reprocessamento com revisão, callback assinado/repetido e lease expirado. Um job pg_cron real de cinco segundos gera; processador independente captura no Mailpit **sem navegador aberto**. O job é removido e as flags voltam a false ao final. Nenhuma entrega externa foi testada ou anunciada.

SHAs finais e links dos checks ficam nas descrições de #42 e do PR dependente para não confundir evidência anterior com o commit atual. A prévia é temporária, protegida e desconectada de produção; validade e SHA estão em `/__health`. Capturas de desktop/celular e ensaio externo são artefatos de CI, sem senha ou destinatários reais.
