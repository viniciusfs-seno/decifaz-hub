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

A migração `20261125050000_avisos_comerciais.sql` estende as fontes da Central e o gerador já existente. Não cria agendador, preferências ou caixa de saída paralelos. Atividades comerciais com prazo, contatos programados e retomadas entram no mesmo recorte de vencimentos. Uma atividade já vinculada à mesma próxima ação/data substitui a fonte do cadastro, inclusive depois de concluída: não ressuscitamos esse contato por duplicidade de origem.

As preferências existentes (30, 7, 1 e 0 dias; resumo às 9h de Fortaleza; escopo pessoal ou espaço) continuam valendo. A geração no servidor funciona sem navegador e recupera atrasos pela antecedência mais próxima aplicável. A chave espaço/integrante/origem/vencimento, com bloqueio transacional por espaço, impede avisos duplicados em reexecução ou concorrência. Uma nova antecedência pode marcar o mesmo aviso como não lido, sem criar outro.

Concluir/cancelar atividade, perder/ganhar/arquivar oportunidade ou mudar prazo invalida o aviso antigo. Retomar uma oportunidade reativa somente fontes ainda pendentes. Trocar responsável invalida o aviso pessoal anterior e permite gerar o aviso para o novo responsável ativo. Avisos do espaço continuam disponíveis aos integrantes autorizados, inclusive para redistribuir pendências sem responsável ativo. Desativação bloqueia a consulta pela sessão já aberta. Ler não conclui; a ação ocorre no registro original. A listagem verifica a origem novamente, mesmo antes do próximo tick.

Avisos comerciais não carregam valores e não entram na caixa de saída nem no resumo por e-mail. O bloqueio é conferido novamente na elegibilidade do envio. E-mail permanece desligado globalmente. Não há ativação de produção nesta entrega.

Publicação futura: aplicar 040000 e seu frontend; aplicar 050000 antes do frontend de avisos. O agendador interno existente passa a considerar as novas fontes depois da migração: não criar outro cron. Recuperação mantém os registros e pode restaurar as definições anteriores de `due_sources`, `generate_notices`, `mail_eligible` e `hub_list_notices`, preservando os avisos já registrados. Não excluir atividades ou notificações. Validar novamente a exclusão de fontes comerciais da caixa de saída em qualquer recuperação.

Teste: `node scripts/local-validation.mjs commercial-notices-real.spec.mjs due-center-real.spec.mjs --workers=1` — cinco cenários passaram, incluindo duas conexões SQL sem navegador, reexecução, troca de responsável, reagendamento, leitura, conclusão, isolamento, desativação, permissões e navegação móvel. Capturas em `.validation/commercial-routine` (artefato privado/local ou CI).

## Indicadores comerciais verificáveis

Migração `20261125060000_indicadores_comerciais.sql`; Indicadores → Acompanhamento comercial verificável usa os filtros existentes. As RPCs `hub_commercial_metrics` e `hub_commercial_metrics_csv` calculam o recorte completo no servidor, antes da paginação de 25 resultados. CSV inclui todas as linhas, cobertura e denominadores. Nenhuma origem financeira é consultada. Isolamento e vínculo ativo são verificados antes dos resultados.

| Indicador | Evento/data e denominador | Exclusões e interpretação |
|---|---|---|
| Resultados | Data efetiva de interação estruturada ou resultado referenciado de reunião; contagem de resultados por código | Legados sem tipo/data/resultado ficam fora; editar ata não duplica um resultado já registrado |
| Pendentes e vencidos | Posição atual das fontes comerciais da Central, por vencimento no período; vencido antes de hoje em Fortaleza | Concluídas/canceladas e oportunidades Ganho/Perdido/Arquivado ficam fora; tarefa substitui contato equivalente |
| Retomadas | Oportunidades abertas com resultado Retomar e data de retomada no período | Unidade é oportunidade, pode ter atividade; não somar com pendências |
| Cadastro até abordagem | Coorte de cadastros criados no período; primeiro evento explícito Abordagem realizada/avançar com data efetiva até o fim do período | Média em dias, somente observados no denominador. Evento anterior ao cadastro é excluído e contado separadamente. Ausência é indisponível, não zero |
| Resposta do cliente | Indisponível | Não há eventos de envio e resposta correlacionados; não confundir com uma ação da Decifaz |

Responsável/etapa são os atuais da ficha, não sua atribuição histórica. O início da cobertura exibido é o primeiro evento estruturado efetivamente registrado no espaço; implantação sem eventos não cria uma cobertura fictícia. Interações legadas sem cobertura aparecem em contagem separada (todo o espaço/filtros, sem fingir uma data efetiva). As consultas atuais não são snapshots imutáveis de um fechamento. Não reconstruímos eventos antigos nem tempos passados.

Teste local com 1.025 resultados fictícios confirma paginação e exportação acima de mil, ausência distinta de zero, denominação explícita, Comercial sem preços, isolamento, desativação, origem e celular. Comando: `node scripts/local-validation.mjs commercial-metrics-real.spec.mjs --workers=1`.

Ordem futura da pilha: regularização 040000 → frontend; avisos 050000 → frontend; métricas 060000 → frontend. As funções novas são aditivas; recuperação do frontend anterior preserva eventos e revisões. A recuperação de avisos deve restaurar as funções indicadas acima, sem excluir registros ou religar e-mail. Nenhuma destas três fases está autorizada em produção nesta rodada.

## Homologação e revisão

- Tipagem, 40 testes unitários, builds local/compartilhado e revisão de segredos executados; nenhum arquivo de `.validation` rastreado. `.gitignore` já cobre configurações privadas, relatórios, caches e capturas geradas; nenhum código ou migração foi ocultado.
- Suíte integrada inicial: 75 de 76 cenários passaram; houve timeout de polling no cenário de duas sessões de contratos. Repetição dirigida passou com as mesmas asserções. Os checks do head final continuam sendo a condição de revisão, sem ignorar falhas.
- Gerador/processador existente: 12 testes passaram, incluindo pg_cron real sem navegador, atraso, repetição, concorrência, Mailpit, pagamento/cancelamento antes de envio e recuperação. Somente ambiente local com dados fictícios.
- A jornada integrada cobre legado → confirmação explícita → interação → atividade → aviso → conclusão/follow-up → indicadores vistos por outra sessão. Resultados de reunião não duplicam ao corrigir a ata; datas anteriores ao cadastro não viram SLA.
- Evidências desktop/celular nos artefatos dos workflows: regularização, aviso/origem e indicadores. Resumo móvel corrigido para coluna única; teclado e foco seguem componentes existentes. Não é uma declaração de conformidade WCAG completa.
- Ganhos verificáveis: uma ação “Revisar” abre o campo correto; confirmação explícita substitui qualquer associação automática. O retorno mantém os filtros. Aviso distingue leitura de conclusão. Tela pagina 25 resultados e o CSV testado preserva 1.025; ausência de tempo comprovado aparece como indisponível.

Prévia integrada: `node scripts/start-routine-preview.mjs --tunnel CAMINHO_DO_CLOUDFLARED`. Usa Supabase estritamente local e porta 4203, sem alterar a prévia do #49 em 4201. Senha aleatória em `.validation/routine-preview-access.json`, ignorada e com ACL privada. Validade máxima de 24h, dependente dos processos, da máquina e do túnel temporário. O workflow “Prévia da rotina comercial” confere SHA, proteção de API e os três fluxos por runner externo; não confundir acessibilidade externa com teste em aparelho físico. Use somente as personas fictícias da tela de revisão.

O ensaio `node scripts/routine-upgrade-validation.mjs --reset-local-fixtures` é exclusivo de Supabase local descartável (CI), começando no esquema do candidato #49 e aplicando apenas 040000–060000, uma por fase. Verifica dados, contrato anterior e permissões após cada migração. **Não executar na pilha que hospeda uma prévia**: o comando reinicializa o banco local. Não aceita banco remoto.

## Limites

Os catálogos continuam revisáveis; dados ambíguos não recebem conversão automática. Um texto responsável não concede acesso e não identifica uma conta por si só. Não há alteração de dados reais durante a homologação.
