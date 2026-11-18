# Atividades e acompanhamentos

Entrega em revisão, dependente de Prospecção e Importação CSV. Migração `20261118030000_acompanhamentos.sql`, somente local/CI até aprovação posterior.

## Agenda única

“Minhas atividades” e “Agenda do espaço” são recortes da Agenda existente, com vencidas, hoje, próximos sete dias (hoje + seis), sem prazo, responsável, tipo e busca. Não há outra tabela de tarefas. “Minhas” exige `assigned_user_id` explícito: nomes antigos em texto são preservados e não são associados por suposição. A lista de integrantes ativos vem da RPC, restrita ao próprio espaço, sem expor e-mails. Contas sem nome cadastrado usam um rótulo substituto; nomes são apenas identificação de interface, não fonte de autorização.

“Editar acompanhamento” permite alterar prazo, responsável, vínculo à conta, resultado e situação. Na conclusão, pode criar o próximo acompanhamento no mesmo estabelecimento/projeto. A operação não altera preço, aceite ou etapa comercial. O resultado concluído aparece no histórico da ficha; eventos de atividade e auditoria registram ator, antes/depois, revisão e horário.

## Transação, concorrência e atualização

`hub_save_activity` verifica vínculo ativo e módulo no servidor. Comercial escreve atividades comerciais; Operação escreve atividades do projeto; Administração acumula ambas. A revisão também avança nas gravações legadas. Conflito carrega dados vigentes para revisão, sem sobrescrita silenciosa. Conclusão, próximo acompanhamento, histórico, auditoria e recibo são uma transação; falha em qualquer etapa reverte tudo. Repetir a mesma operação retorna seu resultado, sem outro acompanhamento. Editar uma atividade já concluída não inventa nova conclusão.

O vínculo de responsável precisa pertencer ao próprio espaço e estar ativo. Referências cruzadas a estabelecimentos/projetos de outro espaço são recusadas. A próxima ação comercial da ficha só é substituída se ainda corresponder à atividade concluída e o ator puder editar Comercial; outras ações são preservadas. A API legada permanece para compatibilidade/recuperação, protegida por RLS e capturada pelos novos triggers.

Atualização entre sessões usa Postgres Changes filtrado pelo espaço para leads, triagens, interações e atividades, com debounce de 400 ms, além de BroadcastChannel entre abas e atualização ao focar. RLS continua decidindo o que cada sessão pode receber; dados financeiros não entram nessa publicação. Sem Realtime, há atualização de dados a cada 60 segundos com a aba visível; vínculos/papéis são rechecados a cada 15 segundos e nas gravações. Após desativação, a recusa no servidor é imediata, independentemente do timer visual. Snapshots completos ainda são carregados em lotes; agregações e diretórios de grande escala continuam evolução futura.

## Publicação e recuperação

Após aprovação e dependentes: dry-run exclusivo `20261118030000` → aplicar/verificar colunas, triggers, auditoria, grants, diretório, RPC e publicação Realtime → frontend. O Realtime exige que a infraestrutura ofereça `supabase_realtime`; onde ausente, mantém fallback documentado. Recuperar frontend anterior preservando revisão, atribuições, recibos, auditoria e registros. Não reverter RLS nem apagar acompanhamentos. Sem mudança de Edge/Auth.

## Testes

Contas/dados fictícios: Administração, Comercial, Operação, espaço alheio, sessão desativada; duas sessões com atualização automática; Minhas atividades; revisão desatualizada; repetição concorrente; conclusão+follow-up; falha injetada na auditoria reverte a transação; escrita direta de auditoria recusada. Jornada integrada e capturas pelo topo da pilha. SHA/checks/comandos finais ficam no PR.
