# Obrigações da Decifaz

Depende de #30 (contratos e registro de eventos). Entrega independente da videoconferência e da pilha comercial #27–#29. Migração `20261118001000_obrigacoes_decifaz.sql`, depois de `20261118000000`.

## Rotina

Gestão → Obrigações da Decifaz reúne fornecedor, categoria, responsável, valor, frequência, primeiro vencimento conhecido, forma de pagamento informativa, situação, renovação automática, limite de cancelamento e painel HTTPS do fornecedor. Cliente, contrato e projeto são opcionais e validados no próprio espaço. Não guarde credenciais no painel nem nos campos de texto.

Avulsas, mensal, trimestral, semestral e anual geram ocorrências por competência, até 366 dias à frente ao abrir o portal. A data usa o dia original e limita ao último dia do mês: 31/jan → 28/fev → 31/mar; 29/fev anual → 28/fev em ano não bissexto. O calendário e a fronteira entre vencido e futuro usam America/Fortaleza. Para planos antigos, informe o próximo vencimento conhecido: não há importação automática de pagamentos históricos.

Há uma chave única espaço/plano/competência, bloqueio transacional por plano e comando idempotente por ator/operação/payload. Repetir ou concorrer na geração não duplica parcelas. Edições exigem revisão; uma versão desatualizada recebe o estado atual para revisão antes de tentar novamente. Dia-base e periodicidade são imutáveis depois do cadastro: cadastre outro plano quando a regra mudar.

Alteração de valor, pausa ou cancelamento só altera ocorrências **futuras não pagas**, com vencimento posterior ao dia corrente. Pagas, vencidas e do dia permanecem como estavam. Pausar suspende futuras; reativar volta a prevê-las; cancelar não apaga. Nenhuma dessas ações cancela uma cobrança no fornecedor. A baixa é manual, com data passada ou de hoje, valor efetivo, evidência e confirmação explícita; registra pagamento, estado e eventos na mesma transação. Não há estorno nem débito automático nesta entrega. Comprovantes PDF privados usam o mesmo armazenamento protegido dos contratos.

## Consulta e autorização

Financeiro (incluindo Administração conforme a matriz cumulativa) consulta e grava pelo servidor. Comercial e integrantes desativados não recebem planos, parcelas, pagamentos ou eventos financeiros, mesmo com JWT anterior. Não há DML direto para usuários do app. Painel, CSV e cards usam o mesmo recorte de competência/busca/situação, consultando todas as páginas autorizadas. Valores a pagar não vencidos, vencidos não pagos e efetivamente pagos são separados.

Dashboard avisa sobre vencimentos e limites de cancelamento até 30 dias; Agenda mostra as ocorrências e os avisos de contrato com acesso à origem. Avisos internos funcionam ao abrir/atualizar o portal, sem e-mail, push, agendamento externo ou integração bancária. Sessões atualizam dados e autorização a cada 15 segundos e ao retomar foco; o servidor verifica o vínculo ativo em toda chamada.

## Auditoria e cobertura

Triggers registram inclusão/edição dos planos, ocorrências e pagamentos no registro de eventos, com ator, espaço, antes/depois, revisão e horário do servidor. Baixa e evento são atômicos; erro de auditoria reverte a concessão financeira inteira. A consulta por integrante e registro exige Financeiro. Cobertura começa ao publicar a migração, sem reconstrução de eventos anteriores. Consultas, download de documentos e ações externas no fornecedor não são auditados nesta entrega.

## Publicação e recuperação

1. Validar o SHA exato e os dois workflows; homologar com contas fictícias.
2. Depois de #30 publicado, dry-run **exclusivo** da migração `20261118001000`, sem migrações da pilha #27–#29.
3. Aplicar e conferir tabelas, RLS, grants, RPCs, triggers, bucket privado e preservação dos dados/vínculos preexistentes.
4. Integrar/publicar frontend; aguardar deployment READY e conferir SHA do domínio principal, login e navegação.
5. Se o frontend falhar, recuperar o frontend de #30/#26, preservando expansões, parcelas, pagamentos, documentos, auditoria e restrições. Não excluir parcelas nem reabrir grants para recuperar interface. Não reaplicar a migração destrutivamente.

## Validação automatizada

`npm run check`, `npm test`, builds local/compartilhado, `node scripts/local-validation.mjs internal-finance-real.spec.mjs contracts-real.spec.mjs` e workflows do SHA candidato. A regressão usa exclusivamente Supabase local e contas/fornecedores fictícios: datas 29/30/31 e anual, geração repetida/concorrente, edição por revisão, pagamento concorrente/idempotente, falha de auditoria com rollback, leitura financeira negada e desativação com sessão aberta. Resultados e links definitivos ficam no PR.
