# Decifaz Hub

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Portal exclusivamente interno para os dois sócios da Decifaz e integrantes autorizados de seus espaços de trabalho. Uso em computador e celular, para executar e acompanhar o trabalho comercial, operacional e administrativo.

Clientes não usam o portal. As reuniões atendem aos integrantes internos. Não planejar acesso, onboarding ou navegação de clientes como se fossem requisitos aprovados. Rótulos legados de apresentação ao cliente não mudam essa definição de público.

## Product Purpose

Dar aos sócios uma rotina compartilhada utilizável: saber o que precisa ser feito, quem é responsável, quando vence e qual registro sustenta cada decisão. Conectar prospecção, proposta, projeto, contrato, reunião e financeiro interno sem perder contexto, histórico ou permissões.

Sucesso significa conseguir concluir as tarefas e retomar o trabalho com segurança, com informações persistidas e visíveis aos integrantes autorizados, inclusive em outra sessão.

## Positioning

Ferramenta de trabalho da própria Decifaz, organizada em torno de seus estabelecimentos, serviços, propostas versionadas, projetos, contratos e obrigações. A continuidade entre registros e sua rastreabilidade orientam o produto; não é um portal de clientes nem um site de divulgação.

## Operating Context

- Dashboard e Agenda orientam as ações do dia, atrasos, compromissos e vencimentos, com acesso ao registro de origem.
- Comercial: cadastro ou importação CSV, pesquisa, triagem com evidências, abordagem, próxima ação, reunião, diagnóstico e proposta versionada. Abrir um canal não confirma que houve contato.
- Aceite comercial administrativo e confirmação explícita de Ganho precedem a abertura do projeto. Proposta, contrato e projeto têm situações distintas.
- Contratos existentes ou derivados de proposta mantêm responsável, vigência, renovação, aviso prévio e documento assinado anexado em armazenamento privado.
- Reuniões internas podem estar vinculadas a estabelecimento, projeto ou contrato e gerar pauta, ata, decisões e atividades de acompanhamento.
- Obrigações da Decifaz incluem domínio anual, hospedagem, e-mail, ferramentas e assinaturas, com responsável, competências e baixa manual após pagamento externo.
- Indicadores, CSV e fechamento semanal ajudam a revisar o recorte autorizado e registrar decisões e ações.
- Datas de negócio usam America/Fortaleza. Interface e terminologia são em português do Brasil.

## Capabilities and Constraints

- Implementação existente em React, TypeScript e Vite, hospedada na Vercel. O modo compartilhado usa Supabase Auth, PostgreSQL, RLS, views, RPCs, Edge Functions e armazenamento privado. A demo local é referência e ambiente fictício, não fonte dos dados compartilhados.
- Associação ativa, espaço e papéis cumulativos de Administração, Comercial, Operação e Financeiro determinam o acesso no servidor. Desativação deve valer mesmo com sessão já aberta. Nomes de responsáveis não concedem autorização.
- Preservar restrições de valores, condições comerciais e documentos privados. Não devolver dados protegidos por consultas, buscas, contagens ou CSV a quem não tem acesso.
- Preservar versões e snapshots de propostas, aceite administrativo, confirmação de Ganho, revisões concorrentes e proteção do último administrador ativo.
- Ficha dedicada, filtros, página, posição e foco ajudam a retomar a lista. Rascunhos de sessão não equivalem a gravação persistida nem devem atravessar espaços ou mudanças de autorização.
- Importação trata possíveis duplicidades e retomada; atividades podem ser concluídas com próximo acompanhamento na mesma transação. Repetição e concorrência não podem duplicar concessões, ocorrências ou ações.
- Contratos, projetos, reuniões, obrigações, pagamentos e outros fluxos cobertos registram mudanças no servidor com ator e data. A cobertura não reconstrói eventos anteriores nem inclui toda leitura, download ou ação em serviço externo.
- Ocorrências financeiras são geradas na consulta ao financeiro, até o horizonte documentado de 366 dias. Preservar competências pagas e vencidas, âncora de fim de mês, periodicidade anual e separação entre previsto, pago e vencido.
- Avisos atuais são internos ao abrir ou atualizar o portal. Não prometer notificações externas enquanto ele estiver fechado, pagamento automático ou cancelamento junto ao fornecedor.
- Link de chamada externa e captura local são recursos distintos. Captura local não comprova transmissão entre participantes. Videoconferência nativa permanece planejada; serviço pago ou nova contratação exige aprovação.
- PDF assinado é documento anexado, sem assinatura eletrônica ou verificação criptográfica implementada.
- Homologação usa contas, e-mails, documentos e dados fictícios em ambiente isolado. Preservar dados e vínculos reais. Credenciais, links de acesso e identificadores pessoais não pertencem ao repositório ou aos logs.

## Brand Commitments

Nome Decifaz Hub e identidade oficial da Decifaz, com assets locais em `public/identidade/`. Texto operacional claro em português, sem slogans repetidos que disputem espaço com o trabalho. Não inventar clientes, depoimentos, resultados ou capacidades de integrações.

## Evidence on Hand

- `README.md` e `docs/rotina-socios.md`: finalidade, rotina inicial e limitações publicadas.
- `docs/papeis-e-permissoes.md` e documentação de Equipe: autorização, papéis cumulativos e administração de vínculos.
- `docs/prospeccao.md`, `docs/importacao-csv.md`, `docs/atividades-acompanhamentos.md`, `docs/fichas-e-propostas.md` e `docs/busca-global.md`: rotina comercial, edição e busca.
- `docs/contratos-rastreabilidade.md`, `docs/obrigacoes-decifaz.md` e `docs/reunioes-projetos.md`: prioridades administrativas e seus limites.
- `src/main.tsx`: demonstração; `src/pilot-app.tsx`: portal compartilhado. Código, documentação e testes devem ser comparados antes de presumir paridade entre eles.
- `e2e/`, `homologacao/`, `tests/` e scripts de ensaio: evidências automatizadas com dados fictícios. Capturas versionadas em `docs/experiencia/capturas/` são evidência histórica; conferir sua correspondência com a implementação atual.
- GPT Sites foi referência histórica solicitada pelo usuário. Paridade visual ou funcional não pode ser declarada sem acesso e comparação verificáveis com a versão original.

## Product Principles

1. Priorizar a rotina real dos dois sócios: próxima ação, responsável, prazo e origem da informação.
2. Concluir tarefas com clareza e preservar o contexto ao navegar, inclusive no celular.
3. Autorizar no servidor antes de mostrar ou alterar dados; a interface não substitui as permissões.
4. Preservar histórico, versões e consistência diante de falha, repetição e concorrência.
5. Mostrar o estado real de cada recurso e distinguir capacidade implementada, limitação e integração futura.

## Accessibility & Inclusion

Permitir uso por teclado, foco visível, rótulos acessíveis, temas claro e escuro e leitura no celular sem rolagem horizontal indevida. Erros de formulário devem revelar a seção pertinente e levar o foco ao campo inválido. Carregamento, ausência de resultados, falha recuperável e conclusão de salvamento precisam de feedback compreensível.
