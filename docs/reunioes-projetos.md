# Gestão de reuniões vinculadas a projetos

Gestão publicada no #32, merge `da3fd8abe8da56db6fdc2482eabb015a3b45ba0f`, sobre #30/#31. Migração `20261118002000` aplicada e verificada, sem alterar vínculos/dados anteriores. O novo pedido do usuário autorizou publicar a gestão independente da videoconferência. **Transmissão entre participantes continua pendente e não é anunciada como disponível.** Não houve contratação nem criação de conta externa. A gestão foi publicada na ordem dry-run exclusivo → migração → verificação de colunas/FKs/RPC/guard/grants e preservação → frontend. Deployment verificado `dpl_CL57GGp4hU3q9LbX9jToLJyEttee`, no SHA do merge. O candidato `be36fda` passou nos workflows de interface, Supabase e homologação externa com contas fictícias; links no #32.

Para uma futura entrega de videoconferência: disponibilizar ambiente/conta moderadora de teste ou provedor aprovado; comprovar entrada/saída, transmissão/recepção entre dois participantes e encerramento, sem expor conteúdo interno. Se houver custo, obter aprovação antes de contratar. Não reaplicar a migração já publicada para habilitar uma chamada.

Recuperação da gestão: frontend #31 mantém colunas, vínculos, auditoria e proteção contra gravação legada das reuniões vinculadas. Não remover registros nem liberar notas a convidados como recuperação.

Rotina operacional atual, notificações e recuperação: [guia dos sócios](rotina-socios.md). Videoconferência nativa é opcional para esta rodada e permanece planejada.
