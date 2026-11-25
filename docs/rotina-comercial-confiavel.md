# Rotina comercial verificável

Esta entrega fica em PRs em rascunho. Somente as migrações 20261125010000, 020000 e 030000 dos PRs #47–#49 têm publicação autorizada. As novas migrações 20261125040000, 050000 e 060000 não podem ser aplicadas remotamente nesta rodada.

## Regularização assistida

CRM → Regularização cadastral lista estabelecimentos com segmento/origem em texto sem ID, responsável antigo sem vínculo e localização/contato legados. O filtro de informações opcionais começa desligado: ausência não é erro. Um site com formato reconhecidamente inválido é identificado como correção, não como cadastro incompleto.

A fila não altera nada. Revisar abre a ficha existente no campo correspondente, com valor antigo, escolha proposta e confirmação explícita. Não há sugestões de pessoa por semelhança de nome. Novos responsáveis exigem vínculo ativo; categorias arquivadas e vínculos antigos identificados permanecem legíveis no editor/histórico. Segmento e origem originais continuam em seus campos legados; responsável e telefone originais ganham snapshots na primeira regularização. Não há limpeza ou associação automática na migração.

`hub_regularize_lead` exige confirmação, papel de escrita comercial, revisão e identificador idempotente. A gravação, revisão conferida, evento de auditoria e eventual atividade são transacionais. Reenvio não duplica; conflito exige revisar dados atuais. Falha no histórico reverte a mudança. Revisão manual de localização/contato vale somente enquanto os respectivos valores permanecerem iguais. Localização manual ou contato internacional/legado podem ser confirmados sem inventar códigos ou normalização.

Filtros, página, posição e foco são mantidos no retorno. A fila pagina 25 estabelecimentos e calcula o total antes da paginação. Dados opcionais ausentes podem ser consultados por escolha, sem se tornarem obrigações. A fila e a RPC respeitam espaço e vínculo ativo; não consultam preços.

Migração: `20261125040000_regularizacao_assistida.sql`, antes do frontend. Recuperação: frontend anterior mantendo migração aditiva, referências, snapshots e auditoria. Não fazer reset nem exclusão de avaliações. A tabela privada de revisões não é editável pelo app.

Testes locais: `node scripts/local-validation.mjs regularization-real.spec.mjs --workers=1`. Cobertura: ausência opcional, confirmação negada/aceita, revisão, reenvio, duas sessões, isolamento, desativação, falha de auditoria, foco, retorno e capturas 1440 claro/390 escuro.

## Avisos comerciais internos

A migração `20261125050000_avisos_comerciais.sql` estende as fontes da Central e o gerador já existente. Não cria agendador, preferências ou caixa de saída paralelos. `hub_private.notice_settings.commercial_enabled` começa **false**, preservando o frontend anterior durante a expansão. Depois de publicar o frontend compatível, a ativação futura autorizada usa essa chave existente na configuração privada do gerador. Atividades comerciais com prazo, contatos programados e retomadas entram no mesmo recorte de vencimentos. Uma atividade já vinculada à mesma próxima ação/data substitui a fonte do cadastro, inclusive depois de concluída: não ressuscitamos esse contato por duplicidade de origem.

As preferências existentes (30, 7, 1 e 0 dias; resumo às 9h de Fortaleza; escopo pessoal ou espaço) continuam valendo. A geração no servidor funciona sem navegador e recupera atrasos pela antecedência mais próxima aplicável. A chave espaço/integrante/origem/vencimento, com bloqueio transacional por espaço, impede avisos duplicados em reexecução ou concorrência. Uma nova antecedência pode marcar o mesmo aviso como não lido, sem criar outro.

Concluir/cancelar atividade, perder/ganhar/arquivar oportunidade ou mudar prazo invalida o aviso antigo. Retomar uma oportunidade reativa somente fontes ainda pendentes. Trocar responsável invalida o aviso pessoal anterior e permite gerar o aviso para o novo responsável ativo. Avisos do espaço continuam disponíveis aos integrantes autorizados, inclusive para redistribuir pendências sem responsável ativo. Desativação bloqueia a consulta pela sessão já aberta. Ler não conclui; a ação ocorre no registro original. A listagem verifica a origem novamente, mesmo antes do próximo tick.

Avisos comerciais não carregam valores e não entram na caixa de saída nem no resumo por e-mail. O bloqueio é conferido novamente na elegibilidade do envio. E-mail permanece desligado globalmente. Não há ativação de produção nesta entrega.

Publicação futura: aplicar 040000 e seu frontend; aplicar 050000 ainda desativada, publicar e verificar o frontend de avisos e só então ativar `commercial_enabled=true`, mantendo `mail_enabled=false`. O agendador interno existente passa a considerar as novas fontes após essa ativação: não criar outro cron. Recuperação: desligar `commercial_enabled` antes de recuperar o frontend anterior; avisos comerciais antigos passam a invalidados e não são apagados. Avisos financeiros, atividades e histórico permanecem. Não excluir notificações nem religar e-mail. Não é necessário remover a coluna ou reverter funções para desativar as fontes comerciais.

Teste: `node scripts/local-validation.mjs commercial-notices-real.spec.mjs due-center-real.spec.mjs --workers=1` — cinco cenários passaram, incluindo duas conexões SQL sem navegador, reexecução, troca de responsável, reagendamento, leitura, conclusão, isolamento, desativação, permissões e navegação móvel. Capturas em `.validation/commercial-routine` (artefato privado/local ou CI).

## Limites

Os catálogos continuam revisáveis; dados ambíguos não recebem conversão automática. Um texto responsável não concede acesso e não identifica uma conta por si só. Não há alteração de dados reais durante a homologação.
