# Roteiro único — Central e avisos internos (#42 → #43)

Roteiro autorizado pelo titular em22/11/2026 para **publicar #42 → #43 e ativar somente avisos internos**. E-mail permanece desativado. Base inicial: `main` em `100dc1a`, esquema até `20261121010000`. A primeira fase já foi conferida: migração `20261122010000`, merge #42 `aa94118f1d7c14d90c5a547d755265d4d781f1f0`, deployment de produção `dpl_HsFWoTdFm8h7nyNbs5F5Wf2tKJcv`, domínio principal no mesmo SHA e smoke de acesso aprovado. Contagens/digests das35 tabelas anteriores e restrições financeiras permaneceram iguais.

O #43 foi reaplicado sobre essa main: range-diff dos dois commits próprios equivalente, sem incorporar a transmissão. Candidato revalidado, resultado final da segunda fase, ativação e próxima execução ficam no [registro operacional do PR #43](https://github.com/viniciusfs-seno/decifaz-hub/pull/43), atualizado após cada conferência. Não interpretar os ensaios locais ou um plano de ativação como confirmação de que o job remoto já está ativo. Nenhuma fixture será criada em produção.

## Antes de começar

1. Obter autorização explícita de publicação e ativação. Reconfirmar main, heads, diffs e checks. Preservar as branches e referências anteriores. Não incluir a migração de tela `20261121020000` nem depender do #40.
2. Identificar o deployment de recuperação #41 e os deployments anteriores de cada fase. O merge em main pode publicar automaticamente na Vercel: o banco necessário deve estar verificado antes de cada merge.
3. Conferir backup/recuperação, histórico remoto e extensões por leitura. Em 22/11, pg_cron1.6.4 e pg_net0.20.4 estavam disponíveis, mas não instalados. Revalidar na execução. Para avisos internos, somente pg_cron é necessário; não instalar pg_net nem configurar Vault, SMTP ou provedor de e-mail.
4. Verificar vínculos, papéis, revisões e registros existentes por contagens/checksums privados antes/depois. Não salvar identificadores, endereços, documentos ou chaves em Git/CI. Testes que alteram dados continuam restritos ao isolado.

## Ordem de publicação e verificações

| Fase | Artefato / execução futura | Critério para avançar |
|---|---|---|
| Banco da Central | Dry-run contendo **somente** `20261122010000_central_vencimentos.sql`; aplicar a transação. | RPCs `hub_dues`, preferências, listagem/leitura de avisos e reagendamento presentes; grants/RLS pessoais e financeiros corretos; registros existentes preservados; nenhum agendamento. |
| Frontend #42 | Reconferir o SHA aprovado contra main; integrar #42 e aguardar o deployment automático. | Domínio principal no SHA/deployment esperado, acesso e navegação disponíveis; Central abre por papel. Recuperação #41 continua compatível com a expansão. |
| Atualizar #43 | Retarget para main depois do merge de #42. Se squash carregar mudanças já integradas, reaplicar somente os commits próprios do #43; conferir histórico/diff e preservar referência remota anterior. Reescrita somente com `force-with-lease` contra head verificado. | Novo candidato contém somente processamento/resumo/roteiro e ajustes próprios; todos os checks do novo SHA aprovados antes de qualquer fase seguinte. |
| Banco de avisos | Dry-run contendo **somente** `20261122020000_avisos_agendados.sql`; aplicar a transação. | Tabelas privadas e RPCs de servidor sem acesso do app; preferências/avisos por espaço; flags `generation_enabled=false`, `mail_enabled=false`, `sandbox_only=true`; dados e frontend anterior preservados. |
| Frontend #43 | Integrar apenas o candidato revalidado e aguardar a Vercel. | SHA/deployment no domínio principal; resumo e monitor com estados reais. Nenhuma ação de frontend liga envio global. |
| Ativar somente internos | Após conferência/autorização, executar `supabase/ops/avisos-internos-ativacao.sql` na sessão explicitamente aprovada. | Exatamente um job `hub-notice-generation`, a cada minuto; nenhum `hub-notice-outbox`; flags `true/false/true`. Um disparo gera avisos internos e resumo após o horário pessoal; repetir não duplica. |

As funções SQL necessárias já estão nas migrações. **As Edge Functions `hub-notice-worker` e `hub-notice-events` não são necessárias para avisos internos e ficam fora desta ativação.** Se forem disponibilizadas para preparação separada, manter `HUB_NOTICE_MODE=off` e `HUB_NOTICE_REAL_SEND=disabled`. O `hub-workspaces` publicado permanece compatível e não precisa ser alterado para esta entrega.

Não usar `supabase/ops/avisos-ativacao.sql` para esta fase: esse template inclui preparação de despacho HTTP para uma futura aprovação de e-mail. Nenhuma preferência individual autoriza esse despacho. Filas pendentes não equivalem a envio, aceite ou entrega.

## Funcionamento sem navegador

O job executa a função SQL privada no PostgreSQL, independentemente de sessão web. A regra converte datas/horários para America/Fortaleza; o resumo padrão é às 9h e as antecedências são30/7/1/0 dias. Execução atrasada recupera o limiar aplicável. Chaves únicas, lock por espaço e transação impedem duplicação em repetição/concorrência.

O servidor reavalia origem, data, papéis e vínculo ativo. Pagamento, cancelamento, pausa e reagendamento encerram/suprimem avisos e mensagens anteriores conforme a origem; perder autorização financeira ou ser desativado impede envio, mesmo com sessão antiga. A consulta também recalcula a situação antes da próxima execução do gerador. Não é possível recolher mensagem que um provedor já aceitou; **nenhum provedor será ativado nesta publicação**.

## Recuperação

1. Pausar com `supabase/ops/avisos-pausa.sql`: flags de geração/envio falsas e remoção somente dos dois nomes de job desta funcionalidade. Repetir a pausa é seguro.
2. Confirmar zero jobs de avisos ativos e envio falso. Manter qualquer Edge de envio em `off`. Não resetar caixas aceitas/entregues/incertas para pendente.
3. Recuperar o frontend #42 ou #41 pelo deployment registrado, preservando banco expandido, preferências, avisos, caixa e auditoria. Não dropar tabelas, reabrir JSONs protegidos, mexer em SMTP, desfazer papéis ou apagar vínculos.
4. Diagnosticar no monitor e nos resultados sanitizados de `cron.job_run_details`. Após corrigir, revalidar o candidato e reativar somente o gerador interno. O catch-up recupera pendências elegíveis; não reproduz resumos obsoletos de e-mail. Nenhum envio real está autorizado por este roteiro.

## Conferência de ativação sem dados de teste em produção

Na sessão autorizada, configurar `SET hub.notice_activation='approved'` antes do template interno. Verificar flags `generation_enabled=true`, `mail_enabled=false`, `sandbox_only=true`; um único `hub-notice-generation` ativo com `* * * * *` e comando SQL privado; nenhum `hub-notice-outbox`, despacho HTTP ou função de e-mail publicada. Não alterar SMTP/Auth, não criar destinatários, obrigações ou pagamentos fictícios e não usar vínculos reais para testes de alteração. A geração pode criar somente ocorrências/avisos derivados dos registros reais já existentes, conforme a rotina autorizada.

Esperar a execução natural do cron e conferir status, início/fim e execuções internas agregadas, sem títulos, endereços ou identificadores de integrantes nos relatórios. Em pg_cron1.6.4, `cron.job` não fornece uma coluna de próxima execução: para este agendamento a cada minuto, registrar **estimativa** `date_trunc('minute',clock_timestamp()) + interval '1 minute'`, em UTC e America/Fortaleza, junto do relógio do servidor e do último disparo efetivo. Não apresentar a estimativa como campo nativo do agendador nem prometer horário exato após indisponibilidade.

Pausa/recuperação mantém os dados e permissões, removendo somente os dois nomes de jobs desta funcionalidade e desligando as flags. O deployment #42 acima e o #41 `dpl_AdADcyizc8PaFZatue6ed97JrXNj` são referências de frontend; após #43, registrar também seu deployment antes de qualquer recuperação. Contagens/digests comprovam preservação, mas não substituem um backup restaurável. Não afirmar que backup gerenciado foi verificado sem acesso a essa informação.

## Evidências e limites

`node scripts/notice-validation.mjs` roda sem Playwright: pg_cron real gera, worker independente captura no Mailpit, concorrência/reexecução não duplicam e as fontes inválidas impedem o envio. Há casos independentes para pagamento, cancelamento, pausa, mudança de prazo, membro desativado e perda financeira com vínculo ainda ativo. O template interno é exercitado com trava, repetição, flags sem e-mail e pausa.

`node scripts/notices-upgrade-validation.mjs --reset-local-fixtures` ensaia as duas migrações exclusivas a partir do esquema publicado e o frontend #41 antes/depois/recuperação, verificando preservação. A suíte de navegador cobre duas sessões e autorização. Comandos/resultados/checks finais nos PRs.

Limites conhecidos: planos antigos têm limite herdado de132 intervalos de geração; execução parcial fica registrada. Não há aviso externo de falha do próprio agendador. Antes da ativação, medir duração/backlog e observar o monitor; a documentação do Supabase recomenda até8 jobs simultâneos e duração por job inferior a10 minutos. E-mail externo e suas quotas/callbacks exigem homologação e autorização próprias. TURN permanece independente.
