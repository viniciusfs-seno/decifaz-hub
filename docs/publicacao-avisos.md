# Roteiro único — Central e avisos internos (#42 → #43)

Preparação de 22/11/2026. **Não executado em produção nesta etapa. E-mail permanece desativado.** Base publicada conferida: `main` em `100dc1a`, esquema até `20261121010000`. Os candidatos finais e os checks vigentes são registrados nos corpos dos PRs, sem reaproveitar aprovação de SHA anterior.

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

## Evidências e limites

`node scripts/notice-validation.mjs` roda sem Playwright: pg_cron real gera, worker independente captura no Mailpit, concorrência/reexecução não duplicam e as fontes inválidas impedem o envio. Há casos independentes para pagamento, cancelamento, pausa, mudança de prazo, membro desativado e perda financeira com vínculo ainda ativo. O template interno é exercitado com trava, repetição, flags sem e-mail e pausa.

`node scripts/notices-upgrade-validation.mjs --reset-local-fixtures` ensaia as duas migrações exclusivas a partir do esquema publicado e o frontend #41 antes/depois/recuperação, verificando preservação. A suíte de navegador cobre duas sessões e autorização. Comandos/resultados/checks finais nos PRs.

Limites conhecidos: planos antigos têm limite herdado de132 intervalos de geração; execução parcial fica registrada. Não há aviso externo de falha do próprio agendador. Antes da ativação, medir duração/backlog e observar o monitor; a documentação do Supabase recomenda até8 jobs simultâneos e duração por job inferior a10 minutos. E-mail externo e suas quotas/callbacks exigem homologação e autorização próprias. TURN permanece independente.
