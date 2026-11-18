# Produtividade comercial: prospecção

Central de Prospecção usa os mesmos leads, triagens e atividades do espaço: pesquisa, triagem incompleta, contato planejado e ausência de próxima ação. Cada estabelecimento aparece uma vez, com motivos e filtros por responsável. Dados ausentes são pendências de pesquisa; hipóteses não se tornam diagnóstico. A prioridade definitiva continua dependendo da conclusão válida dos sete critérios.

A ficha separa **abrir canal** de **registrar abordagem**. WhatsApp aceita números brasileiros; site aceita HTTP/HTTPS; Instagram aceita perfil ou URL. Links externos não registram contato, não enviam mensagens automaticamente e não mudam o funil. O resultado da abordagem entra no histórico existente. Planejamento exige responsável e prazo; opcionalmente cria uma atividade vinculada, sem duplicar a entrada sintética da Agenda.

## Consistência e autorização

Migração `20261118010000_prospeccao.sql`, ainda sem autorização de produção. `hub_plan_contact` exige vínculo ativo e edição comercial no servidor. A revisão protege a ficha; conflitos carregam a próxima ação vigente para revisão. Resultado, próxima ação, atividade e recibo de operação são gravados na mesma transação. Repetir o mesmo identificador/payload/ator devolve o mesmo resultado; outro payload é recusado. Não permite alterar preços, confirmar diagnóstico ou marcar Ganho.

## Repositório público

`node scripts/security-review.mjs` examina arquivos rastreados sem imprimir valores. `--history` também examina adições/remoções históricas textuais. A inspeção é por padrões, não uma prova de ausência de todo segredo possível. `.validation`, `.env*`, estados de navegador e configurações locais não devem entrar no Git. Senha da prévia usa entrada efêmera local e GitHub Actions Secret; URL sem credencial usa variable. Artefatos de CI contêm somente capturas explícitas de dados fictícios, nunca traces, cookies, links Auth ou dumps de banco.

## Validação e publicação futura

Testes locais/CI com contas fictícias: repetição concorrente, conflito, isolamento, abertura de canal sem interação implícita e persistência do resultado. Comandos e SHA/checks finais no PR. Após aprovação futura: dry-run exclusivo `20261118010000` → banco/grants/recibos → frontend. Recuperar frontend #26 preservando recibos, histórico, revisão e restrições; não apagar eventos/vínculos. Sem Edge/Auth.
