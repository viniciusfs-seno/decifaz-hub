# Rotina inicial dos sócios

Use o espaço autorizado no portal oficial. Administração, Comercial, Operação e Financeiro continuam cumulativos; nenhum nome de responsável concede acesso. Os testes e documentos de homologação são fictícios e ficam separados dos registros reais.

## Começar pelos compromissos reais

1. **Administração → Contratos**: cadastre o contrato existente ou selecione a proposta de origem e seus projetos. Informe responsável, situação, vigência, renovação e aviso prévio conhecidos. Confirme a gravação e anexe o PDF assinado privado. A situação do contrato não aceita proposta nem abre projeto automaticamente. Valores/condições e PDF exigem acesso financeiro; só Administração altera contrato.
2. **Gestão → Obrigações da Decifaz**: registre domínio anual, hospedagem, e-mail e ferramentas, com fornecedor, valor, periodicidade, vencimento base, responsável, renovação automática e data-limite de cancelamento quando conhecidas. Vincule cliente/contrato/projeto quando necessário. O link do fornecedor é uma referência, sem credenciais. Pague fora do Hub e confirme a baixa manual da ocorrência correta; anexar comprovante não paga outra competência.
3. **Operação → Projetos e entregas → Reuniões**: agende, vincule estabelecimento/projeto/contrato, prepare pauta e abra o link HTTPS de chamada externa. Depois, registre ata, decisões e acompanhamento com responsável e prazo. Reuniões comerciais anteriores ao projeto permanecem acessíveis. Notas internas não são enviadas ao convidado pela apresentação selecionada.
4. **Dashboard e Agenda**: acompanhe vencidos, compromissos do dia e avisos de renovação, abrindo o registro de origem. Minhas atividades depende do vínculo explícito do responsável; nomes antigos em texto são preservados. Concluir com follow-up é uma transação, com revisão e repetição idempotente.
5. **CRM e Prospecção**: cadastre ou importe estabelecimentos, confira duplicidades, conclua a triagem com evidências e registre o resultado da abordagem. Abrir WhatsApp/site/Instagram não registra contato realizado. A ficha mantém contexto e rascunho na navegação dentro do espaço. Propostas separam escopo, valores e revisão; preço e aceite continuam administrativos.

## Avisos, competências e limitações

Ocorrências são geradas ao consultar o financeiro, até 366 dias adiante, com chave de competência que impede duplicação em repetição/concorrência. Dias 29/30/31 ajustam ao último dia do mês sem perder a âncora; periodicidade anual respeita anos bissextos. Datas e fronteira de vencimento usam America/Fortaleza. Alterar valor, pausar ou cancelar afeta somente futuras ocorrências elegíveis, preservando vencidas e pagas. Previsto, pago e vencido têm recortes separados no CSV.

Avisos são internos, ao abrir/atualizar o portal. Não há agendamento de notificações externas com o portal fechado, pagamento automático nem cancelamento junto ao fornecedor. A responsabilidade de pagar/renovar/cancelar fora do Hub continua com o integrante indicado.

O documento assinado é identificado como anexo informado: não há assinatura eletrônica nem verificação criptográfica. Captura local depende da escolha do usuário e não transmite imagem a outro participante. Sem provedor disponível, videoconferência nativa permanece planejada e opcional; chamada externa, agenda, ata e atividades funcionam independentemente. Qualquer contratação exige aprovação.

## Rastreabilidade

Contratos, projetos, reuniões vinculadas, obrigações, ocorrências, pagamentos e anexos registram eventos de servidor com espaço, ator, data, estado anterior/novo e revisão quando disponível, na transação da mudança. A consulta por registro/integrante respeita espaço e acesso financeiro; o app não pode forjar, editar ou excluir eventos. A cobertura começa nas respectivas migrações, sem reconstrução de eventos anteriores. Consultas, downloads e ações feitas no fornecedor não são auditados. Papéis, ficha e atividades também conservam suas auditorias próprias; a linha do tempo não deve ser interpretada como registro de toda ação possível.

## Publicações e recuperação

| Entrega | Merge confirmado | Migração |
| --- | --- | --- |
| #30 Contratos e rastreabilidade | `e5165a9aa1de253f9e372513c252e37a92c3a019` | `20261118000000` |
| #31 Obrigações e assinaturas | `995943a21bd45816ab7b7c4f4576d9bae89c7a25` | `20261118001000` |
| #32 Reuniões de projeto | `da3fd8abe8da56db6fdc2482eabb015a3b45ba0f` | `20261118002000` |
| #33 Hierarquia e componentes | `7d1a4750cda3058f4d3d7aaf2f623472f8691ef0` | Somente frontend |
| #27 Prospecção | `d39afa259a9ff3f84c5579bd8fc3eb587a2710af` | `20261118010000` |
| #28 Importação CSV | `8644631bf9ac4f28b1e6fb8601f8a706e3bc9d56` | `20261118020000` |
| #29 Atividades e atualização | `8ea6ba9d2d9c64175773bbf37189d53f92246ad7` | `20261118030000` |
| #34 Ficha e proposta em etapas | Conferir estado/SHA final no PR | Somente frontend |
| Busca global | Candidato em validação, estado efetivo no PR | `20261120000000` antes do frontend |

Para cada fase: atualizar a base, conferir diff, revisar alterações e checks do SHA candidato, consultar histórico remoto e executar dry-run que contenha somente a migração pendente. Aplicar e verificar antes de integrar o frontend. Conferir preservação dos registros/vínculos, RLS, grants, views, RPCs, auditoria, Vercel READY e SHA no domínio principal. Não reaplicar migrações já publicadas. Banco e Edge de produção não são usados para fixtures.

O #34 não requer banco/Edge; recuperação usa o frontend de #29. Busca global adiciona somente uma RPC de metadados: validar o frontend anterior durante a expansão e recuperação; depois publicar o frontend e conferir o domínio. Após a busca, recuperação usa o frontend do #34 mantendo a função adicionada. Em todas as fases, preservar documentos, eventos, revisões, vínculos, papéis, ocorrências e as revogações dos JSONs brutos. Nunca reabrir grants ou apagar registros como recuperação de interface.

Checks, capturas, candidato final, merge e deployment efetivos são registrados na descrição de cada PR. O guia de [busca global](busca-global.md) mapeia os cenários automatizados da jornada; as regressões rodam com contas/documentos fictícios, incluindo sessão anterior à desativação, papéis restritos, isolamento, concorrência e falhas transacionais.
