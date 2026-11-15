# Convites em Administração → Equipe

Entrega em PR separado, em rascunho, sobre a main com #16 publicado (`464dfa3f80579dcc18dc739a5d0e6884f5ffa16f`). A migração `20261115230000_convites.sql`, frontend e fluxo de e-mail desta entrega não foram publicados. Testes mutantes e envios usam somente Supabase/Mailpit locais e endereços fictícios; nenhum destinatário real foi acionado.

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

Para ativar em produção ainda é necessário revisar e homologar:

1. SMTP/remetente e templates Auth para destinatários novos, confirmação de e-mail, limites de envio/cadastros e eventual CAPTCHA. Nenhuma configuração Auth de produção foi alterada por este PR.
2. Site URL e redirects permitidos para o domínio canônico e retorno a `/?convite=...`, sem liberar domínios arbitrários. Testado em `127.0.0.1:4181`, com captura no Mailpit `127.0.0.1:54324`; envio externo, reputação/entregabilidade e templates reais **não foram testados**.
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

Somente após revisão/autorização do novo PR: reconferir head/base/checks, histórico remoto (até `20261115220000`) e recuperação. Dry-run do checkout aprovado deve conter só `20261115230000_convites.sql`, sem seeds/include-all/reaplicação. Aplicar migração, conferir funções, grants e contexto privado, preservando vínculos reais. Homologar a configuração Auth/e-mail e publicar frontend; confirmar SHA/deployment e fluxo em ambiente de homologação com contas fictícias antes de liberar envios. Não reaplicar #13–#16. A branch está com deploy automático desabilitado.

Falha na migração reverte sua transação. Depois de instalada, recuperar frontend para o #16 (`464dfa3`, deployment `dpl_4sNsxK4xhjjuYv76ZNKxfaeyBdY5`), preservando convites, vínculos aceitos, histórico e revisões. Se precisar suspender novas concessões, bloquear temporariamente a execução de criação/aceite no servidor por mudança operacional revisada; não apagar vínculos/eventos nem desabilitar auditoria. Convites pendentes devem permanecer gerenciáveis para revogação. Vínculos já aceitos não são removidos por recuperação ou revogação do convite.
