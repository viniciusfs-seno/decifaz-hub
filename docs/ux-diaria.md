# UX diária e acessibilidade do Hub

Base publicada: PR #44, merge `8af891436decbcd80e6b00820f0c13c0e663c6b6`. Entrega de frontend, sem migração, mudança de RPC ou de autorização. Um PR coerente reúne os componentes e suas aplicações para evitar camadas concorrentes sobre os mesmos formulários. O financeiro confiável do #44 é preservado.

## Inventário e checklist implementado

| Tela/fluxo | Problema encontrado | Implementação e verificação |
| --- | --- | --- |
| Cadastro/ficha de estabelecimento | Detalhes e rótulos inconsistentes; conflito substituía o rascunho | Campos secundários montados e recolhíveis; validação local; recuperação explícita do rascunho após carregar a versão atual; API e outra sessão verificadas |
| Triagem | Erro final genérico sem abrir a etapa; saída descartava edição | Abre identificação, pontuação, evidências ou encaminhamento pendente; formulário acompanha edição; fechamento protegido; score parcial e conclusão preservados |
| Atividades/follow-up | Situação escondida em select; campos condicionais e falhas sem padrão | Radios nativos agrupados; valores temporários preservados; follow-up ausente envia `null`; validação e recuperação de rascunho |
| Reuniões comerciais e por projeto | Muitos campos e validação diferente das demais fichas | Formulário comum, rótulos/erros, campos condicionais e rascunho de conflito; ata/apresentação continuam separadas |
| Propostas | Validação e erros distantes da etapa | Resumo acionável e erro associado ao campo; etapa com erro revelada; versões, snapshots e aceite administrativo preservados |
| Projetos e suporte | Abas podiam esconder uma pendência; aviso de rascunho após chamado salvo | Revelação da aba inválida; preservação do estado montado; suporte informa salvamento ao controle de edição; teclado e retorno ao gatilho |
| Contratos | Vigência e identificação abertas simultaneamente | Identificação primeiro, vigência secundária; estado/autor/origem mantidos; revisão concorrente com rascunho recuperável |
| Obrigações e baixa manual | Renovação e fornecedor misturados aos dados essenciais | Detalhes opcionais separados; bloqueio de periodicidade explicado; vínculos temporários por cliente durante edição; consentimento da baixa validado no envio |
| Financeiro e revisão semanal | Salvar desabilitado por invalidade sem orientação uniforme | Restrições nativas de valor/data; validação e foco; rascunhos dos fechamentos financeiro e operacional recuperáveis; fotografia completa imutável do #44 preservada |
| Preferências | Antecedência vazia impedia salvar sem instrução; hora aparecia sem resumo | Mensagem acionável; hora aparece com resumo habilitado, sem perder a preferência guardada; e-mail continua desligado no servidor |
| Convites | Papéis vazios bloqueavam ação sem explicação; revogação imediata | Validação explícita de papéis; confirmação com consequência antes de revogar; nenhum vínculo é removido |
| Equipe | Conjunto vazio sem orientação | Mensagem direciona à desativação; seleção/conflito, último administrador e confirmações preservados |
| Catálogo, prospecção, apresentações e formulários da demo | Padrões de formulário divergentes | Mesmo `WorkflowForm`/`Field`; recuperação de conflito no catálogo; nenhum contrato de API alterado |
| Filtros, Dashboard e navegação | CRM dependia de placeholder/aria sem rótulo visível | Rótulos visíveis; hierarquia tipográfica da navegação e prazos; recortes/atalhos/contagens e retorno de contexto revalidados |

## Componentes e contratos

- `WorkflowForm` usa constraints HTML e valida ao sair do campo; um erro já apresentado é reavaliado durante a correção. No envio verifica os controles aplicáveis, associa mensagens por `aria-describedby`/`aria-invalid`, abre a seção e move o foco à primeira pendência. O resumo é acionável. Sem framework de formulários nem dependências novas.
- As anotações de erro são nós de texto junto ao controle, fora de seu label para não mudar o nome acessível. Nunca entram no payload nem interpolam HTML/valores privados. A camada não decide permissões, não serializa registros e não modifica contratos de omissão/`null`.
- `Field` oferece label explícito, marcação visual de obrigatório/opcional, ajuda associada, autocomplete e inputmode adequados. `OptionGroup` usa fieldset/legend e radios nativos; aplicado à situação da atividade, onde a conclusão revela o próximo acompanhamento. Selects de filtros, diretórios e listas grandes permanecem nativos. Checkboxes de consentimento e preferências aguardam salvar; não foram transformados em switches de efeito imediato.
- `SecondaryFields` recolhe somente detalhes ainda aplicáveis. Mantém filhos montados, estado de edição e salvamento; informa `aria-expanded`/`aria-controls`. Não desloca foco ao abrir. `RecordTabs` preserva painéis e revela o painel necessário durante a validação.
- Campos realmente inaplicáveis continuam sob o contrato do fluxo: atividade sem novo acompanhamento envia `followup: null`; competência mensal não se aplica à implantação; parâmetros guardados de preferência não executam uma rotina desativada. Não inferir remoção de um campo apenas porque está fechado.
- `DraftRecovery` guarda a edição anterior somente em memória no componente do registro, permite conferir os dados atuais e recuperar a edição **sem salvar automaticamente**. A próxima gravação usa a revisão atual; nova concorrência continua gerando conflito. Entradas de outro registro/espaço/conta não são reutilizadas.
- `Dialog` usa modalidade nativa, título acessível, foco inicial, ciclo de Tab, Escape e retorno ao gatilho. Com edição pendente oferece continuar ou descartar. Reverter os campos ao estado inicial não exige confirmação. Formulários que permanecem abertos após salvar devem chamar `markFormSaved`; diálogos com revisão persistida informam `savedRevision`. Nenhum rascunho ou fingerprint é gravado em logs, atributos com valores, storage ou analytics.
- Uma coluna é o padrão em formulários. `form-pair` é reservado a pares relacionados quando houver largura. Tokens e fontes oficiais preservados; erros usam as cores claras/escuras já registradas no DESIGN.md. Alvos de toque, foco e rodapés mantêm área útil; redução de movimento preservada.

## Suposições e limites

Portal interno para dois sócios, sem portal de clientes. Datas/valores brasileiros e America/Fortaleza permanecem os contratos existentes. Não foi adicionada consulta de CEP ou outra dependência externa; preenchimento manual continua editável. Áudio, encoder, TURN e sinalização não foram alterados.

Testes de acessibilidade usam constraints e árvore nativa do Chromium (CDP), rótulos/descrições/foco/teclado e contraste calculado dos erros/ações. `axe-core` não estava instalado e não foi adicionada dependência. Não se declara conformidade WCAG completa. Celular é emulação de viewport; ampliação de texto em 200% e reflow são testados, mas teclado físico de iOS/Android e leitores de tela reais permanecem cobertura futura.

Impeccable doctor no projeto canônico: configuração válida; somente recomendação de compactar DESIGN.md, preservado para evitar mudança documental cosmética. Exceções restritas de Inter em `.impeccable/config.json` continuam versionadas, conforme identidade aprovada. O detector apontou três textos herdados de 12px fora da escala: foram ajustados para o degrau de 13px já documentado, sem trocar tipografia. A taste-skill instalada foi avaliada: seu fluxo de landing pages não governa uma ferramenta Operate; a direção é PRODUCT.md/DESIGN.md e Impeccable.

## Executar e reproduzir as evidências

1. `npm ci`, `npm run check`, `npm test`, builds local/shared.
2. Supabase Docker local do projeto `decifaz-hub-e2e`, sem apontar para remoto. O runtime Edge deve montar **esta branch**, não uma worktree anterior. TURN local explicitamente desligado. Um HTTP404 em `hub-screen-ice` exige conferir o mount, não alterar a asserção.
3. `node scripts/local-validation.mjs ux-daily-real.spec.mjs --workers=1` e suíte completa do workflow `Supabase local e navegador`. Asserções de concorrência, permissões e isolamento permanecem ativas.
4. `node scripts/ux-baseline-captures.mjs`: extrai o frontend publicado do #44, serve em porta local separada e gera antes/depois com os mesmos valores fictícios, temas e larguras 1440/390. Não reseta banco nem modifica worktrees existentes. Arquivos em `.validation/ux-daily/{before,after}` e `comparison.json`; CI publica como artefato. Contagem é de controles visíveis no formulário/diálogo; não é pesquisa de usabilidade.
5. Prévia HTTPS isolada usa gateway protegido e Supabase local. URL/SHA/validade e checks na descrição do PR; senha somente em armazenamento privado local/secret do CI. Nunca usar a prévia automática com configuração de banco real para testes de escrita.

Métricas de tarefa verificadas (1440px, tema claro; os controles do fundo não entram na contagem): contrato de 11 para 7 campos inicialmente visíveis; obrigação de 14 para 10; ficha mantém 3 campos essenciais, com detalhes recuperáveis; a seção com erro é aberta automaticamente, removendo a busca manual pela pendência; fechar uma edição alterada acrescenta uma confirmação intencional para evitar perda. Acesso às origens e número de passos das tarefas sem mudança de fluxo são preservados, sem alegar ganho artificial.

## Publicação e recuperação

PR #44 foi publicado primeiro: migrações `20261123010000` → `20261123020000`, com 44 tabelas anteriores preservadas, RPCs/RLS/grants verificados e avisos internos ativos/e-mail desligado. Merge 8af8914, Vercel READY `dpl_3bgZe9kjXkixEV7YN8HAWBzqLbHo`. Escritas de teste ocorreram apenas local/CI.

Esta entrega de UX é somente frontend. Reconferir main/diff/SHA/checks finais, integrar o PR, aguardar Vercel READY e conferir o SHA no domínio principal. Não aplicar migração adicional nem publicar Edge. Smoke público de acesso/inputs e bundle; jornada autenticada é validada com fixtures isoladas no CI, sem simular um integrante real em produção.

Recuperação de UX: restaurar o deployment do #44 acima, preservando as duas migrações financeiras, fotografias, RLS, auditorias, avisos internos e compartilhamento experimental. Não remover vínculos, ativar e-mail ou alterar SMTP. Publicação efetiva, SHAs e evidências finais ficam registrados no corpo do PR.

## Retorno ao CRM durante atualização

O CI da main após o #45 revelou uma corrida herdada: consultar novamente a mesma página removia a tabela e o botão que acabara de receber foco ao voltar da ficha. O teste original foi mantido e ampliado com uma RPC retida enquanto chega uma atualização de outra sessão. Durante atualização do mesmo recorte, as linhas permanecem montadas e a interface informa “Atualizando CRM”. Nova busca, filtro, página ou espaço não reutiliza linhas do recorte anterior; respostas antigas continuam descartadas. Se o registro focado sair do recorte, o foco volta para a busca, sem roubar foco de quem já escolheu outro controle.

O frontend do #44 foi restaurado preventivamente enquanto esta correção é validada. Banco, snapshots, avisos, compartilhamento e e-mail desligado foram preservados. Republicar somente após checks do candidato corrigido e confirmar novamente domínio/SHA; após rollback da Vercel, conferir promoção explícita do novo deployment, pois o auto-assignment pode ficar desabilitado.
