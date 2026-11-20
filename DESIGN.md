---
name: Decifaz Hub
description: Mesa de trabalho interna, clara e prática para a rotina dos sócios.
colors:
  decifaz-blue: "#3a4a6f"
  decifaz-orange: "#ff6a13"
  decifaz-ink: "#1f2433"
  decifaz-slate: "#8f9ab3"
  decifaz-gray: "#d9d9d9"
  canvas: "#f5f6fa"
  paper: "#ffffff"
  soft: "#f1f3f8"
  muted: "#505e79"
  dark-canvas: "#171b27"
  dark-paper: "#242b3d"
  dark-soft: "#30394f"
  dark-ink: "#f2f4fa"
  dark-muted: "#b2bcd1"
  dark-line: "#46506a"
  dark-accent: "#bcc9e6"
  navigation-label: "#bdc8df"
  alert-border: "#bd5238"
  warning-paper: "#f8efd9"
  warning-ink: "#80561f"
  error-paper: "#f8eae5"
  error-ink: "#974f3d"
  info-paper: "#e7eef9"
  dark-error-paper: "#56382f"
  dark-error-ink: "#ffd0c2"
  dark-warning-paper: "#51452d"
  dark-warning-ink: "#ffe1a3"
  dark-info-paper: "#364564"
  dark-info-ink: "#e3ecff"
typography:
  headline:
    fontFamily: "Poppins, Inter, sans-serif"
    fontSize: "clamp(1.5rem, 2.2vw, 1.9rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Poppins, Inter, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9375rem"
    lineHeight: 1.55
  label:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.875rem"
    lineHeight: 1.4
  metadata:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "0.8125rem"
    lineHeight: 1.5
  count:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  metric:
    fontFamily: "Inter, Segoe UI, system-ui, sans-serif"
    fontSize: "1.4rem"
    lineHeight: 1.2
rounded:
  control: "8px"
  surface: "12px"
  dialog: "15px"
spacing:
  tight: "8px"
  group: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.decifaz-orange}"
    textColor: "{colors.decifaz-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.decifaz-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.decifaz-ink}"
    rounded: "{rounded.control}"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.surface}"
    padding: "18px"
---

# Design System: Decifaz Hub

## Overview

**Creative North Star: "Mesa de trabalho clara e prática"**

O Hub é uma ferramenta interna para concluir trabalho. A direção confirmada pelos sócios é direta, sóbria e acolhedora: prioridades, vencimentos e próximas ações aparecem primeiro; o restante permanece acessível sem competir com a tarefa atual. A identidade oficial é preservada, com azul na estrutura e navegação, laranja nas ações principais e superfícies neutras para leitura.

Este documento registra o sistema do modo compartilhado e suas correções nesta branch. Não transforma todo estilo legado da demonstração em recomendação. Fontes, cores, formatos e componentes são extraídos da implementação; as decisões qualitativas foram confirmadas com o usuário.

**Key Characteristics:**
- Ordem de leitura acompanha a rotina e o prazo, antes das métricas secundárias.
- Ação principal evidente; detalhes organizados em abas e accordions quando ajudam.
- Boa legibilidade no computador e celular, em ambos os temas.
- Orientação curta para tarefas pouco frequentes, sem tutoriais obrigatórios.

## Colors

### Primary

**Laranja Decifaz** identifica a ação principal. O texto do botão usa Tinta Decifaz; laranja não substitui cor de texto corrido nem é garantia de contraste sobre branco. **Azul Decifaz** estrutura navegação e identidade. Preservar os tons exatos do frontmatter e dos assets oficiais.

### Neutral

Canvas, Papel e Superfície Suave separam fundo, conteúdo e apoio; Texto Secundário e Linha organizam informações sem criar um arco-íris de estados. O tema escuro usa seus pares explícitos, definidos em `:root[data-theme=dark]`; não inverter cores automaticamente.

**The Readable State Rule.** Foco, seleção, erro e atraso têm sinais além da cor. O foco usa o token `--accent`, que varia com o tema. Estados financeiros e de acesso mantêm rótulos textuais. Verificar contraste nos estilos computados; não interpretar a ausência de avisos do scanner como certificação.

## Typography

Poppins Bold marca os títulos. Inter sustenta controles, leitura, tabelas e números. Os arquivos e licenças estão em `public/identidade/`, com carregamento local e `font-display: swap`. Os pesos disponíveis são Inter 400/600/700 e Poppins 700; não adicionar famílias para resolver uma questão de hierarquia.

Headline, title, body, label e metadata representam os papéis recorrentes. Dados tabulares usam numerais de largura estável. Textos de orientação mantêm medida de até 70 caracteres; títulos equilibram as linhas sem quebras manuais frágeis. No celular, campos de entrada usam 1rem para legibilidade e para evitar zoom de foco em navegadores móveis.

**The Useful Hierarchy Rule.** A ação e o prazo são reconhecíveis antes da leitura completa. Não adicionar eyebrows, slogans ou títulos que apenas repetem a frase seguinte.

## Layout

O portal mantém navegação lateral no desktop, cabeçalho com contexto/ações globais e conteúdo com largura limitada. A grade principal usa `minmax(0, 1fr)` para permitir quebra real. No Dashboard, fila e alertas formam o primeiro bloco de trabalho; indicadores, funil e receitas são detalhes secundários. A DOM acompanha a ordem visual e de teclado.

O ritmo usa tight para itens relacionados, group para conjuntos de campos e section entre tarefas. Separar seções com espaço, títulos e bordas discretas. Não resolver toda separação criando cards aninhados.

As regras herdadas usam pontos de adaptação em 1120, 1000, 890, 700, 630, 600 e 360px; eles não são uma escala a reproduzir indiscriminadamente. Em 890px a navegação vira drawer; em 700px as adaptações de trabalho priorizam controles e uma coluna. Cabeçalho com seletor de espaço pode ocupar duas linhas, preservando menu, busca, tema e saída. Filtros quebram em grade; barras de abas têm rolagem própria, não overflow da página.

## Elevation & Depth

Superfícies de trabalho usam borda discreta e separação tonal, com sombra removida dos cards. Diálogos preservam elevação e backdrop para foco protegido. A sombra de diálogo vigente é registrada no sidecar; ela não deve migrar para todo recipiente.

**The Quiet Surface Rule.** Relevo comunica sobreposição. Seções normais se diferenciam por posição, título, espaço e borda, conforme a direção confirmada pelos sócios.

## Shapes

Controles têm curvas curtas; superfícies e diálogos são um pouco mais arredondados. Cápsulas ficam restritas a pequenos estados/contagens. Evitar barras de cor em um lado de caixas arredondadas: atraso e desativação usam borda completa, fundo e rótulo. Não desenhar novas formas para simular semântica que o texto não explica.

## Components

### Buttons

O botão primário usa Laranja Decifaz e Tinta Decifaz. O secundário acompanha Papel, Texto e Linha do tema. Hover altera fundo ou luminosidade; foco permanece visível com contorno contrastante. Altura confortável de 44px nas ações comuns; alvos compactos existentes exigem avaliação do espaço clicável real, não só do ícone. Carregamento e bloqueio têm estado explícito, sem permitir repetição de gravações críticas.

### Inputs / Fields

Rótulo persistente acima do campo, orientação curta no contexto e asterisco em campos obrigatórios. `Field` é o padrão existente para entrada simples. Selects com identificadores conservam valores reais e usam rótulos autorizados. Não colocar um placeholder no lugar do label. Validação abre a seção necessária e move o foco para a primeira pendência, preservando o rascunho.

### Navigation

Grupos por área mantêm os destinos conhecidos. Os grupos podem ser recolhidos por controles nativos de disclosure; a busca de área revela os resultados autorizados. Estado ativo tem texto/ícone e borda; a autorização é conferida antes de renderizar destinos restritos. O drawer móvel conserva Escape, foco e contexto, sem usar ocultação de UI como regra de segurança.

### Cards / Containers

Card é uma unidade de conteúdo, não uma maneira de dar margem a todo bloco. Fila, alertas e listas usam recipientes claros; detalhes internos usam títulos, listas ou divisores. Não aninhar cards para cada nível de formulário.

### Chips / Tags

`Tag` identifica situação, prazo e prioridade. Rótulos distinguem score parcial e prioridade concluída; previsto, pago e vencido são estados diferentes. Cor nunca é o único sinal. Tags não substituem botões de ação.

### Disclosure

`Disclosure` usa `details/summary`, título e descrição opcional, com contagem quando relevante. Mantém o conteúdo disponível e abre em caso de campo inválido. Não recolher situação, responsável, prazo ou a tarefa que a pessoa acabou de iniciar. Ferramentas opcionais de apresentação ficam separadas da ata da reunião interna.

### Record Tabs / Summary

`RecordTabs` mantém painéis montados, usa tablist/tab/tabpanel e oferece setas, Home/End. `RecordSummary` conserva situação, responsável e prazo enquanto a pessoa alterna de tarefa. Abas não devem simular uma permissão: dados continuam sujeitos ao servidor.

### Dialogs / Feedback

Diálogo é apropriado para edição com foco protegido e confirmação; não é a resposta padrão para cada detalhe. `Dialog` usa o elemento nativo, nome acessível, Escape e retorno do foco. Mensagens informam o que falhou e a ação possível. Confirmações de aceite, baixa e alteração de papéis preservam suas consequências e auditoria.

## Do's and Don'ts

### Do:
- **Do** preservar tons, fontes e assets oficiais da Decifaz.
- **Do** destacar a tarefa principal, o responsável, o prazo e a origem.
- **Do** organizar detalhes secundários sem esconder informação necessária para decidir.
- **Do** verificar os dois temas, foco, teclado, celular e conteúdo longo no resultado renderizado.
- **Do** usar exemplos e documentos fictícios na homologação.

### Don't:
- **Don't** trocar a identidade por uma tendência sugerida pelo detector.
- **Don't** usar cards aninhados, eyebrows ou barras laterais decorativas para construir hierarquia.
- **Don't** tratar reunião interna como portal ou acesso de clientes.
- **Don't** misturar captura local com transmissão a participantes.
- **Don't** remover restrições financeiras, confirmações ou trilhas para simplificar uma tela.
