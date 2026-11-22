# Diagnóstico do Impeccable — 22/11/2026

`impeccable doctor` foi executado na revisão dos PRs #40/#42/#43. Resultado: somente `design-md-sprawl`; nenhuma falha de instalação ou hook foi reportada pelo comando.

O aviso significa que `DESIGN.md` tem11.655 bytes e o contexto usa um mapa, recorrendo ao documento completo para detalhes. `impeccable design-compact` foi executado **sem `--write`**: prévia de4.221 bytes, economia indicada de7.434 bytes. É uma otimização opcional de contexto, não um defeito de frontend. O documento não foi compactado nem movido; nenhuma decisão de tipografia, cor ou uso foi removida. A gravação da compactação depende de aprovação específica, conforme o próprio comando.

As exceções aprovadas estão em `.impeccable/config.json`: somente `overused-font=Inter`, restritas separadamente a `src/style.css` e `src/shared-workspace.css`. A evidência é `DESIGN.md:128`, que especifica Inter para controles/leitura/tabelas/números e Poppins para títulos. O registro identifica a decisão do agente baseada no sistema documentado, sem alegar confirmação de fonte que não tenha ocorrido.

Não há `ignore-rule`, `ignore-file` ou supressão geral de tipografia. Inter e os assets locais foram preservados. Alertas de tamanho de fonte preexistentes não foram usados como motivo para ampliar esta entrega ou alterar a identidade.
