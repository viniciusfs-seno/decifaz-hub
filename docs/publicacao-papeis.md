# Publicação e recuperação dos papéis

Este é um roteiro para revisão da publicação dos papéis. #14 e #12 foram integrados e seus deploys automáticos concluíram. A API Vercel confirmou que `decifaz-hub.vercel.app` aponta para `dpl_G22ENmxVFTwmJXB7w4S1fHw9zQMU`, READY em production, no SHA `304922f4e13f22181e12032f31ea75e6eccec4be`. Nenhuma fase de banco, Edge ou frontend do #13 foi publicada. Os testes autenticados usam apenas a pilha fictícia `decifaz-hub-e2e`, em `127.0.0.1:54321`.

## Dependências e integração

1. #14 integrado por squash em `3206234a70c5080f459facc8a329fae85aac5741`; padrão disponível na main.
2. #12 integrado por squash em `304922f4e13f22181e12032f31ea75e6eccec4be`; essa é a base comercial da publicação. O frontend ainda usa os JSONs brutos.
3. #13 retargetado para `main`, com os quatro commits próprios reaplicados sobre `304922f`. O `git range-diff` confirmou equivalência dos quatro patches; a diferença de árvore para o head anterior contém somente os três arquivos do #14. O head anterior está preservado na tag remota `validation/pr13-before-main-48ff670`, também necessária para obter os snapshots históricos usados no teste de transição. Consultar o SHA revalidado e os checks em `validacao-papeis.md`.
4. Manter #13 em rascunho até homologar a matriz e definir quem receberá cada papel real. Não fazer seu merge antes das etapas de expansão e Edge abaixo: o frontend publicado pela main já dependerá das views e do campo `role`.

## Publicação em fases

Não executar todas as migrações pendentes em uma única publicação. Preparar dois artefatos de migração revisados: **expansão** contém o histórico até `20261114200000_expansao_compativel.sql`; **restrição** acrescenta `20261114210000_papeis.sql` e `20261114220000_visible_scope_execute.sql`. Usar checkouts de release separados, conferir o dry-run contra o histórico remoto e aplicar apenas o artefato autorizado. Não remover migrações do checkout de desenvolvimento nem marcar uma versão como aplicada sem executá-la. Essas migrações do #13 ainda não publicadas foram reorganizadas; bancos locais que receberam a versão anterior devem ser recriados apenas se contiverem dados fictícios descartáveis.

| Etapa | Banco | Edge/frontend | Condição para avançar |
| --- | --- | --- | --- |
| Estado anterior | Histórico até `20261114181046` | #12 e Edge anterior | Membros existentes acessam o espaço |
| A: expansão | Aplicar somente `20261114200000` | Frontend/Edge anteriores continuam válidos | Vínculos preservados, todos os membros anteriores com `admin`, views disponíveis, novos vínculos exigem papel explícito |
| B: Edge | Manter expansão | Publicar apenas `hub-workspaces` compatível com `role` | JWT, espaços e papel conferidos; frontend anterior continua funcionando |
| C: frontend | Manter expansão | Publicar frontend que consulta as views; merge do #13 pode disparar essa publicação | CRM, propostas, projetos e Financeiro conferidos; registrar SHA/URL e guardar o artefato compatível para recuperação |
| D: restrição | Aplicar `20261114210000` e `20261114220000` | Manter Edge com `role` e frontend com views | SELECT de `record` e `approved` retorna `42501`; consultas pelas views continuam funcionando |
| E: papéis | Nenhuma mudança de privilégios | Atribuir papéis homologados pela RPC administrativa | Testar permitido, negado e isolamento com cada perfil |

Antes da expansão, atualizar integrações administrativas de provisionamento para informar `role` explicitamente. Na expansão, o `DEFAULT 'admin'` existe somente durante o preenchimento das linhas anteriores e é removido na mesma transação. O trigger rejeita qualquer papel restrito antes da restrição, inclusive se o vínculo for criado por uma chave administrativa. A etapa D revoga os SELECTs, verifica os privilégios efetivos e só então ativa a atribuição restrita, tudo na mesma transação.

### Artefatos e critérios de avanço

As identidades abaixo são objetos Git estáveis, independentes de diferenças de quebra de linha no Windows. Conferir com `git rev-parse HEAD:caminho` no candidato aprovado. Qualquer alteração desses objetos exige nova validação e atualização do manifesto.

| Fase | Artefato a revisar e guardar | Identidade Git | Verificação para avançar |
| --- | --- | --- | --- |
| A | Checkout de release baseado em `304922f`, acrescido somente da migração `supabase/migrations/20261114200000_expansao_compativel.sql` | blob `d5fe4f7107736b95af2e2765a555432f214df836` | Dry-run contém apenas a expansão; contagem/vínculos preservados; role dos antigos é admin; DEFAULT ausente; papel omitido/nulo negado; atribuição restrita bloqueada; frontend anterior continua operando |
| B | `supabase/functions/hub-workspaces/index.ts`, com a versão npm fixada no import | blob `63a0f3f0bef0933b41db7425c3ed57610053a119` | Publicar explicitamente apenas hub-workspaces; JWT, isolamento, 401/403 e campo role aprovados em homologação; conferir versão efetivamente publicada |
| C | Fonte do frontend, lockfile, index e assets públicos; build da Vercel com variáveis publicáveis do ambiente de destino | árvore src `1d1d4a1a8472fd5aaaf194fbf4e737b23e2e4d1d`; lock `ee6c395f322f0d66dd6f98169551dbbce7d02e13`; public `bc7091340e344480f1188609cad8f970e1dd7c24`; index `c0006be2babc98fb5f79cd825e3468cc0f0a61d5` | Checks do SHA a integrar verdes; registrar deployment ID/URL imutável, SHA e manifest de assets; confirmar acesso e módulos com views antes de D; guardar esse build para recuperação |
| D | Migrações `20261114210000_papeis.sql` e `20261114220000_visible_scope_execute.sql` | blobs `97f8789983897666b0f31410584b82cd77e854a8` e `6118f21119f7aa4efe24504c05673fc280c8ca43` | Dry-run só da restrição; verificação dos privilégios brutos false para authenticated; SELECT protegido retorna 42501; views continuam funcionais; marca hardened ativada atomicamente |
| E | Mapeamento aprovado de pessoas para papéis, mantido fora do Git; execução administrativa pela RPC | Decisão dos sócios, ainda pendente | Matriz homologada; cada vínculo novo tem papel explícito; último administrador preservado; registrar resultado/auditoria sem credenciais |

Não publicar `dist/` produzido por `mock-validation.mjs` ou pelos snapshots locais: esses builds incorporam configuração publicável fictícia/local. A imagem temporária de login e os artefatos locais são evidência de teste, não um pacote de produção. A confirmação de deployment ID/alias na etapa C exige acesso funcional à Vercel; um check GitHub verde, isoladamente, não comprova qual deployment está associado ao domínio.

A sessão do navegador antigo pode continuar aberta após D, mas suas consultas brutas serão negadas. Solicitar recarga para a versão compatível. Não restaurar SELECT bruto para acomodar abas antigas.

## Recuperação

- **Antes de D:** reverter primeiro o frontend para #12 e depois a Edge anterior. Manter a expansão aditiva no banco e todos os vínculos como `admin`. O frontend antigo não cria associações; o provisionamento continua exigindo papel explícito. Não há necessidade de apagar a coluna, as views ou os vínculos.
- **Se D falhar:** a transação reverte as alterações da própria migração. Manter o frontend com views e a Edge com `role`, diagnosticar e reaplicar a migração revisada. Não liberar papéis restritos manualmente.
- **Depois de D:** preservar RLS, revogações e vínculos. Reverter apenas para um frontend que use views e uma Edge que devolva `role`. O frontend do commit `e1292085040722023f1331a24139620c2df25ca4` foi exercitado como referência de recuperação compatível, inclusive com Comercial restrito. Essa referência é apenas de frontend: não reaplicar suas migrações antigas, não restaurar o DEFAULT e não reintroduzir sua leitura de preços antes do bloqueio. Guardar também o artefato aprovado da etapa C para recuperação operacional.
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
