# Ficha dedicada e proposta em etapas

Continuação da produtividade #27–#29, preservando contratos, reuniões e obrigações. Entrega de frontend, sem migração ou Edge.

## Ficha do estabelecimento

O CRM abre uma página própria em `#estabelecimento/<id>`, com próximo passo, responsável, prazo, canais, jornada, atividades e histórico. O endereço resolve o registro no espaço autenticado pelo servidor; um identificador alheio não retorna nomes nem conteúdo. A consulta não muda automaticamente de espaço. Navegação e rascunhos são separados por espaço/permissões.

Voltar restaura o recorte, página, posição e foco da lista. Abrir um projeto pela ficha e fechar volta à ficha; o retorno posterior à lista mantém o contexto original. Os dados complementares continuam em seções recolhíveis e registros antigos permanecem editáveis.

Rascunhos do cadastro e da abordagem vivem somente na memória da aba enquanto o portal está aberto: não são gravações no Supabase e não sobrevivem a recarga/fechamento. Trocar de espaço, mudar permissões ou sair descarta esse cache. Ao retomar um rascunho, sua revisão original é mantida; uma alteração concorrente exige revisão dos dados atuais antes de novo salvamento. O formulário informa quando há rascunho não salvo.

## Propostas

O rascunho separa Serviços e escopo, Valores e condições, Revisão e encaminhamento. Todas as seções continuam montadas para preservar valores ao alternar etapas. Uma tentativa de salvar revela a primeira seção inválida, posiciona o foco e apresenta feedback; não se ignora validação por estar em uma etapa oculta.

Somente Administração define preços; Comercial salva escopo preservando preços vigentes no servidor. Consulta financeira exige papel autorizado. Versões, snapshots, aceite explícito administrativo, Ganho e abertura do projeto mantêm os contratos e transações existentes. Nenhum envio a cliente ocorre pelo botão de salvar rascunho; registrar envio exige data/contexto. A visão do cliente continua selecionada separadamente, sem notas internas automáticas.

## Testes e publicação

`npm run check`, `npm test`, builds demo/compartilhado, testes de navegador e CI do candidato final. `record-work-real` cobre retorno entre áreas, rascunhos, revisão concorrente, URL, validação de etapa oculta, preços restritos e retorno projeto → ficha → lista em celular escuro. Os testes anteriores mantêm as asserções, navegando às etapas correspondentes.

Ordem: #29 publicado → atualizar base/diff e revalidar candidato → frontend → Vercel READY → SHA no domínio principal e smoke. Sem banco/Edge. Recuperar o frontend de #29 mantendo registros, eventos, migrações e permissões. SHAs, checks e deployment efetivos serão registrados no PR.
