# Cadastro e jornada comercial — 14 melhorias

Base publicada reconferida: main `935d42a78786da9f51248d4b5d195626023fefc6`, PRs #44 → #45 → #46 integrados e Vercel READY. Esta pilha é somente homologação: não aplicar migrações, integrar PRs ou publicar suas funcionalidades em produção. E-mail permanece desligado.

## Frentes e consumidores

1. **Cadastro e classificações**: `20261125010000_cadastro_classificacoes.sql`, ficha, manutenção no Catálogo de soluções (Administração), importação, busca e CSV. IDs são por espaço/grupo, independentes do rótulo; não há exclusão de opções pelo app. Grupos iniciais revisáveis: Alimentação, Turismo, Beleza e Estética, Saúde e Bem-estar, Varejo, Educação, Serviços Profissionais e Outros; seis subcategorias ilustram a hierarquia de um nível. Origens e próximas ações seguem o documento recebido. São classificações, não produtos.
2. **Presença digital e triagem**: depende da primeira frente. Separa pesquisa e qualidade; preserva textos anteriores, desconhecidos e pontuação existente.
3. **Interações e acompanhamento**: depende das anteriores. Reaproveita registros, atividades, reuniões, recibos de comando, revisão e mecanismos de aceite/Ganho.

| Consumidor | Contrato de compatibilidade |
| --- | --- |
| Ficha/triagem | Texto legado permanece até seleção explícita; nenhum vínculo por semelhança de nome |
| Filtros/busca CRM | Mesmo `crm_filter` alimenta página, total e exportação; pesquisa inclui endereço, origem e rótulo atual do segmento selecionado |
| CSV | Colunas antigas continuam aceitas; `Nome` é alias de `Nome da empresa`; IDs opcionais são validados no espaço, sem converter textos automaticamente |
| Exportação | Recorte completo, com rótulos/snapshots e IDs de segmento, origem, responsável, município e endereço; sem valores financeiros |
| Diretório | Somente associação explícita por ID; nova atribuição exige vínculo ativo; vínculo antigo desativado pode ser conservado |
| Histórico/indicadores | Textos anteriores ficam nos snapshots/auditoria; renomear catálogo não reescreve eventos passados nem inventa autoria |
| Catálogo de soluções | Sem renomear produtos como “Cardápio digital”; ferramentas do estabelecimento são outra informação |

## Cadastro, localização e contato

Nome é o único requisito para iniciar. Segmento pesquisável usa select nativo com categorias/subcategorias. Detalhes continuam montados e recolhíveis, com validação/erros/foco/recuperação do UX publicado. Necessidades expande sem trocar o textarea ou perder sua edição.

Responsável é escolhido do diretório do espaço por identificador. Textos legados ficam identificados; não há tentativa de relacionar pessoas por nome. Arquivar uma categoria impede novas atribuições e permite editar registros que já a referenciam. Administração renomeia/arquiva no bloco “Classificações comerciais” do Catálogo, com revisão e auditoria; não foi criada uma nova central administrativa.

CEP, UF, município, bairro, logradouro, número, complemento e link opcional têm campos próprios. Região/endereço antigo são preservados como legado. O snapshot de **5.571 municípios do IBGE** fica em `public/referencias`, com URL, data e SHA-256; servidor valida código/UF/nome. `scripts/snapshot-municipalities.mjs` atualiza a fonte para revisão explícita, sem alterar migrações antigas automaticamente.

ViaCEP é auxiliar e opcional. Recebe somente oito dígitos do CEP, após gesto explícito; timeout de seis segundos, retorno “não encontrado”, falha e CEP genérico não impedem entrada manual. Campos preenchidos/editados durante a consulta não são sobrescritos. Mudança de CEP ou desmontagem invalida a resposta. Nenhuma informação comercial é enviada. A entrada manual de município é identificada; legado não é convertido ao abrir a ficha.

Telefone mantém a entrada original enquanto mostra a formatação brasileira reconhecida. Não assume DDD. Internacional exige código de país explícito; texto desconhecido pode permanecer como legado. Normalização de servidor é separada do texto original. As URLs dos canais continuam ações distintas de registrar contato realizado.

## Verificação cadastral

- **Não avaliado**: sem conferência registrada.
- **Pendente**: aguarda informação; registrar o contexto.
- **Parcial**: um ou dois critérios conferidos.
- **Conferido**: identidade/segmento, localização e ao menos um canal conferidos, com evidência.

O servidor registra ator e horário de alterações de verificação. Esses estados não significam interesse ou qualificação. Valores antigos (“Não informado”, “Não verificado”, “Parcialmente verificado”, “Verificado”) permanecem legados até regularização explícita; nenhum é promovido na migração.

## Validação e recuperação

`npm run check`, `npm test`, builds local/shared e `node scripts/local-validation.mjs commercial-registration-real.spec.mjs --workers=1`. Testes usam somente fixtures locais: arquivo/renomeação, vínculos desativados, associação negada, verificação inválida/válida, API/RLS, CSV, consulta de CEP com resposta retida/falha, edição durante consulta, telefone internacional e 1440/390px nos dois temas. A primeira execução do teste de CEP revelou uma closure antiga sobrescrevendo a edição; a resposta agora usa o callback do rascunho atual e contadores de edição. Não foi enfraquecida a asserção.

Ordem futura: migração de cadastro → frontend compatível, depois migração/frontend de presença, depois interação/acompanhamento. Revalidar o SHA e o diff de cada base antes de integrar. A expansão adiciona referências e validações opcionais sem converter registros antigos; funções antigas continuam aceitando textos legados. Recuperar mantendo expansão e dados: frontend anterior continua lendo textos; edição de classificações novas deve usar o frontend atualizado. Não remover referências, auditorias, arquivos privados, permissões ou snapshots financeiros. Roteiro integrado e matriz final por item serão completados na frente de jornada.

Fontes: [IBGE Localidades](https://servicodados.ibge.gov.br/api/docs/localidades), [endpoint usado no snapshot](https://servicodados.ibge.gov.br/api/v1/localidades/municipios), [ViaCEP](https://viacep.com.br/). A consulta é gratuita segundo o ViaCEP, que pode bloquear uso massivo; não há consulta em lote ou validação de base externa.
## Presença digital e triagem — segunda frente

A migração `20261125020000_presenca_triagem.sql` adiciona validação e auditoria transacional da triagem, sem converter as avaliações antigas. Presença (`não verificado`, `não encontrado na pesquisa`, `identificado`) e qualidade (`não avaliado`, `bom`, `regular`, `ruim`) são decisões distintas. Qualidade é enviada apenas quando o recurso está identificado. Alternar a presença preserva a seleção no rascunho; retirar um recurso adicional preserva a edição até fechar o formulário e o exclui do payload.

Site, Instagram, WhatsApp Business e Catálogo digital são recursos iniciais; agendamento, e-commerce, pedidos, reservas, CRM, automação de WhatsApp e outras soluções são opcionais. “Catálogo digital” muda somente o rótulo da avaliação, sem renomear soluções vendidas pela Decifaz. Textos anteriores ficam consultáveis como legados. URLs/evidências, origem (observação, relato ou hipótese) e contexto justificam a avaliação; hipótese não confirma qualidade. Nada atribui pontos automaticamente. A classificação definitiva continua exigindo triagem concluída e seus sete critérios de 0–15.

`hub_save_commercial_triage` bloqueia o lead e verifica a revisão antes de chamar o contrato legado, preservado para o frontend anterior. Um conflito carrega os dados atuais e oferece recuperação explícita do rascunho. `hub_triage_audit` registra autor, data e antes/depois na mesma transação, apenas para leitores comerciais do próprio espaço. Não reconstrói decisões anteriores à migração.

Validação local: `node scripts/local-validation.mjs digital-triage-real.spec.mjs productivity-real.spec.mjs --workers=1` passou (3 cenários). Inclui concorrência, combinação inválida, isolamento, falha de auditoria com reversão, rascunho de qualidade, submissão inválida com foco, ausência de pontuação automática e captura móvel escura. Tipagem passou. Captura: artefato `rotina-integrada-capturas`, pasta `digital-triage`.

Publicação futura: primeira frente → migração de presença → frontend desta frente; nenhuma alteração de Edge. Recuperação usa frontend anterior, conservando tabela de auditoria, validações e referências; não remover colunas nem restaurar dados antigos sobre novos. Produção não foi alterada nesta entrega.

## Interações e acompanhamento — terceira frente

As cinco fases conceituais (pesquisa/cadastro, triagem, abordagem/sondagem, reunião/proposta, decisão/acompanhamento) orientam a ficha existente. Não criam novas telas ou substituem etapas do funil. “Registrar interação” reúne tipo, data efetiva, resumo e resultado. WhatsApp/site/Instagram continuam aberturas explícitas de canais, sem envio ou registro de contato implícito.

| Resultado | Regra do servidor | Encaminhamento |
| --- | --- | --- |
| Somente registrar | Preserva a etapa | Acompanhamento opcional |
| Aguardando resposta | Mantém oportunidade ativa; não reabre encerrados | Acompanhamento opcional |
| Retomar futuramente | Exige motivo e data; mantém etapa ativa | Exige ação por ID, responsável ativo e prazo igual à retomada |
| Abordagem realizada/avançar | Avança fases iniciais até Abordado; não regride fases posteriores | Acompanhamento opcional |
| Sem aderência/perdido | Exige motivo e preserva os registros anteriores | Marca Perdido e cancela apenas a tarefa pendente gerida por esse plano |
| Ganho confirmado | Exige Administração, proposta aceita e confirmação explícita | Marca Ganho; não cria contrato/projeto; preserva os fluxos existentes de aceite e abertura |

Reunião deve ser referenciada pelo ID, pertencer ao estabelecimento/espaço, estar realizada e ter a revisão atual. O resultado fica na coluna protegida `hub_meetings.commercial_result`, com autor e horário; não se cria outra reunião ou interação para representar a mesma conversa. Alterar a ata pelo contrato anterior não apaga esse resultado. O evento da reunião continua na auditoria existente. Demais interações usam `hub_interactions`, agora com tipo, data efetiva e resultado; registros antigos continuam com seu texto/data de registro, sem inventar data efetiva.

`hub_record_commercial_interaction` grava resultado, etapa, acompanhamento e recibo de idempotência na mesma transação. O identificador está vinculado ao ator, espaço, conteúdo e revisão; repetições retornam o mesmo resultado. Outra revisão exige revisão explícita pelo usuário. Falha de auditoria reverte tudo. `hub_save_commercial_lead` e o novo contrato de triagem reutilizam o mesmo acompanhamento para a próxima ação estruturada datada. Ações sem prazo continuam rascunhos na ficha. Não se cria um cadastro paralelo de tarefas.

O plano gerido reaproveita sua atividade pendente; alteração de prazo/responsável modifica essa atividade com auditoria. Conclusões permanecem históricas. Um acompanhamento já criado pelo comando antigo de conclusão é reaproveitado quando há um único candidato exato (estabelecimento, título, prazo e ID do responsável), sem associação por nome. Tarefas de reunião já concluídas permanecem intactas; um acompanhamento posterior é outra atividade, sem violar a referência única do acompanhamento original. Um bloqueio concorrente de atividade pode recusar a gravação de modo recuperável; nenhuma parte é persistida. O usuário conserva a edição e pode tentar novamente. Os comandos legados permanecem disponíveis para compatibilidade, sem criar os novos metadados estruturados.

CRM permite filtrar pelo identificador do integrante e mantém os textos antigos como opções legadas. Página, total e CSV usam o mesmo filtro autorizado. Central, Dashboard e Agenda continuam consultando as mesmas atividades e suprimem a representação sintética da próxima ação quando já existe a atividade correspondente. A revisão financeira, documentos privados, avisos e transmissão experimental não tiveram seus contratos alterados; e-mail continua desligado.

## Matriz das 14 melhorias

| Item | Situação | Tela/PR | Decisão e legado | Evidência automatizada |
| --- | --- | --- | --- | --- |
| 01 Nome da empresa | Implementado | Ficha, #47 | Rótulo; mantém `name` e alias Nome no CSV | cadastro UI e importação |
| 02 Segmentos | Implementado | Ficha/triagem e Catálogo, #47/#48 | IDs por espaço, busca, categorias iniciais revisáveis; arquivar não apaga referências | classificação API/arquivo/renomeação |
| 03 Município/UF | Implementado | Localização, #47 | IBGE 5.571; manual identificado e legado sem inferência | cadastro API/UI e snapshot versionado |
| 04 Endereço | Implementado | Localização, #47 | Campos separados; endereço antigo conservado; CEP opcional | CEP retido/falha, edição durante consulta |
| 05 Telefone | Implementado | Contatos, #47 | DDD informado; BR, internacional ou original explícitos | teste unitário e persistência UI |
| 06 Origem | Implementado | Contexto comercial, #47 | Nove opções por ID; Outros exige detalhe; texto antigo não convertido | cadastro API e edição UI |
| 07 Verificação | Implementado | Contexto comercial, #47 | Critérios objetivos, autor/data; não qualifica nem pontua | validação permitida/negada e etapa intacta |
| 08 Necessidades | Implementado | Contexto comercial, #47 | Mesmo textarea, altura adequada e expansão | captura móvel e preservação de edição |
| 09 Responsável | Implementado | Ficha/triagem/interação, #47/#49 | ID ativo; nome legado e vínculo desativado conservados | associação negada/preservação, duas sessões |
| 10 Próxima ação | Implementado | Ficha/interação, #47/#49 | Tipo estável, detalhes, prazo e atividade compartilhada | reenvio único, Agenda em outra sessão |
| 11 Presença/qualidade | Implementado | Triagem, #48 | Dois eixos, fontes/contexto; rascunho preservado, payload aplicável | combinações API, foco/rascunho UI, rollback auditoria |
| 12 Ferramentas | Implementado | Triagem, #48 | Seleção múltipla; outras exige descrição; não são produtos | UI recursos múltiplos e payload |
| 13 Catálogo digital | Implementado | Triagem, #48 | Subtipo opcional; produtos e rótulos antigos preservados | unidade e persistência de subtipo |
| 14 Jornada/interação | Implementado | Ficha/Central/Agenda, #49 | Fases orientativas e matriz acima; reunião por referência | jornada CSV até triagem/contato/follow-up; aceite/projeto; concorrência/RLS |

“Implementado” descreve o candidato de homologação, não uma publicação. A qualidade do diagnóstico continua sendo responsabilidade humana; os catálogos iniciais não são política definitiva. O componente de triagem da demo recebe presença digital; os novos IDs e referências compartilhadas dependem do Supabase e não migram a base privada da demo.

## Roteiro único de futura integração e recuperação

1. Conferir main, heads, diffs e checks do SHA candidato. A pilha é #47 → #48 →  #49 (`feat/interacoes-comerciais`); não publicar nesta rodada.
2. Ensaio reproduzível em banco **descartável exclusivo**: `node scripts/commercial-upgrade-validation.mjs --reset-local-fixtures`. O script parte de main `935d42a`, faz dry-run exclusivo a cada fase, verifica hash de dados anteriores, RPC legada e leitura financeira negada; ao terminar recompõe a pilha local. Não executar contra o banco de uma prévia em uso.
3. Após aprovação futura, aplicar somente `20261125010000`, conferir referências/grants/RLS e integrar o frontend do #47. Após cada integração, atualizar a base do próximo PR para main; se squash reaplicar apenas os commits próprios, preservar branch remota e usar lease verificado se houver reescrita. Conferir diff e aguardar os checks do novo SHA.
4. Aplicar `20261125020000`, verificar trigger/auditoria/RPC e depois integrar o frontend #48.
5. Aplicar `20261125030000`, verificar grants das novas colunas, recibos privados e RPCs; depois integrar o frontend de interações. Nenhuma Edge ou credencial nova é necessária.
6. Confirmar deployment READY e SHA no domínio principal, smoke sem modificar vínculos/dados reais. Agendador e e-mail não são modificados por esta pilha.
7. Recuperar frontend anterior conservando as migrações aditivas, novos dados, auditoria, referências e revogações. Não fazer down destrutivo, reset, reclassificação em massa ou restauração de fotografias antigas sobre registros atuais. Resultados comerciais protegidos de reuniões continuam persistidos mesmo se o frontend anterior não os apresentar.

Comandos locais: `npm run check`, `npm test`, `npm run build`, `node scripts/local-validation.mjs --workers=1`. Workflows acrescentam ensaio de atualização e prévia externa. Não reduzir asserts para passar CI. O #48 teve dois seletores de responsável antigos corrigidos de texto livre para ID; as asserções de negócio originais foram mantidas.

## Revisão da prévia e comparativos

A prévia usa gateway HTTPS protegido, Supabase local e somente fixtures. A senha fica no arquivo local ignorado/protegido; nunca no PR. O túnel temporário depende da máquina e expira em 24 horas. O workflow `commercial-preview` confere o SHA exato, proteção das APIs, Cadastro, Triagem e Interação em desktop/celular e dois temas, a partir de runner externo. Artefatos: `comercial-previa-externa` e `rotina-integrada-capturas`.

Comparação verificável com main: o nome continua sendo o único requisito inicial; localização foi para detalhes progressivos, e segmento passou de texto livre a busca/seleção estável. Antes, presença e qualidade ocupavam um seletor combinado por canal; agora são dois controles com aplicabilidade, evidência e contexto explícitos. Antes, responsável era texto livre; agora é seleção de membro ativo por ID, sem inferir o legado. Registrar contato e definir acompanhamento continuam em **um envio**, agora transacional e com resultado estruturado, motivo/retomada e conflito recuperável. Não se afirma redução de cliques ou resultado de pesquisa com usuários.

Revisão em cinco minutos: novo cadastro só com nome; completar localização/origem; pesquisar segmento; abrir triagem e alternar presença/qualidade; registrar aguardando resposta com acompanhamento; conferir Agenda em outra sessão. Usar apenas as personas fictícias. As capturas anteriores da UX publicada e as capturas atuais ficam nos artefatos de CI; não são evidência de aparelho físico ou conformidade WCAG completa.

`.gitignore` revisado: configurações privadas, `.validation`, env, logs, caches, dist e relatórios já cobertos; nenhum código/migração/referência oficial foi ocultado. `security-review.mjs` não encontrou segredos rastreados nesta pilha. Mantida tipografia oficial e exceções estreitas versionadas do Impeccable. Nenhuma dependência paga ou envio real.

Para reproduzir a prévia no Windows com a pilha local preparada: `node scripts/start-commercial-preview.mjs --tunnel CAMINHO_DO_CLOUDFLARED`. Usa porta 4201, build compartilhado apontado ao proxy local, credenciais exclusivamente em memória/arquivo privado e personas fictícias. O script configura somente a variável `HUB_COMMERCIAL_PREVIEW_URL` e o segredo de CI `HUB_COMMERCIAL_REVIEW_PASSWORD` (via stdin). `scripts/protect-commercial-preview.ps1` confirma gitignore e aplica ACL antes da gravação. Acesso local: `.validation/commercial-preview-access.json`; metadados públicos sem senha: `.validation/commercial-preview-public.json`. Nunca apontar este lançador ao Supabase remoto. Não inicia nem configura TURN.

Impeccable doctor: preservadas as exceções Inter já versionadas. DESIGN.md extenso e sidecar gerado antes da última edição permanecem como recomendações documentais herdadas; esta frente não altera tokens nem usa o sidecar para gerar CSS. O hook local não acompanha o worktree porque a configuração `.codex` do usuário não está rastreada; ela foi preservada na raiz, sem copiar configurações privadas para o PR. Revisão de componentes React, teclado, foco e reflow feita nos testes desta pilha. Não foi introduzida supressão nova.


Revisão final: reabrir uma pesquisa “não encontrado” e passar a “identificado” inicia qualidade como Não avaliado, sem restaurar uma conclusão descartada. Coberto por unidade e navegador. O resumo da ficha também lê os campos estruturados de endereço/verificação e resolve o responsável pelo ID autorizado, preservando o texto antigo no editor. A prévia usa locale pt-BR para controles nativos de data.

Reuniões vinculadas a projeto exigem também escrita em Projetos para registrar resultado comercial, inclusive pela API. O acompanhamento conserva o projeto da reunião. Comercial sem Operação/Administração não recebe essa opção de alteração na ficha. A auditoria de reuniões continua sendo a existente e cobre a nova coluna de resultado.

O executor local distingue seletores de arquivos de opções: `--workers=1` sozinho usa a mesma suíte compartilhada curada do CI, em vez de incluir o teste de backup exclusivo do modo demo. Esse teste continua obrigatório e executado separadamente em modo local pelo workflow Interface. A primeira chamada genérica de Playwright incluiu-o em modo compartilhado e foi interrompida; o erro de seleção foi corrigido sem remover suas asserções nem seu check próprio.
