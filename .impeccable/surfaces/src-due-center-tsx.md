---
version: 1
slug: "src-due-center-tsx"
primary_target: "src/due-center.tsx"
related_targets: ["src/pilot-app.tsx","src/workbench.css"]
---

# Central de vencimentos

Mode: Operate. Extensão do portal interno existente, não uma nova identidade.

## Direction contract

THESIS: abrir a lista que exige ação, reconhecer prazo, responsável e origem, e concluir no registro existente. Filtros secundários não devem empurrar o trabalho para fora da primeira tela.

OWN-WORLD: preservar azul e laranja oficiais, Poppins/Inter, superfícies neutras, bordas discretas e foco visível definidos no DESIGN.md. Reutilizar Page, RecordTabs, Disclosure, Dialog e record-table responsiva.

STORY: escolher período, refinar responsável ou vínculo, abrir origem, registrar baixa manual ou reagendar com motivo; ler aviso é ação distinta de resolver a origem.

FIRST VIEWPORT: título e atualização, abas Vencimentos/Meus avisos/Preferências, períodos com contagens, filtros expansíveis e primeiras linhas com prazo e ação. No celular, linhas mantêm rótulos e ações essenciais.

FORM: seed: none (pinned). O usuário especificou "Priorize o que exige ação e mantenha detalhes secundários progressivos", seguindo PRODUCT.md e DESIGN.md. Padrões de preferências confirmados: 30/7/1/0 e resumo 9h, e-mail desligado.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
