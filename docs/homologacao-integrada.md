# Homologação integrada — Operacional, Comercial e Gerencial

Esta rodada não autoriza merge, migração remota, Edge ou frontend de produção. A base conferida é `4e59c14d08b5080936d38668c6643e0fc1c0cedf` (#18), com histórico de migrações até `20261116010000`, consultado somente por metadados. Não foram consultados registros de negócio reais.

## Candidato e referências

| Entrega | PR / base | Head de entrada | Referência utilizada |
|---|---|---|---|
| Operacional | [#19](https://github.com/viniciusfs-seno/decifaz-hub/pull/19) / main | `44afc1d` | Demo `src/main.tsx`, identidade oficial e implementação compartilhada |
| Catálogo e propostas | [#20](https://github.com/viniciusfs-seno/decifaz-hub/pull/20) / #19 | `137d143` | Demo e regras/RPCs existentes |
| Reunião e apresentação | [#21](https://github.com/viniciusfs-seno/decifaz-hub/pull/21) / #20 | `bd42654` | Demo, roteiro consultivo e assets locais |
| Indicadores e fechamento | [#22](https://github.com/viniciusfs-seno/decifaz-hub/pull/22) / #21 | `c7ee2e3` | Regras compartilhadas e filtros persistidos |

O topo de #22 contém as quatro entregas por ancestralidade. Nenhuma base mudou nesta homologação. Não foi localizada uma versão acessível do GPT Sites que pudesse ser identificada como fonte desta experiência; não se presume paridade com ela. Ver [comparação dos fluxos](operacional.md) e [limites dos indicadores](comercial-gerencial.md).

Revisão acumulada: corrigido no #22 o fechamento que impedia retirar uma atividade previamente selecionada caso seu responsável/prazo fosse removido depois. A seleção inválida pode ser retirada; novas inclusões continuam exigindo responsável e prazo. Regressão em `e2e/management-real.spec.mjs`.

## Ambiente e proteção

Não há projeto Supabase de homologação disponível entre os projetos acessíveis. Não se utilizam projetos de outras aplicações. A alternativa é Supabase **local descartável**, SMTP no Mailpit e um gateway HTTP em `127.0.0.1:4195`, publicado por túnel HTTPS temporário Cloudflare. O gateway serve um build compartilhado com API na mesma origem (`/__supabase`), sem endereço de loopback no cliente.

Frontend, assets, REST, Edge e retorno Auth exigem senha de revisão, com cookie opaco Secure/HttpOnly/SameSite e validade de oito horas. A prévia expira em 24 horas. Apenas o endpoint de saúde, sem dados nem credenciais, é público. Studio, banco, Mailpit e administração Auth não são expostos. A senha fica fora do Git, arquivos de configuração e logs; no CI usa secret exclusivo de homologação. Não reutilizar senha de usuário real.

Há três perfis fictícios: Administração, Comercial restrito e segunda sessão administrativa. A página `/__review` permite trocar de perfil sem informar e-mail real. As contas usam `@example.invalid`. OTP/cadastro/recuperação para outros domínios são recusados pelo gateway. O teste Auth usa Mailpit: apenas o host do link fictício é traduzido para o proxy protegido; a confirmação e emissão de sessão continuam no Auth local. **Não comprova entrega SMTP externa.**

Configurar `auth.site_url` e redirects **somente no runtime local** para a origem HTTPS, reiniciar a pilha e restaurar o arquivo de configuração original antes do commit. O frontend antigo e os testes locais mantêm seus destinos próprios. Nenhuma configuração Auth remota é alterada.

O túnel é provisório, depende desta máquina ligada e conectada e não tem SLA. Reiniciá-lo pode mudar a URL. Não é hospedagem permanente nem deployment Vercel. Referência: [Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Reprodução automatizada

```sh
npm run check
npm test
npm run build
node scripts/mock-validation.mjs
node scripts/local-validation.mjs
node scripts/integrated-upgrade-validation.mjs --reset-local-fixtures
```

O último comando apaga **exclusivamente a pilha local fictícia**. Recusa URL remota, volta ao esquema #18, semeia contas/registros fictícios, aplica cada expansão isoladamente e testa o frontend anterior e o novo com sessão Auth real fictícia. Compara digest de vínculos, papéis, revisões, leads, propostas, atividades e auditoria antes/depois e verifica a negação dos JSONs financeiros brutos. Ao terminar restaura o esquema candidato completo local. Não executar enquanto alguém revisa a prévia: o reset invalida os perfis temporários.

`scripts/hml-gateway.mjs` recebe `{origin,password}` por stdin, captura as chaves locais apenas em memória, gera `.validation/hml-dist`, cria o cenário fictício e imprime somente URL, SHA e validade. O teste `tests/hml-gateway.test.mjs` verifica a barreira, cookie, origem e rotas proibidas.

O workflow de interface contém a validação **externa**, em runner GitHub, com `HUB_HML_PREVIEW_URL` (variable) e `HUB_HML_REVIEW_PASSWORD` (secret). Chromium desktop e WebKit com perfil de iPhone percorrem a URL HTTPS; não é um aparelho físico. São usadas duas sessões, escrita/atualização cruzada, espaço alternativo com registros, restrições financeiras, desativação fictícia, Auth e apresentação limpa. A jornada completa também cobre catálogo → cadastro → triagem → diagnóstico → proposta versionada → aceite administrativo → projeto/suporte → indicadores → fechamento. Não há trace, vídeo ou captura automática de erro que registre links Auth; capturas explícitas mostram apenas o app e dados fictícios. O resultado sanitizado registra candidato e motor.

Captura de tela: testes locais simulam sucesso/stop, cancelamento/recusa e API ausente. A validação externa tenta a API nativa em Chromium e registra seu resultado; WebKit móvel registra suporte/ausência efetivos. Não equivale a validar o seletor de um telefone físico. Captura é local, não transmissão do Hub; o participante remoto continua na videochamada externa vinculada. A visão do cliente exclui respostas, notas, histórico e preços não selecionados.

## Integração futura, verificações e recuperação

Antes de cada etapa: obter autorização de produção, `git fetch origin`, consultar base/head/checks/revisões do PR; conferir o SHA efetivo e diff. Um check verde de head antigo não valida um candidato reescrito. Identificar e registrar deployment de recuperação ativo antes da primeira migração. O merge na main pode publicar automaticamente: banco primeiro, frontend depois. As quatro branches continuam sem deploy automático.

| Ordem | Banco antes do frontend | Verificação para avançar | Recuperação sem perder registros |
|---|---|---|---|
| #19 | dry-run somente `20261116020000`; aplicar revisão operacional | RPC, índice de ação única por origem, grants/RLS, concorrência e frontend #18 | frontend #18; conservar ações, índice, RPC e todas as restrições anteriores |
| #20 | dry-run somente `20261116030000`; aplicar catálogo | soluções/seed por espaço, revisão/admin, arquivo, snapshots de propostas e frontend #19 | frontend #19; conservar catálogo e snapshots; pausar novas seleções legadas se houver renomeações |
| #21 | sem migração; Edge #18 compatível | pauta/diagnóstico, apresentação limpa e frontend #20 com campos opcionais | frontend #20, preservando JSONs opcionais e vínculos |
| #22 | dry-run somente `20261116050000`; aplicar fechamentos | admin/RLS, isolamento, revisão concorrente, ações+histórico atômicos, CSV e frontend #21 | frontend #21; conservar fechamentos, ações e histórico |

Não executar `db push` que contenha migrações de fases futuras. Usar checkout/workdir isolado do candidato da fase, conferir dry-run e hashes dos artefatos. Não remover tabela/coluna/histórico, não conceder escrita direta e não restaurar leitura financeira revogada. Se necessário suspender EXECUTE da RPC nova durante diagnóstico, mantendo os registros e as proteções do #13/#18. Nunca resetar produção.

Depois do merge de cada base, retarget do próximo PR para `main`. Se o merge preservou ancestralidade, comparar `git diff origin/main...branch` e rebase quando necessário. Se foi squash, guardar o head remoto, criar branch temporária sobre main e reaplicar **somente o intervalo próprio**: #20 = `44afc1d..137d143`, #21 = `137d143..bd42654`, #22 = `bd42654..HEAD_DO_22`. Conferir `git range-diff`, arquivos/diff/commits e nenhum trabalho perdido antes de atualizar. Usar `--force-with-lease=refs/heads/BRANCH:HEAD_REMOTO_CONFERIDO` se precisar reescrever. Reaplicar/revalidar dependentes em ordem; conferir o novo head e esperar os dois workflows completos antes do próximo merge.

Após cada integração autorizada: esperar Vercel terminar, conferir deployment/SHA no domínio principal e checks autenticados; não reutilizar evidência da prévia como prova do deployment de produção.

### Atualização dos dependentes após squash

Executar em worktree novo, preservando o checkout de trabalho e uma referência local/remota do head antigo. A sequência abaixo é um roteiro para uma futura autorização, não foi executada em produção:

1. Antes do merge #19, guardar `44afc1d` e o head vigente de #20; conferir os cinco commits exclusivos de #20: `64d3fff`, `bc0cfa2`, `6d5973e`, `38f39c4`, `137d143`. Após o squash #19, criar branch sobre a nova `origin/main` e reaplicar esses commits em ordem. Comparar árvores e `git range-diff` com `44afc1d..137d143`, resolver conflitos preservando ambas as entregas. Atualizar a branch #20 apenas com `--force-with-lease=refs/heads/feat/catalogo-compartilhado:<head-remoto-conferido>`, mudar base do PR para main e esperar ambos os workflows do novo SHA.
2. Após #20, repetir para #21 com somente `3f3c093`, `2c9018b`, `bd42654`, comparando com `137d143..bd42654`; os merges de sincronização não devem reaplicar catálogo. Guardar o head remoto antes da reescrita e usar lease explícito. Retarget para main, conferir diff só de reunião/apresentação e reexecutar os checks.
3. Após #21, reaplicar em #22 somente `ce8b2af`, `c7ee2e3` e os commits posteriores de homologação registrados no PR, sem reaplicar o merge `77c51aa`. Comparar o diff final com `bd42654..head-antigo-22`, retarget para main e revalidar tipagem, unitários, builds, SQL, transição e navegadores antes de integrar.

Se main receber trabalho adicional, não assumir que a lista de commits basta: conferir árvore, diff acumulado e conflitos antes do push. Em merge sem squash, preferir preservar a ancestralidade e retarget; não reescrever sem necessidade. As migrações do próximo PR só podem avançar depois das verificações e autorização da fase atual.

Ao encerrar a homologação, parar somente os processos identificados do gateway/túnel e remover a variable `HUB_HML_PREVIEW_URL` e o secret exclusivo `HUB_HML_REVIEW_PASSWORD`. A expiração do gateway já nega acesso mesmo se o túnel continuar vivo. Não remover secrets/variables de outros ambientes.

## Revisão no celular

1. Abrir a URL de homologação, informar a senha entregue separadamente e escolher Administração fictícia.
2. Conferir Dashboard e seus atalhos, Agenda (vencidas/hoje/7 dias) e menu móvel; alternar tema.
3. Abrir Café Horizonte para a jornada, Mercado Sol para reunião/pauta e visão limpa do cliente; conferir catálogo e versões de proposta.
4. Abrir Indicadores, variar período/responsável/etapa e baixar CSV; visitar Revisão semanal e histórico.
5. Em “Trocar perfil”, escolher Comercial para comparar a ausência de valores/gestão administrativa. Não usar conta nem informação real.

SHA efetivo, links dos checks e artefatos de capturas ficam no corpo atualizado do #22; o relatório de upgrade em `.validation/integrated-upgrade-result.json` registra o SHA exato executado, sem dados pessoais. Disponibilidade/validade da URL devem ser conferidas no momento da entrega.

## Evidências desta rodada

Tipagem, 24 unitários, builds demo/compartilhado, oito arquivos SQL, 19 testes reais com Supabase e cinco de interface simulada aprovados localmente. O ensaio inicial completo foi executado em `e949d29`; o CI reexecuta o roteiro no candidato corrente. O primeiro CI identificou saída textual da CLI no Linux: o ensaio agora exige `stream-json` e lê o envelope estruturado, mantendo a exigência de uma migração por fase. As referências dos frontends anteriores são SHAs completos, disponíveis também no checkout do CI.

A navegação pública foi exercitada em Chromium com Auth/Mailpit, duas sessões, isolamento preenchido, restrições financeiras e desativação/reativação fictícia. No teste integrado, o atalho “Organizar meu dia” é validado com filtro Hoje; os filtros são então limpos para abrir um chamado futuro. A jornada completa confere registros pela API da segunda sessão, snapshots das versões e ação do fechamento na semana correta, sem assumir um espaço vazio. Resultados finais externos, motores, capturas e SHA corrente são os do workflow vinculado no #22, não os de uma execução anterior.

Para encerrar a homologação: parar somente os processos próprios do gateway/túnel, limpar suas fixtures locais e remover `HUB_HML_PREVIEW_URL` e `HUB_HML_REVIEW_PASSWORD` do repositório GitHub. A senha deixa de ser útil quando o gateway expira ou é encerrado. Não reconfigurar nem parar serviços de produção. As capturas do workflow expiram após sete dias; não contêm credenciais ou links de acesso.
