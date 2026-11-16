# Reunião e apresentação compartilhadas

Parte 2 de Comercial e Gerencial. Depende de #20 (catálogo), que depende de #19. Referência: editores, roteiro e captura da demo; GPT Sites original indisponível.

Na ficha do estabelecimento, registre/edite uma reunião. Prepare pauta e soluções, abra Modo reunião para percorrer as perguntas consultivas, marque as realizadas e anote respostas. Volte à ficha completa para diagnóstico, situação, próxima ação, responsável e prazo. O salvamento usa a RPC `hub_save_meeting` existente; pauta, respostas, perguntas e seleção ficam no JSON da reunião. O acompanhamento usa a chave única da reunião e não duplica atividade em salvamentos repetidos. Ao concluir, a proposta pode reutilizar o diagnóstico. Mantidos os guardas de Ganho e o aceite administrativo.

## Visão do cliente e captura

Escolha explicitamente soluções na área Visão para o cliente e abra a janela limpa. Ela recebe somente nome do estabelecimento, conteúdo das soluções escolhidas e, opcionalmente, valores de versões de propostas selecionados por usuário autorizado a consultar Financeiro. Preços começam desmarcados. Notas, respostas, histórico, condições e contexto interno não são copiados. O HTML usa escape de texto e remove `opener`; a apresentação é uma janela local, não um link público nem um novo endpoint de acesso a dados.

O seletor nativo usa `navigator.mediaDevices.getDisplayMedia`, em contexto seguro e por clique. Estado de espera/captura, cancelamento lógico, recusa/erro e ambiente incompatível são tratados. Encerrar ou fechar o componente para as tracks. A prévia aparece somente no dispositivo; o Hub não implementa transporte WebRTC, sala ou transmissão nativa a outro participante. Para participantes remotos, abra a chamada HTTPS vinculada e compartilhe a janela limpa usando a ferramenta da videoconferência. Não compartilhar a ficha interna inteira.

## Validação e publicação futura

`npm run check`; `node scripts/local-validation.mjs meeting-studio-real.spec.mjs`. Dados fictícios locais: pauta/respostas persistidas e lidas por outra sessão, visão limpa sem nota interna ou preços não selecionados, captura via MediaStream sintético no navegador, encerramento e NotAllowedError. A automação não comprova transmissão entre participantes, que não é anunciada como recurso do Hub.

Não há nova migração nem alteração de runtime da Edge nesta parte. Após #19/#20 e suas migrações, publicar o frontend somente com autorização. Recuperação: frontend do #20; campos opcionais continuam preservados no JSON e as políticas do banco permanecem. Checks/SHA finais constam no PR `feat/reuniao-apresentacao`. Sem publicação nesta rodada.
