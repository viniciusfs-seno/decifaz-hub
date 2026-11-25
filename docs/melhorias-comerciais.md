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
