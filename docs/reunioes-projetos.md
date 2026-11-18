# Reuniões vinculadas a projetos — entrega em rascunho

Depende de #30 (contratos) e #31 (obrigações) para a prévia integrada. Não depende de #27–#29. Migração futura `20261118002000`. **Não publicar esta entrega enquanto não houver homologação real da transmissão de tela entre dois participantes.** O usuário informou não haver servidor/conta moderadora de teste e autorizou prosseguir com as entregas independentes. Não houve contratação nem criação de conta externa.

## O que está implementado

A ficha do projeto consulta próximas reuniões, atas, decisões e reuniões comerciais anteriores do mesmo estabelecimento. Nova reunião recebe projeto e contrato opcional do mesmo estabelecimento/espaço; não altera a etapa comercial. Operação/Administração grava pelo servidor com revisão e comando idempotente. Comercial consulta, mantendo a jornada comercial anterior. A ata pode criar/atualizar um acompanhamento pendente vinculado ao projeto na mesma transação. Atividade encerrada não é sobrescrita: novos acompanhamentos devem ser criados na ficha. Erro de auditoria reverte reunião e acompanhamento.

A RPC legada continua disponível para reuniões comerciais sem projeto. Ela não pode sobrescrever reunião vinculada ao projeto sem revisão. O novo caminho devolve o registro atual em conflito; a interface exibe a ata e as decisões vigentes para revisão. Vínculo desativado é recusado mesmo com sessão anterior. Eventos de reuniões passam a ser consultáveis também pela origem projeto/contrato, sem liberar valores do snapshot da proposta.

## Chamada, apresentação e cobertura real

O Hub abre a URL HTTPS da videochamada externa já vinculada. Dentro dela, os participantes precisam usar o compartilhamento do próprio provedor e escolher a janela da visão do cliente. A visão do cliente reutilizada inclui apenas soluções/valores explicitamente selecionados por quem tem acesso; não recebe ata, decisões, respostas ou notas internas. Captura no Hub continua sendo **prévia local**, com seletor nativo, encerramento e erros; não é transmissão remota.

Opção de menor complexidade avaliada: manter chamada externa/Jitsi com moderação e infraestrutura existentes, sem criar uma plataforma WebRTC própria. [Jitsi exige autenticação do primeiro moderador no serviço hospedado](https://jitsi.github.io/handbook/docs/user-guide/user-guide-start-a-jitsi-meeting/). Um ambiente de teste moderado ainda não existe. [Captura exige gesto e escolha do usuário](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia). Não há evidência de um segundo participante recebendo imagem nesta entrega. Testes automatizados de captura local não suprem essa prova. Nenhuma cobrança foi assumida.

## Publicação, critérios e recuperação

Antes de publicar: disponibilizar ambiente/conta moderadora de teste ou provedor já aprovado; comprovar entrada/saída, transmissão/recepção da janela da apresentação entre dois participantes e encerramento, sem expor conteúdo interno. Registrar provedor, navegadores, cobertura e dependências sem tokens/links privados. Se houver custo, obter aprovação antes de contratar.

Depois da homologação: revalidar base/head/checks → dry-run exclusivo `20261118002000` → aplicar e conferir colunas, índices, FKs, triggers e RPC → publicar frontend → conferir SHA/deployment do domínio. Recuperação de frontend #31 mantém colunas, vínculos, auditoria e proteção contra gravação legada das reuniões vinculadas. Não remover registros nem liberar notas a convidados como recuperação.

## Testes

`node scripts/local-validation.mjs project-meetings-real.spec.mjs`: contas fictícias, vínculo ao projeto, ata/atividade atômicas, repetição, revisão concorrente, recusa Comercial/outro espaço, falha de auditoria, sessão desativada e consulta na ficha. Os testes não acessam a URL fictícia da chamada, não enviam e-mail e não alteram vínculos reais. Resultado do head e checks no PR.
