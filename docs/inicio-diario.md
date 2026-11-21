# Preparação para o uso diário

## Guia dentro do portal

**Conhecimento → Base de conhecimento → Início diário dos sócios**. Pesquise “Início diário”, “contratos”, “assinaturas” ou “reuniões”. O guia é distribuído com o frontend e não altera o manual original nem registros do espaço. Seu conteúdo descreve contratos/documentos, obrigações/baixas, reuniões e rastreabilidade, com caminhos, permissões e limitações. [Rotina detalhada](rotina-socios.md).

## Identificação autorizada

Migração `20261121000000_identificacao_integrantes.sql`. Mantém assinaturas, formatos e autorização das RPCs `hub_registry_people(uuid)` e `hub_work_assignees(uuid)`. O helper privado não pode ser executado pelos papéis do app. Cada consulta exige vínculo ativo no espaço; outro espaço e sessão desativada são recusados. Não há consulta global de Auth no navegador.

Nome: `full_name`, depois `name`, com espaços normalizados e limite de 100 caracteres. Sem nome, **Conta + identificador anterior ao @** do e-mail já associado à conta. Não se presume nome pessoal, não se devolvem domínio do e-mail, metadados Auth, papéis ou contas externas. Sem nome/e-mail, usa **Integrante sem nome · número**. Homônimos recebem número de distinção dentro do diretório; esse número é apenas apresentação e pode variar se a composição do espaço mudar. IDs continuam sendo as chaves persistidas.

O diretório do histórico inclui desativados; atribuições/sugestões incluem só ativos. Agenda/Dashboard mostram o rótulo atual para um responsável com UUID explicitamente atribuído ou para o antigo fallback técnico exato e não ambíguo. Texto histórico e vínculo não são regravados por uma consulta. Nomes comuns nunca são usados para inferir associação. Campos de reunião oferecem sugestões sem obrigar substituir responsáveis antigos em texto; isso não atribui UUID nem acesso. A ficha de atividades mantém a conta vinculada e seu texto registrado separados.

Não há edição de perfil/nome nesta entrega. Mudança de rótulo não muda ator, conta, papel ou autoria; o histórico resolve o nome atual, sem reconstruir nomes anteriores.

Evidência do guia com dados fictícios: [desktop claro](capturas/inicio-diario/desktop.png) e [celular escuro](capturas/inicio-diario/celular.png). Chromium com viewport emulado, sem overflow; não equivale a teste em aparelho físico.

## Conferência das prioridades

| Rotina | Caminho e cobertura | Limite |
|---|---|---|
| Contratos | Administração → Contratos; existente ou derivado de proposta/versionado; responsável, vigência, avisos, projetos, PDF privado e eventos transacionais | Anexo informado, sem assinatura eletrônica |
| Obrigações/assinaturas | Gestão → Obrigações da Decifaz; avulsa/mensal/anual, competências únicas, baixa manual, comprovantes e histórico | Não paga ou cancela no fornecedor |
| Reuniões | Operação → Projetos e entregas → projeto → Reuniões; pauta, ata, decisões e acompanhamento na transação | Link externo; captura local não é transmissão |
| Rastreabilidade | Gestão → Rastreabilidade e Linha do tempo no registro; ator, data, estados e revisão quando existente | Desde a implantação de cada fonte; sem retroatividade, auditoria de leitura/download ou ações no fornecedor |

Ocorrências são geradas **ao salvar uma obrigação** e ao carregar o financeiro autorizado (até 366 dias adiante, uma vez por espaço/dia na sessão). A geração do servidor impede duplicação por competência. Novas sessões/abertura também atualizam o horizonte; não existe job de geração com o portal fechado. Datas usam America/Fortaleza, com âncora de fim de mês e anual bissexto. Mudanças/pausa/cancelamento preservam pagas, vencidas e do dia; só futuras elegíveis são alteradas. Avisos são internos ao abrir/atualizar o portal. Não há notificações externas agendadas, pagamento automático ou cancelamento no fornecedor.

## Validação e publicação

1. Conferir base main/candidato e checks exatos. `npm run check`, `npm test`, builds demo/compartilhado, `node scripts/mock-validation.mjs` e `node scripts/local-validation.mjs`.
2. `supabase/tests/identificacao_integrantes.sql` usa somente contas fictícias com ROLLBACK: nomes, fallback, homônimos, desativados, anon, helper privado, isolamento e preservação de membros/revisões. `daily-use-real` confere atividade, reunião persistida em outra sessão, histórico, guia, celular escuro e desktop claro. Suítes de contratos/financeiro/reuniões mantêm provas de documentos privados, recorrência, baixa, revisão, falhas e concorrência.
3. `node scripts/directory-upgrade-validation.mjs --reset-local-fixtures`: ambiente descartável no esquema anterior `20261120000000`, dados fictícios, frontend anterior, dry-run exclusivo da nova migração, preservação de registros, frontend anterior após expansão e recuperação, candidato e grants. Não executar com prévia em revisão.
4. Em produção, leitura de versões/metadata; dry-run deve conter **somente `20261121000000`**. Aplicar antes do frontend. Comparar contagens/digests das tabelas do Hub sem registrar linhas pessoais. Conferir definições, SECURITY DEFINER/search_path, grants e proteções financeiras/documentais. Não editar registros reais como smoke.
5. Integrar candidato com checks aprovados; aguardar Vercel READY, SHA de merge e domínio principal. Smoke anônimo: tela de acesso/bundle, Edge e RPCs sem sessão recusados.

Recuperação: frontend do #37, merge `6b80cf78f832f500ac23df7e410e8759cdcc1770`, deployment `dpl_67ikat2qrLjJ4JGvvf6pGJUuwdrG`. A migração de diretório é compatível com esse frontend e deve permanecer. Não apagar membros, documentos, eventos, competências ou revisões, não reabrir grants e não restaurar banco de produção como rollback de interface. Nenhuma Edge é publicada nesta entrega. Candidato, CI, merge, verificação remota e deployment efetivos ficam no PR.
