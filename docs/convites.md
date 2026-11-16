# Convites em Administração → Equipe

Entrega no PR #17, sobre a main com #16 publicado (`464dfa3f80579dcc18dc739a5d0e6884f5ffa16f`). O merge e a publicação foram autorizados condicionados à homologação de Auth/e-mail. A homologação externa foi concluída nos dois testes separados descritos abaixo; o SHA final, os checks e o resultado de cada fase de publicação ficam registrados no corpo do PR. Alterações de papéis, vínculos e eventos nos testes continuam restritas a contas fictícias locais/CI. Os únicos envios externos do agente foram os expressamente autorizados para homologação; endereços, UUIDs e links não são registrados no repositório.

## Regras e fluxo

- Admin do próprio espaço cria convite para e-mail normalizado (trim/minúsculas), escolhendo um ou mais papéis explícitos. Não há papel padrão. O servidor fixa validade em **sete dias**; o cliente não escolhe/extende o prazo.
- Estados exibidos: Pendente, Aceito, Revogado e Expirado. Expiração é calculada no servidor para pendentes, sem cron. Convite aceito não expira o vínculo já concedido. Revogar só afeta pendentes ainda válidos; não remove acesso de quem já aceitou.
- Um convite pendente ativo por destinatário/espaço, serializado pelo lock do espaço. Criar outro retorna o existente, sem mudar seus papéis; para alterá-los, revogar e emitir novo. Convite expirado permite nova emissão.
- Pendente não cria `hub_members`, não registra concessão e não concede acesso a módulos. Um cadastro Auth eventualmente criado pelo envio do link é apenas uma conta, sem vínculo com o espaço.
- Destinatário entra com e-mail verificado, abre Meus convites e escolhe Aceitar. Entrar, verificar e-mail ou abrir o link não aceita automaticamente. Conta sem vínculo pode consultar apenas seus próprios convites, não os módulos do espaço.
- No aceite, o servidor consulta o e-mail verificado atual em `auth.users`, não confia no e-mail do JWT nem em valores enviados pelo cliente. Conta errada/não verificada, expirado e revogado não concedem acesso. O autor do convite ainda precisa ter admin no espaço; se perdeu o papel, solicitar novo convite de um admin ativo.
- Havendo vínculo preexistente, seus papéis/revisão são preservados. O convite é encerrado como aceito com resultado `existing_member`, sem evento de nova concessão; a mensagem direciona mudanças à Administração em Equipe.

## Atomicidade, concorrência e atribuição

`hub_accept_invite(i)` bloqueia espaço e convite na mesma ordem das RPCs de gestão e protege a leitura do usuário Auth com lock compartilhado. A validação de prazo ocorre depois da espera. Criar vínculo, inserir histórico e marcar aceito são uma única transação. Unique do vínculo e locks impedem duplicação, inclusive em corrida com um vínculo criado por outro caminho.

Repetir um aceite concluído retorna o mesmo resultado, sem novo vínculo/evento. Aceites simultâneos esperam o lock: o primeiro concede e o segundo observa aceito. Revogação confirmada antes do aceite impede concessão; revogação posterior não desfaz um aceite. Um convite já aceito não recria vínculos que venham a ser removidos por outra operação.

`created_by` registra o admin que autorizou os papéis. `accepted_by`/`accepted_at` registram quem aceitou. Para uma concessão nova, o evento de `hub_role_audit` guarda `grantor_id`, `accepted_by` e `invite_id`; `actor_id` continua sendo quem executou o aceite, sem simular a identidade do concedente. Os dois usuários podem ser distintos e são testados assim.

O contexto vem de tabela **privada e transacional**, preenchida exclusivamente pela função de aceite e consumida pela trigger. Não vem de parâmetro ou GUC editável pelo cliente. É eliminado ao concluir; falha no histórico reverte vínculo, contexto e estado do convite. A trigger mantém o comportamento legado para mudanças sem convite, sem reescrever eventos históricos antigos. Não há novas permissões de edição do histórico.

## Superfícies protegidas

`hub_invites` tem RLS e nenhum acesso direto para authenticated/anon. Gestão ocorre por `hub_create_invite`, `hub_list_invites` e `hub_revoke_invite`, com admin do espaço conferido no servidor. `hub_my_invites` filtra exclusivamente o e-mail verificado do usuário autenticado. `hub_accept_invite` aplica as regras de identidade/estado acima. Todas têm search_path fixo e nenhum EXECUTE para anon/public. A tabela privada não tem grants ao app.

O link `/?convite=<id>` é um atalho, não uma credencial: conhecer seu ID não permite aceitar com conta errada. Não há token de convite que conceda acesso por posse. O frontend não tem service-role nem chave administrativa. Usuário comum/admin de outro espaço não pode gerir convites, mesmo manipulando as chamadas.

## E-mail e primeiro acesso

A tela pode solicitar **link de acesso do Supabase Auth** após criar o convite. Antes de enviar, reconfere no servidor que o admin ainda pode listar o convite e que ele está pendente. O destinatário usado vem desse registro. O envio utiliza cliente Auth separado, sem persistir sessão ou trocar a sessão do admin. Nenhuma Edge nova é necessária.

O link leva ao Hub e à caixa Meus convites. Novos destinatários podem criar a conta Auth pelo OTP (`shouldCreateUser=true`); isso não cria vínculo. O login normal continua sem cadastro automático; a opção Recebi um convite habilita primeiro acesso. O backend não concede acesso a cadastros sem convite aceito, mesmo que alguém use a API pública de cadastro/OTP diretamente.

Envio e concessão não são a mesma transação: falha de e-mail mantém o convite pendente e mostra aviso, com opção de reenviar/copiar o link. A tela diz que o envio foi solicitado, não que a caixa externa recebeu. Os estados de entrega não são uma fila/outbox persistente. Reenviar o link Auth não estende os sete dias. A validade do link OTP é configurada no Auth e pode ser menor que a do convite; pedir novo link não duplica concessão. Erro 503 foi simulado e o aviso permanece após atualizar a lista.

Os pontos de homologação para ativação são:

1. SMTP/remetente e templates Auth para destinatários novos, confirmação de e-mail, limites de envio/cadastros e eventual CAPTCHA. Nenhuma configuração Auth de produção foi alterada por este PR.
2. Site URL e redirects permitidos para o domínio canônico e retorno a `/?convite=...`, sem liberar domínios arbitrários. Retorno com parâmetro foi testado com Auth/frontend locais simulando o domínio canônico, com captura no Mailpit; a entrada Auth externa está comprovada separadamente abaixo. Não tratar a tela anterior à publicação como prova de aceite de convite persistente.
3. Aprovação da política de sete dias, papéis concedíveis e remetente/texto do convite. O Auth envia seu template de acesso; não há template transacional de convite específico nem promessa de entrega externa.

## Validação automatizada

`supabase/tests/convites.sql` usa transação revertida: identidade errada/não verificada, gestão negada a comum/outro admin, dados inválidos, duplicidade pendente, ausência de acesso/vínculo, validade, expiração, revogação, repetição, vínculo existente, concedente inativo e falha forçada do histórico com rollback completo. O histórico distingue concedente/aceitante e não há contexto privado remanescente.

`e2e/invites-real.spec.mjs` usa JWTs locais e duas sessões PostgreSQL realmente sobrepostas: observa espera por Lock, um único vínculo/evento, repetição e corrida entre revogação e aceite. Também testa vínculo existente e verificação atual de e-mail mesmo com JWT emitido antes. O navegador percorre gestão → Mailpit → primeiro acesso → Meus convites → aceite → acesso conforme papéis → recarga. Antes do aceite, Edge retorna 403 e não há navegação aos módulos. Há teste de revogação pela tela, falha de envio e viewport de 390 px sem overflow.

```sh
npm run check
npm test
npm run build
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
npx playwright test backup.spec.mjs
node scripts/transition-validation.mjs --reset-local-fixtures
```

Foram aprovados localmente tipagem, 18 unitários, builds, cinco regressões SQL, nove cenários reais, cinco simulados e backup. A transição e os checks do SHA final são conferidos no PR. Identificadores e e-mails de produção não entram em Git/CI; fixtures e capturas são fictícias.

## Publicação futura e recuperação

Somente após a homologação de Auth/e-mail, incluindo entrega externa e primeiro acesso em caixa autorizada: reconferir head/base/checks, histórico remoto (até `20261115220000`) e recuperação. Dry-run do checkout aprovado deve conter só `20261115230000_convites.sql`, sem seeds/include-all/reaplicação. Aplicar migração, conferir funções, grants e contexto privado, preservando vínculos reais. Integrar o PR e publicar frontend; confirmar SHA/deployment e domínio, sem enviar convites a integrantes/clientes. Não reaplicar #13–#16. A branch está com deploy automático desabilitado; o merge em main pode disparar a publicação. A autorização já registrada continua condicionada à homologação.

Falha na migração reverte sua transação. Depois de instalada, recuperar frontend para o #16 (`464dfa3`, deployment `dpl_4sNsxK4xhjjuYv76ZNKxfaeyBdY5`), preservando convites, vínculos aceitos, histórico e revisões. Se precisar suspender novas concessões, bloquear temporariamente a execução de criação/aceite no servidor por mudança operacional revisada; não apagar vínculos/eventos nem desabilitar auditoria. Convites pendentes devem permanecer gerenciáveis para revogação. Vínculos já aceitos não são removidos por recuperação ou revogação do convite.

## Homologação de Auth/e-mail em 15/11/2026

Candidato inicial reconferido: `dc7d7565365496f1ebfb5e184a65f3fe33670cfa`; base/main `464dfa3f80579dcc18dc739a5d0e6884f5ffa16f`. Checks desse candidato: [Interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43749384080) e [Supabase local e navegador](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43749384096), ambos aprovados. Este complemento adiciona regressão de Auth e documentação; o head final e seus próprios links de CI ficam no corpo do PR #17.

Snapshot inicial de produção, anterior à configuração de SMTP pelo usuário, sem alteração de Auth, banco ou vínculos pelo agente:

| Item | Evidência / estado |
| --- | --- |
| Vercel/domínio | READY/production, deployment `dpl_4sNsxK4xhjjuYv76ZNKxfaeyBdY5`, SHA `464dfa3f80579dcc18dc739a5d0e6884f5ffa16f`; login HTTP 200, formulário presente sem enviar e-mail |
| Supabase | Última migração `20261115220000`, três vínculos, zero eventos; `hub_invites` ausente |
| Site URL / redirects | `https://decifaz-hub.vercel.app/` nos dois campos; nenhum domínio adicional liberado nesta etapa |
| Cadastro / confirmação | Cadastro Auth habilitado; `mailer_autoconfirm=false`; confirmação de e-mail obrigatória; provedor e-mail habilitado |
| OTP | Oito dígitos, expiração 3600 s, intervalo de envio 60 s, limite de verificações 30. O limite de e-mails/h veio nulo na representação da CLI; não foi tratado como ilimitado nem homologado sob carga |
| SMTP próprio | Desativado; host, porta e remetente próprios não configurados. Nenhuma credencial foi solicitada, persistida ou impressa |
| Template e entrega externa | Pendente: não houve envio externo nem inspeção de mensagem entregue em caixa autorizada. Não assumir que o template efetivo de produção coincide com o local |

A consulta usou `supabase@3.0.0 config diff --remote=<projeto> --output-format json`, com saída capturada em memória e relatório com campos permitidos, e `db query --read-only` com contagens agregadas. Não copiar a configuração remota completa para Git/artefatos. Conforme a [documentação SMTP do Supabase](https://supabase.com/docs/guides/auth/auth-smtp), o serviço padrão restringe destinatários aos membros da organização e não substitui SMTP de produção; a documentação informa dois e-mails/h, sujeito a mudança. Não testar esse limite enviando a endereços reais.

`node scripts/local-validation.mjs` executa cinco regressões SQL e dez cenários reais, incluindo o novo `e2e/invite-auth-real.spec.mjs`. Este teste clona somente o Auth **local** em container temporário, usa o mesmo hostname canônico e allow-list raiz da configuração consultada e OTP de oito dígitos/uma hora/60 s, mantendo SMTP apontado para Mailpit. As requisições do hostname canônico são interceptadas e atendidas pelo frontend/backend locais: nenhuma requisição autenticada, conta ou convite é criado no domínio/Supabase de produção. O container é removido ao concluir.

Comprovado localmente: mensagem de confirmação capturada, conta inicialmente não verificada/sem sessão, reenvio imediato recusado com 429, retorno conserva `?convite=<id>`, confirmação torna a conta verificada, Edge ainda nega acesso e não há vínculo até clicar Aceitar. O aceite explícito libera somente o espaço/papel concedido. Um segundo cadastro direto na API, **sem convite**, verifica o e-mail e entra no Hub, mas continua com caixa vazia, sem vínculos, sem leitura de espaços, sem evento de concessão e com Edge 403. O login normal por link mágico e persistência de sessão continuam cobertos por `shared-real.spec.mjs`.

Os bloqueios do snapshot inicial foram resolvidos pela configuração de SMTP feita pelo usuário e pelas confirmações externas abaixo. O ensaio canônico local continua identificado como local, sem alegação de aceite persistente em produção.

### Homologação externa: evidências separadas

| Teste | Evidência e limite |
| --- | --- |
| A — conta administrativa existente | Única solicitação do agente às 23:28:20 UTC de 15/11/2026, cadastro desabilitado, HTTP 200. Usuário confirmou recebimento na Caixa de entrada e abertura correta dos módulos após “Sign in”; captura mostra o template padrão em inglês, remetente Decifaz Hub do domínio verificado e aviso de uso único/expiração. Mensagem também localizada pelo conector Gmail da conta autorizada. Quatro papéis e vínculos preservados por consulta agregada; não se atribui a inspeção do painel Resend ao que foi comprovado por recebimento e login. |
| B — primeiro acesso Auth sem vínculo | Antes do único envio autorizado do agente às 22:38 UTC, zero contas/vínculos para a caixa de teste. Usuário confirmou recebimento e entrada após informar o e-mail e receber outro link solicitado por ele; captura no domínio principal mostra “Esta conta ainda não faz parte do espaço de trabalho”. Consulta de produção confirmou conta verificada/com login e zero vínculos. O agente não reenviou. Isso comprova confirmação/entrada Auth e ausência de acesso automático; nenhum convite persistente, aceite ou papel real foi criado nesse teste. |

Configuração reconferida por leitura: SMTP próprio ativo, host/remetente/usuário configurados, porta 465, limite de envio 30/h, confirmação obrigatória, OTP oito dígitos/3600 s e intervalo 60 s. Template de acesso permanece em inglês; sua tradução é melhoria posterior, sem alterar links nesta publicação. Não foram feitos testes de carga, reputação de domínio ou todas as caixas/provedores; o resultado é limitado às caixas autorizadas. Tokens, destinatários, cabeçalhos com dados pessoais e capturas privadas não entram em Git/CI.

Os três vínculos reais e suas revisões continuam com o mesmo digest agregado anterior à homologação, sem eventos artificiais. A publicação pode seguir o roteiro autorizado após conferir os checks do head final. Não atribuir papéis à conta de teste como efeito da publicação; as provas mutantes de convite/aceite permanecem locais/CI. A sequência completa (convite → confirmação → aceite explícito → vínculo + evento únicos) está coberta pelos testes fictícios descritos acima, inclusive o retorno com parâmetro no hostname canônico simulado.

### Revalidação do candidato e fuso dos testes

O workflow [43777576650](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/43777576650), do complemento documental `e55e742`, falhou em `shared-real.spec.mjs:88` ao registrar envio de proposta. Reprodução local com navegador em UTC produziu a mesma falha: entre 00h e 03h UTC, o formulário assumia o dia seguinte ao dia comercial que o SQL valida em `America/Fortaleza`. A mensagem visível recusava a data, corretamente segundo a regra do servidor. As cinco regressões SQL e os testes de Convites passaram nessa execução.

O Playwright agora declara `timezoneId: 'America/Fortaleza'`, alinhando o ambiente da jornada à referência comercial já usada pelas fixtures e pelo banco. A asserção original, as regras SQL e o código do produto foram preservados; não foram adicionados retry ou espera para esconder a falha. Isso fixa o ambiente dos testes, não muda os valores padrão de datas para navegadores de usuários em outros fusos. Fora do fuso comercial, a escolha de data precisa respeitar a regra do servidor; eventual unificação dos padrões do produto deve ser tratada separadamente. O head final e seus checks ficam no PR.

## Operação de convites após a ativação

1. **Criar:** Administração → Equipe → Novo convite; informar e-mail, selecionar um ou mais papéis e escolher se solicita link de acesso. Criar convite mantém Pendente até o aceite verificado. Conferir papéis antes de enviar; para mudar um pendente, revogar e emitir outro.
2. **Reenviar:** no cartão pendente ainda válido, usar Enviar link de acesso. Não prolonga a validade do convite. Esperar o intervalo de OTP; se o link expirou, pedir outro, sem recriar o vínculo. Copiar link fornece apenas o atalho ao portal, sem autenticar nem conceder acesso por si só.
3. **Revogar:** usar Revogar convite no cartão pendente válido. O servidor impede aceite posterior. Convite aceito exige gestão de papéis na Equipe; revogar convite não retira vínculo existente.
4. **Investigar entrega:** conferir estado/prazo do convite e a mensagem da tela; uma solicitação aceita pelo Auth não comprova recebimento. Correlacionar horário e código HTTP nos logs Auth e no provedor SMTP, consultando dados sensíveis apenas nos painéis autorizados. Verificar supressão/bounce, domínio/remetente, SPF/DKIM/DMARC, spam, template de confirmação versus magic link, limites de envio/OTP e destino de retorno. Não colar destinatários, corpos com links, tokens ou credenciais no PR, Git, CI ou evidências compartilhadas.
5. Erro 429 pede aguardar o limite; erro SMTP/503 mantém o convite pendente e permite tentar novamente. Falha de histórico impede concessão e reverte a operação: corrigir a causa e tentar o aceite novamente, sem desabilitar auditoria. Se houver dúvida sobre um aceite, atualizar lista/Equipe/histórico antes de repetir. Estado Aceito e evento persistido são a prova da concessão, não o envio do e-mail.
