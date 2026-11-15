# Publicação e recuperação dos papéis

Este é um roteiro para revisão. Nenhuma etapa remota foi executada. Os testes usam apenas a pilha fictícia `decifaz-hub-e2e`, em `127.0.0.1:54321`.

## Dependências e integração

1. Revisar e integrar #14, que define o padrão documental e é independente. O merge pode disparar o deploy habitual da main.
2. Revisar e integrar #12, que ainda usa os JSONs brutos. Os checks devem corresponder a `8357a4ac49b1d29fa0589768018f827234ccc896`, ou ser refeitos se o commit mudar. Seu merge também pode publicar o frontend; confirmar o resultado antes de continuar.
3. Depois do merge do #12, retargetar #13 para `main` e conferir o diff. Em merge squash, pode ser necessário atualizar a branch para excluir os commits equivalentes do #12. Preservar alterações locais e repetir checks se mudar o código ou a base.
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
