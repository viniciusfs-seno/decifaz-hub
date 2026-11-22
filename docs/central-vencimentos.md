# Central de vencimentos e preferências

Entrega em homologação, sem merge, migração remota, e-mail real ou publicação. Base: main publicada `100dc1a` (#41). O #40 permanece em rascunho no head `5200291`: sinalização passou, conectividade ICE não recebeu mídia no head final; TURN não contratado. A Central não depende dele nem de sua migração/Edge.

## Rotina dos sócios

Visão Geral → Central de vencimentos. Escolha Vencidos, Hoje, Próximos 7 dias ou Próximos 30 dias. Os intervalos futuros começam hoje; vencidos têm recorte próprio. Contagens usam todo o resultado autorizado, antes da paginação de cinquenta linhas, com ordenação por data e chave estável. Filtros de responsável, categoria, projeto e contrato ficam em um detalhe expansível. O filtro e a página são conservados por integrante/espaço ao voltar da origem.

A Central consulta contratos, avisos de renovação/cancelamento, ocorrências de obrigações e assinaturas, despesas avulsas e previsões de receita já existentes. Não cria outro cadastro. Receitas realizadas descontam recebimentos estornados; previsto e realizado têm colunas distintas. Datas contratuais não possuem valor financeiro nesta projeção.

Abrir / registrar pagamento abre a ocorrência original, com data, valor, evidência e confirmação de pagamento externo. Reagendar exige motivo, confirmação e revisão; altera somente a data da ocorrência prevista, sem mudar competência, data-base, periodicidade ou contrato. Conflito mostra a ocorrência vigente para revisão. Datas contratuais só mudam na ficha administrativa original.

## Preferências e avisos

Na aba Preferências, cada integrante configura somente a própria conta no espaço atual. Padrões **confirmados pelo usuário**: 30, 7, 1 e 0 dias; resumo às 9h de America/Fortaleza; e-mail desativado. Pode acompanhar todo o recorte autorizado ou somente registros cujo responsável esteja vinculado à sua conta. Responsável antigo em texto não é associado por semelhança de nome.

Meus avisos separa Não lido/Lido de Pendente/Resolvido na origem. Marcar leitura não paga nem cancela registros. Pagamento, cancelamento, pausa ou mudança do prazo tornam o aviso anterior resolvido; a situação é reavaliada no servidor. Leitura mantém seu horário próprio. Planos pausados/cancelados não devem gerar novos lembretes, sem apagar parcelas e pagamentos anteriores.

O primeiro PR fornece Central, preferências, consultas e reagendamento. A geração e a caixa de saída ficam no PR dependente: ver `docs/avisos-agendados.md` quando disponível. Nenhuma preferência individual ativa o envio global de produção.

## Autorização

- Integrantes ativos consultam os dados de contratos já autorizados no módulo Comercial.
- Somente Administração/Financeiro recebem nomes, categorias, valores, contagens ou avisos de obrigações, despesas e receitas. O filtro ocorre antes de agregação/paginação.
- Preferências e leitura de avisos são pessoais por espaço; tabelas não aceitam DML direto do app. Funções privadas não são executáveis pelo app. Sessão antiga de integrante desativado não mantém acesso.
- Reagendamento e baixa exigem autorização financeira no banco. Histórico reaproveita a auditoria financeira existente, acrescentando motivo do reagendamento. Conta Auth, papéis, vínculos e documentos privados são preservados.

## Migração, validação e recuperação

`20261122010000_central_vencimentos.sql`, sobre o esquema publicado até 20261121010000. Sem migração de transmissão. Expansão aditiva: projeção RPC, preferências, avisos e comandos autorizados; nenhum job ou envio é ativado.

Comandos: `npm run check`, `npm test`, build demo/compartilhado e `node scripts/local-validation.mjs due-center-real.spec.mjs --workers=1`. CI inclui regressões anteriores e capturas. Testes novos cobrem duas sessões, sessenta e uma ocorrências entre páginas, valores negados, isolamento, desativação, leitura sem baixa, pagamento, revisão de preferências, reagendamento concorrente, retorno com filtro, teclado, celular/escuro e vazio.

Ordem futura, após autorização: revalidar base/SHA/checks → dry-run somente desta expansão → aplicar/verificar grants/RLS/RPCs sem alterar registros reais → frontend. Recuperar frontend #41 preservando a expansão, eventos e restrições. Não remover dados para reverter a interface. Esta rodada não executa nenhuma dessas fases remotamente.

A exceção do detector para Inter em `src/shared-workspace.css` está versionada, restrita ao valor e arquivo, com fundamento no DESIGN.md. Não amplia supressões de regras ou arquivos.
