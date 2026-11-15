# Publicação e recuperação dos papéis

O rollout do #13 foi autorizado e executado em fases em 15/11/2026. Candidato `bab124d48d3ac234ec43ab63d629b20ec48090f1`, squash merge `ab6427fc8d66de9bb959a0beda173ac1e8031ea1`. Domínio `decifaz-hub.vercel.app` confirmado pela API no deployment `dpl_Ho86q5fP38RcURGtFvY2XUQ99dBW`, READY/production, nesse SHA. URL imutável: `https://decifaz-o7guxbee3-vinicius-ferreiras-projects-84ef88fb.vercel.app`.

## Registro da execução autorizada

- A: aplicada somente `20261114200000`; três vínculos preservados, admin sem extras, DEFAULT ausente, views presentes e hardened=false.
- B: Edge `hub-workspaces` v2 ACTIVE, verify_jwt=false; fonte baixado do remoto confere com blob `8118d8c04360b69eacafb6ff7b16bf12cfb2d799`. Sem sessão/token inválido: 401. Nenhuma fixture legada publicada.
- C: merge e deploy automático confirmados; Chromium verificou tela de acesso, HTTP 200, sem enviar formulário. Assets publicados usam views e roles. Checks da main: [Interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43736345907) e [Supabase](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43736345894), ambos aprovados.
- D: aplicadas somente `20261114210000` e `20261114220000`, após dry-run. Histórico com 14 versões, hardened=true, privilégios de leitura bruta false; SELECTs reais sob authenticated negados com 42501. Revogações preservadas.
- E: identidade confirmada resolvida privadamente pelo vínculo existente. RPC executada no contexto authenticated do administrador verificado, em bloco atômico; conjunto completo e direito de gestão validados, demais vínculos comparados antes/depois sem diferenças. Nova leitura independente confirmou o conjunto exato persistido. Nenhum ID/e-mail real foi gravado no Git, artefatos ou CI. Nenhuma conta, senha, token ou link de acesso foi criado.

A CLI não transportou corretamente o primeiro comando multilinha passado como argumento; a leitura posterior detectou que o conjunto não havia sido persistido. A operação foi refeita em um único bloco sem quebras de linha, com as mesmas guardas e nova leitura de confirmação. Não usar somente código de saída ou rows=[] como prova de gravação. Testes que alteram terceiros seguem exclusivamente locais e fictícios; a Edge autenticada foi exercitada localmente, sem criar sessão de usuário em produção.

Os pacotes do candidato aprovado e as cópias operacionais ficaram em `.validation/role-release/bab124d48d3ac234ec43ab63d629b20ec48090f1/` e `.validation/rollout-bab124d/`. Recuperação atual pós-restrição: deployment do #13 acima e Edge v2 com roles/role, mantendo todas as restrições. O deployment anterior `304922f` só é recuperação anterior a D. A tela de Equipe é outra entrega, descrita em [equipe.md](equipe.md), ainda não publicada.

O restante registra o roteiro, critérios e fotografias anteriores usados na operação; estados pendentes dessas fotografias foram superados pelo registro acima.

## Dependências e integração

1. #14 integrado por squash em `3206234a70c5080f459facc8a329fae85aac5741`; padrão disponível na main.
2. #12 integrado por squash em `304922f4e13f22181e12032f31ea75e6eccec4be`; essa é a base comercial da publicação. O frontend ainda usa os JSONs brutos.
3. #13 retargetado para `main`, com os quatro commits próprios reaplicados sobre `304922f`. O `git range-diff` confirmou equivalência dos quatro patches; a diferença de árvore para o head anterior contém somente os três arquivos do #14. O head anterior está preservado na tag remota `validation/pr13-before-main-48ff670`, também necessária para obter os snapshots históricos usados no teste de transição. Consultar o SHA revalidado e os checks em `validacao-papeis.md`.
4. #13 foi integrado após autorização e verificação de expansão/Edge. Somente o conjunto do único vínculo aprovado foi atribuído. A entrega seguinte de Equipe permanece em rascunho até revisão própria.

## Publicação em fases

### Preparação offline e conferência remota (15/11/2026)

Executar `node scripts/prepare-role-artifacts.mjs <SHA-aprovado>` gera `.validation/role-release/<SHA>/manifest.json` e seis pastas separadas: `A-expansao`, `B-edge`, `C-frontend`, `D-restricao`, `recuperacao-antes-D` e `recuperacao-depois-D`. O manifesto identifica candidato, baseline e SHA-256 de cada arquivo. Nova execução verifica o manifesto existente sem sobrescrever arquivos. Os pacotes não contêm `.env`, `.temp`, segredos, vínculos reais nem `dist`.

A contém config/função anteriores e o histórico da main acrescido somente de expansão. D contém o histórico da main, expansão e restrições, para comparação com o histórico remoto após A; não é autorização para aplicar todas as fases juntas. B e as recuperações não carregam migrações. C contém fontes e lockfile; o build publicável depende das variáveis do destino e deve ser produzido/guardado na fase C. O teste de transição aplica os SQLs das pastas A/D preparadas, não uma seleção implícita de todas as migrações pendentes. Os snapshots históricos continuam exercitando os clientes anteriores e o frontend de recuperação.

A configuração incluída é **local**: não substituir a configuração remota inteira por `config.toml`. Na fase B, a configuração específica de `hub-workspaces` deve ter **`verify_jwt=false`** (opção de publicação `--no-verify-jwt`); a função faz `getClaims` e valida o JWT no próprio código. Preservar as demais configurações remotas. Guardar código e configuração da Edge anterior para recuperação antes de D.

Consultas remotas exclusivamente de leitura executadas nesta preparação:

```sh
npx --yes supabase@3.0.0 projects list --output json
npx --yes supabase@3.0.0 functions list --project-ref lnteuryqkabnpcixguxh --output json
npx --yes supabase@3.0.0 db query --remote=lnteuryqkabnpcixguxh --read-only "select version, name from supabase_migrations.schema_migrations order by version"
```

Projeto `decifaz-hub` ativo, PostgreSQL `17.11.0.019`. Histórico remoto: 11 versões, correspondentes ao histórico local até `20261114181046`; nenhuma versão de expansão/restrição registrada. Edge `hub-workspaces` ACTIVE, versão 1, `verify_jwt=true`, digest remoto `0e0ca94110e0f268158bc392f800322a889375a079fbf9896f38dd9b943fe28f`. Isso confirma versões/histórico, não equivalência integral de schema ou código remoto. Nenhuma mutação remota foi feita. Repetir a leitura e o dry-run do artefato autorizado imediatamente antes de cada publicação; mudanças posteriores invalidam esta fotografia.

Não executar todas as migrações pendentes em uma única publicação. Preparar dois artefatos de migração revisados: **expansão** contém o histórico até `20261114200000_expansao_compativel.sql`; **restrição** acrescenta `20261114210000_papeis.sql` e `20261114220000_visible_scope_execute.sql`. Usar checkouts de release separados, conferir o dry-run contra o histórico remoto e aplicar apenas o artefato autorizado. Não remover migrações do checkout de desenvolvimento nem marcar uma versão como aplicada sem executá-la. Essas migrações do #13 ainda não publicadas foram reorganizadas; bancos locais que receberam a versão anterior devem ser recriados apenas se contiverem dados fictícios descartáveis.

| Etapa | Banco | Edge/frontend | Condição para avançar |
| --- | --- | --- | --- |
| Estado anterior | Histórico até `20261114181046` | #12 e Edge anterior | Membros existentes acessam o espaço |
| A: expansão | Aplicar somente `20261114200000` | Frontend/Edge anteriores continuam válidos | Vínculos preservados, todos os membros anteriores com `admin`, views disponíveis, novos vínculos exigem papel explícito |
| B: Edge | Manter expansão | Publicar apenas `hub-workspaces` compatível com `roles` e `role` | JWT, espaços e papel conferidos; frontend anterior continua funcionando |
| C: frontend | Manter expansão | Publicar frontend que consulta as views; merge do #13 pode disparar essa publicação | CRM, propostas, projetos e Financeiro conferidos; registrar SHA/URL e guardar o artefato compatível para recuperação |
| D: restrição | Aplicar `20261114210000` e `20261114220000` | Manter Edge com `role` e frontend com views | SELECT de `record` e `approved` retorna `42501`; consultas pelas views continuam funcionando |
| E: papéis | Nenhuma mudança de privilégios | Atribuir conjuntos homologados pela RPC `hub_set_roles` | Testar permitido, negado e isolamento com cada perfil |

Antes da expansão, atualizar integrações administrativas de provisionamento para informar `role` explicitamente. Na expansão, o `DEFAULT 'admin'` existe somente durante o preenchimento das linhas anteriores e é removido na mesma transação. O trigger rejeita qualquer papel restrito antes da restrição, inclusive se o vínculo for criado por uma chave administrativa. A etapa D revoga os SELECTs, verifica os privilégios efetivos e só então ativa a atribuição restrita, tudo na mesma transação.

### Artefatos e critérios de avanço

As identidades abaixo são objetos Git estáveis, independentes de diferenças de quebra de linha no Windows. Conferir com `git rev-parse HEAD:caminho` no candidato aprovado. Qualquer alteração desses objetos exige nova validação e atualização do manifesto.

| Fase | Artefato a revisar e guardar | Identidade Git | Verificação para avançar |
| --- | --- | --- | --- |
| A | Checkout de release baseado em `304922f`, acrescido somente da migração `supabase/migrations/20261114200000_expansao_compativel.sql` | hash do manifesto do candidato | Dry-run contém apenas a expansão; contagem/vínculos preservados; role dos antigos é admin; DEFAULT ausente; papel omitido/nulo negado; atribuição restrita bloqueada; frontend anterior continua operando |
| B | `supabase/functions/hub-workspaces/index.ts`, com a versão npm fixada no import | hash do manifesto do candidato | Publicar explicitamente apenas hub-workspaces; JWT, isolamento, 401/403 e campo role aprovados em homologação; conferir versão efetivamente publicada |
| C | Fonte do frontend, lockfile, index e assets públicos; build da Vercel com variáveis publicáveis do ambiente de destino | árvore src `7878ea32be4782e86d4be1b3dd618422462a569e`; lock `ee6c395f322f0d66dd6f98169551dbbce7d02e13`; public `bc7091340e344480f1188609cad8f970e1dd7c24`; index `c0006be2babc98fb5f79cd825e3468cc0f0a61d5` | Checks do SHA a integrar verdes; registrar deployment ID/URL imutável, SHA e manifest de assets; confirmar acesso e módulos com views antes de D; guardar esse build para recuperação |
| D | Migrações `20261114210000_papeis.sql` e `20261114220000_visible_scope_execute.sql` | blobs `f3f14c444a87c6db6f51ee959aeecf1b7e535a01` e `6118f21119f7aa4efe24504c05673fc280c8ca43` | Dry-run só da restrição; verificação dos privilégios brutos false para authenticated; SELECT protegido retorna 42501; views continuam funcionais; marca hardened ativada atomicamente |
| E | Único vínculo aprovado, localizado privadamente; conjunto completo de quatro papéis pela RPC | Aprovado para esse vínculo; rollout pendente | Restrição confirmada primeiro; conjunto persistido exato; gestão administrativa no mesmo espaço; último administrador preservado |

Não publicar `dist/` produzido por `mock-validation.mjs` ou pelos snapshots locais: esses builds incorporam configuração publicável fictícia/local. A imagem temporária de login e os artefatos locais são evidência de teste, não um pacote de produção. A confirmação de deployment ID/alias na etapa C exige acesso funcional à Vercel; um check GitHub verde, isoladamente, não comprova qual deployment está associado ao domínio.

A sessão do navegador antigo pode continuar aberta após D, mas suas consultas brutas serão negadas. Solicitar recarga para a versão compatível. Não restaurar SELECT bruto para acomodar abas antigas.

## Recuperação

- **Antes de D:** reverter primeiro o frontend para #12 e depois a Edge anterior. Manter a expansão aditiva no banco e todos os vínculos como `admin`. O frontend antigo não cria associações; o provisionamento continua exigindo papel explícito. Não há necessidade de apagar a coluna, as views ou os vínculos.
- **Se D falhar:** a transação reverte as alterações da própria migração. Manter o frontend com views e a Edge com `role`, diagnosticar e reaplicar a migração revisada. Não liberar papéis restritos manualmente.
- **Depois de D:** preservar RLS, revogações e vínculos. Usar o par `recuperacao-depois-D` do candidato com papéis cumulativos: frontend com views e Edge com `roles`/`role`. O frontend histórico `e1292085040722023f1331a24139620c2df25ca4` foi apenas referência de teste anterior aos conjuntos; preferir o pacote completo atual para preservar essas funcionalidades. Não reaplicar migrações antigas, restaurar DEFAULT ou reabrir leitura bruta. Guardar o deployment aprovado da fase C antes de D.
- Se nenhum artefato compatível estiver disponível, suspender o acesso afetado até corrigir a versão. O teste confirma que #12 falha de forma fechada após D; ele não é uma recuperação suportada nesse ponto.

O trigger de membros verifica tanto a marca de restrição quanto os privilégios reais ao atribuir um papel restrito. A RPC serializa alterações por espaço e mantém o último administrador. Nenhuma recuperação deve reabrir os JSONs brutos ou contornar essa proteção.

## Reprodução local

```sh
# ATENÇÃO: recria somente a pilha fictícia local deste projeto, antes e depois.
node scripts/transition-validation.mjs --reset-local-fixtures
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
```

O teste de transição gera builds dos frontends anteriores a partir dos SHAs fixados, usa a Edge anterior real em um endpoint local temporário e percorre os dois caminhos de recuperação. Os artefatos e a função temporária não entram no Git; o executor remove a função ao terminar. Os segredos administrativos ficam apenas na memória. Não publique a função `hub-workspaces-legacy-test`; publique explicitamente somente `hub-workspaces` na etapa B.

Gere novamente os artefatos e o manifesto para o commit com papéis acumuláveis. Para manter todos os papéis de uma associação ao atualizá-la, envie o conjunto completo à RPC administrativa.

## Candidato pronto para autorização

Aplicação: `cd6ceaaadef716685223eb7b6c7f0e8a2ac24823`, base `304922f`. Pacotes em `.validation/role-release/cd6ceaaadef716685223eb7b6c7f0e8a2ac24823/`, manifesto SHA-256 `480eaceb316fbe416f2313b698e1a9d947393192adef16ed15ddcc3a946c716a`. Expansão blob `4d89c15a26616074ec45db65dd73d3571e351ed6`; Edge blob `8118d8c04360b69eacafb6ff7b16bf12cfb2d799`. Alterações posteriores somente em testes/documentação não mudam esses objetos; conferir novamente no head a integrar.

O dry-run remoto do pacote A foi executado com CLI `3.0.0`, `--dry-run --skip-vault`: contém somente `20261114200000_expansao_compativel.sql`. Nenhuma migração aplicada. Usar cópias operacionais dos pacotes para a CLI: ela cria cache `.temp`; não adicionar esse cache ao manifesto nem copiar credenciais para o pacote. O manifesto original foi reconferido após remover apenas o cache gerado pelo dry-run.

Comandos abaixo preparados, **não executados sem autorização**. `<pacote-A>`, `<pacote-B>` e `<pacote-D>` indicam cópias operacionais das pastas correspondentes do manifesto aprovado; `<projeto>` é o projeto remoto reconfirmado na janela. Não usar include-all, seed, roles ou prune.

1. **A:** repetir `npx --yes supabase@3.0.0 db push --remote=<projeto> --workdir <pacote-A> --skip-vault --dry-run`; exigir somente expansão. Após autorização, mesmo comando sem `--dry-run`, com confirmação explícita. Conferir versão no histórico, preservação dos vínculos, DEFAULT ausente e bloqueio de conjuntos restritos; cliente antigo deve continuar funcionando.
2. **B:** `npx --yes supabase@3.0.0 functions deploy hub-workspaces --remote=<projeto> --workdir <pacote-B> --use-api --no-verify-jwt`. Conferir versão/digest/configuração publicados, 401 sem sessão, espaços próprios e `roles`/`role` em sessão válida, cliente anterior ainda compatível. Não publicar a fixture legada.
3. **C:** conferir novamente checks/diff do head a integrar contra main e obter autorização de integração dentro do rollout. Fazer merge do #13 somente depois de A/B; acompanhar o deploy automático até READY. Confirmar domínio, SHA de integração, login e acesso pelos contratos de views/Edge; guardar deployment imutável e build do ambiente de destino. Não usar `dist` dos testes. Havendo falha, não avançar para D.
4. **D:** repetir dry-run com `<pacote-D>`: agora somente `20261114210000` e `20261114220000` devem aparecer. Aplicar essas versões autorizadas, com `--skip-vault`. Conferir histórico, `hardened=true`, `has_column_privilege` false nos dois JSONs e SELECT direto negado com `42501`; views e módulos devem funcionar. Se houver falha, manter C/B compatíveis e não atribuir conjuntos.
5. **E:** localizar novamente a conta confirmada e seu vínculo existente em memória, exigindo exatamente uma correspondência e um espaço. Usar e-mail só para essa localização; operar por UUID sem persistir os identificadores. Pela RPC `hub_set_roles(w,u,r)`, no contexto administrativo desse espaço, enviar exatamente `['admin','commercial','operations','finance']`, substituindo o conjunto completo apenas desse vínculo. Não criar conta nem vínculo novo. Exigir retorno true, consultar o próprio vínculo para comparar `array[role] || extra_roles` como conjunto exato e conferir `hub_can(w,'admin',true)=true`. Reconfirmar a resposta da Edge. Qualquer divergência aborta a transação; não alterar outros vínculos como teste em produção.

O caminho administrativo é uma chamada autenticada da RPC, não UPDATE direto/service-role para contornar sua guarda. Não há sessão de usuário armazenada nos artefatos. Na janela autorizada, obter contexto administrativo por canal privado; se for usada sessão SQL administrativa, restringir a transação a `authenticated` e ao claim do UUID verificado do administrador existente, como na regressão SQL fictícia. Não produzir tokens, alterar senha, gerar link de acesso ou registrar claims/UUIDs no CI. Sem contexto administrativo válido, parar antes de E.

Recuperação **antes de D**: deployment `dpl_G22ENmxVFTwmJXB7w4S1fHw9zQMU`, SHA `304922f`, URL `https://decifaz-4dab1f0tk-vinicius-ferreiras-projects-84ef88fb.vercel.app`, reconfirmado READY/production associado ao domínio. Código real da Edge v1 baixado por leitura para `.validation/remote-recovery-cd6ceaa/supabase/functions/hub-workspaces/index.ts`, SHA-256 `38a42cbb99c51e4c3313f51a14f866b633869643103d240b1232f1e4aa7613a0`; guardar apenas esse fonte e a configuração remota `verify_jwt=true`, sem caches. Recuperação **depois de D**: pacote cumulativo `recuperacao-depois-D` e deployment compatível guardado em C; manter todas as restrições do banco.
