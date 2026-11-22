# Tela por link — funcionamento e homologação

## Estado e limite de publicação

O [PR #40](https://github.com/viniciusfs-seno/decifaz-hub/pull/40) permanece em rascunho, separado do acabamento #41 publicado na main 100dc1ace52e1bd39d10d1fe39bbc3697bc15ec9. Nesta rodada: **sem merge, migração remota ou frontend em produção**. Migração aditiva: 20261121020000_tela_por_link.sql, após 20261121010000.

A liberação exige mídia real entre redes no SHA final. O job **screen-release-gate** exige sucesso de screen-external **e** verified=true emitido após todas as asserções. Job pulado, acesso HTTPS e vídeo local não aprovam transmissão. SHAs e checks exatos ficam no corpo atualizado do PR e nos artefatos desse candidato.

## Fluxo, limites e privacidade

Projeto → Reuniões → Preparar / registrar ata → Compartilhar tela por link. Administração ou Operação escolhe a fonte no seletor nativo, copia o convite e aprova o espectador. O nome é autodeclarado: confirme a identidade por outro canal. Preferir uma aba preparada; tela inteira pode revelar notas/notificações da própria fonte.

O espectador abre /assistir, informa o nome e aguarda aprovação. Recebe apenas a captura, sem sessão Auth, papel, vínculo ou navegação do Hub. Um apresentador e um espectador aprovado por sessão. Estados distinguem captura local, conexão e transmissão. Encerrar, sair da ficha, remover o espectador ou encerrar a fonte interrompe a mídia. A chamada externa permanece alternativa; não é videoconferência completa, câmera, microfone ou gravação.

Convite: dez minutos para novas entradas/aprovações. Sessão: até trinta minutos. Lease: 45 segundos sem confirmação. RPC: timeout de oito segundos. Watchdog independente interrompe captura/recepção após quinze segundos sem confirmação, inclusive com HTTP pendente. Convite vencido não derruba quem já foi aprovado; sessão vencida encerra a captura. Recarregar perde a credencial em memória e requer novo convite.

WebRTC direto no próprio módulo, sem SDK ou servidor de vídeo novo: menor complexidade para 1:1. Sinalização REST/RPC no Supabase; vídeo não passa pela Vercel. hub_screen_start exige integrante ativo com Administração ou Operação e reunião de projeto no próprio espaço. hub_screen_host revalida acesso. hub_screen_watch é uma capacidade anônima de 256 bits, entrada limitada e aprovação explícita, sem consulta aos registros do portal. Tabelas privadas, sem grants diretos do app; vínculo desativado é recusado pelo banco.

Credencial em fragmento, removida da barra antes de iniciar o visualizador; somente memória no cliente, hash no servidor. Não persistir convite na reunião, auditoria, analytics, argumentos, logs ou artefatos. Não registrar corpos das RPCs, SDP, ICE bruto, endereços ou nomes de fontes. Visualizador usa cliente independente sem persistir Auth. Envelopes são apagados ao encerrar.

Início/encerramento administrativos são gravados na mesma transação, sem mídia. Prazo, lease, perda de autorização e varredura usam encerramento automático com ator nulo; não atribuir timeout ao usuário que inicia a próxima sessão. Falha na auditoria reverte a operação. Cada RPC confere prazo. Nova sessão varre até vinte expiradas e remove envelopes encerrados há mais de um dia. Sem cron: limpeza física pode aguardar tráfego, sem estender autorização.

WebRTC não é DRM: não apaga frames recebidos nem impede gravação pelo espectador. Encerramento interrompe clientes oficiais; não se promete corte central contra clientes modificados que já negociaram mídia direta.

## Diagnóstico demonstrado

| Etapa | Evidência e correção | Limite |
| --- | --- | --- |
| Autorização/gateway | Regressões: anônimo, outro espaço, integrante desativado, aprovação e prazos. Runtime Edge parado após retomada do Docker causou falha local de acesso; inicializador agora restaura o container local. | Infraestrutura local não é diagnóstico de ICE. |
| SDP | Regressão rejeita a primeira descrição remota, depois exige mídia. Falha transitória refaz negociação. | Não atribuir todas as falhas antigas sem traço original. |
| ICE | Encontrados retorno sem callback ICE e candidatos descobertos após fotografia fixa do SDP. Corrigidos com trickle nos dois sentidos; teste atrasa retorno sete segundos e exige candidatos de ambos. | Vídeo local por rota reflexiva podia mascarar retorno ausente. |
| Histórico | [773eecd](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44948653615): HTTP respondeu e ICE não conectou. Fotografia final não distinguia aplicação de candidatos/troca de geração. | Causa exata de cada falha antiga inconclusiva; não prova necessidade de TURN. |
| Mídia externa anterior | [e167ddf](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44952791696): captura nativa Windows → Chromium no runner GitHub, vídeo decodificado e encerramento, sem TURN. [Banco aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44952791697). | Não substitui ensaio ampliado no candidato final. |

O helper screen-diagnostics é somente de testes. Permite contagens de descrições aplicadas, ICE aceito/recusado, tipos, estados, incompatibilidades e frames. Exclui SDP, IP, credencial, URL, rótulo de track e erro bruto. Teste com sentinelas verifica privacidade. Separar falha de negociação, ICE sem rota e mídia sem frames.

## Ensaios e evidência

- npm run check; npm test; builds demo/compartilhado; scripts/security-review.mjs.
- node scripts/local-validation.mjs screen-link-real.spec.mjs --workers=1: dez regressões SQL e quatro cenários de tela. Cancelamento/incompatibilidade, fonte encerrada durante gravação, HTTP pendente, autorização, espaço, prazos, repetição, limites ICE, auditoria atômica e desativação. Captura nativa em cenário próprio; canvas controlado é identificado separadamente.
- node scripts/screen-upgrade-validation.mjs --reset-local-fixtures: **somente descartável e com prévia parada**. Baseline 20261121010000 → dry-run exclusivo → migração → frontend anterior/candidato/recuperação, registros/restrições preservados. CI também executa regressões anteriores.
- scripts/screen-presenter-probe.mjs: configuração por stdin, gateway isolado; cada edição de prazo é vinculada ao espaço fictício. Captura nativa no Chromium completo, seletor automático de aba somente no teste; API nativa não substituída.
- scripts/screen-external-viewer.mjs: runner remoto exige mesmo SHA, frames decodificados avançando e pixels mudando. Fecha deliberadamente peer receptor, exige nova geração e vídeo; induz expiração de convite/sessão na fixture; recusa entrada/reuso; encerra fonte pelo navegador; exige segunda captura/sessão. Perda controlada de transporte **não é** queda física do roteador.
- Gateway, Auth e APIs da prévia usam somente Supabase local fictício. Probe/coordenação em memória, protegidos pelo cookie de revisão, nunca em produção. Senha no secret do CI/memória, fora do Git. Habilitar HUB_SCREEN_PROBE_ENABLED somente durante ensaio assistido. Artefato identifica SHA; execução na mesma máquina tem crossNetwork=false.

Chromium completo Windows para apresentação, Chromium Linux no GitHub para recepção. Shell headless recusou captura; não generalizar para navegador completo. Viewport celular/escuro avalia layout, não aparelho físico/Safari. Track de áudio observada e tentativa de tom sem comprovar som útil recebido: **áudio não homologado**. Não anunciar combinações não comprovadas, nem funcionamento universal em VPN/NAT corporativo.

## TURN: pesquisa e dependências

### Homologação gratuita solicitada em 22/11/2026

Opção preparada: **Xirsys Developer**, ainda **não configurada nem homologada**. A [página oficial de preços](https://xirsys.com/pricing) distingue o período inicial de 30 dias do plano contínuo: depois dele a conta continua gratuita, com uma região de testes, dois canais e **500 MB/mês com bloqueio rígido**. A [FAQ](https://xirsys.com/faq) informa que a retransmissão para ao atingir a franquia e volta no primeiro dia do mês; excedente cobrável é dos planos pagos. A [API oficial](https://docs.xirsys.com/api/turn) mantém credenciais dinâmicas no gratuito após os 30 dias; credenciais estáticas e múltiplas regiões não são pressupostos da integração.

A conta Developer foi criada pelo titular, que informou não ter cadastrado cartão nem feito upgrade. **Ainda falta confirmar no painel a franquia, a região permanente e a ausência de assinatura/excedente habilitado.** A janela Xirsys está disponível no computador, mas o host de acesso ao navegador está indisponível; a conferência não foi declarada concluída. Os [termos gerais](https://xirsys.com/terms) mencionam excedentes conforme o plano; não substituir a confirmação da exceção gratuita pela leitura isolada desses termos. Nenhum compromisso financeiro ou provedor foi ativado pela implementação.

Passos que faltam:

1. Conta criada pelo titular; conferir o plano **Developer gratuito** em https://global.xirsys.net/ (Account/Plans) e a região de testes que permanecerá após os 30 dias. Validar o canal exato pela API `GET /_ns?depth=100`, sem criar, renomear ou remover canais por suposição.
2. Disponibilizar ident/secret/canal por mecanismo privado no servidor de homologação. Variáveis somente servidor: `HUB_TURN_PROVIDER=xirsys`, `HUB_TURN_XIRSYS_IDENT`, `HUB_TURN_XIRSYS_SECRET`, `HUB_TURN_XIRSYS_CHANNEL`. Exemplo sem valores em `supabase/functions/.env.example`. O destino local `.validation/turn-xirsys.env` foi confirmado como ignorado antes de criar o modelo; o identificador informado foi reaproveitado somente nesse arquivo local, fora do Git. Executar `rtk proxy powershell -NoProfile -File scripts/configure-turn-hml.ps1`: solicita **somente o segredo**, com `Read-Host -AsSecureString`, sem argumento nem histórico de comandos, restringe a ACL do arquivo ao usuário/SYSTEM e salva com TURN desligado. Em seguida chama `scripts/turn-account-validation.mjs`, que faz apenas `GET /_ns?depth=100`, confirma o canal exato e imprime somente códigos/resultados sem valores privados. O nome alternativo não é criado nem presumido. Para repetir a consulta sem digitar novamente: `rtk proxy node scripts/turn-account-validation.mjs`. A API de canais não confirma plano ou região permanente; pedir somente a região de testes pós30 dias que constar no painel se ela não estiver disponível na API/documentação. Só após conferir as condições: `HUB_TURN_FREE_PLAN_CONFIRMED=true` e `HUB_TURN_ENABLED=true` **no ambiente isolado**. Não há chaves no frontend nem valores nos exemplos.
3. A Edge existente valida o participante na RPC antes de pedir `PUT /_turn/{canal}?webrtc=1&expire={ttl}`. TTL de até 1.800 segundos, limitado à sessão; só a configuração ICE temporária filtrada é devolvida. Expirar a credencial impede novas alocações; não encerra uma chamada existente: o encerramento/revogação do Hub continua necessário.
4. No controlador fictício, passar `relay:true` por stdin. No runner externo, configurar `HUB_SCREEN_FORCE_RELAY=true`. Ambos usam instrumentação exclusiva de teste (`iceTransportPolicy=relay`). O receptor exige **par selecionado com candidato local relay e frames decodificados avançando**, não apenas um candidato disponível. O gate exige `verified=true` e `relay_verified=true`: uma nova tentativa direta não libera esta homologação. Nenhum SDP, IP ou segredo é registrado. Repetir encerramento, recuperação, expiração, revogação e novo convite no SHA final. A prévia de tela usa variável `HUB_SCREEN_HML_PREVIEW_URL` e segredo `HUB_SCREEN_HML_REVIEW_PASSWORD`, separados dos avisos; não executar o ensaio contra a prévia de outro candidato.
5. Guardar artefatos e consumo antes/depois, sem segredos. A estimativa conservadora da FAQ é cerca de 15 MB/minuto para dois participantes a 512 kbit/s: 500 MB cobrem ensaios curtos, **não garantem uso diário**. Latência e região do plano gratuito também precisam de medição. Ao esgotar ou falhar, informar indisponibilidade e usar o link externo da reunião; não habilitar upgrade automático.

O adaptador Xirsys e os testes simulados estão implementados, sem ativação. Cloudflare preparado anteriormente exige aprovação financeira própria e agora tem uma trava explícita adicional; não é alternativa gratuita autorizada. ExpressTURN gratuito não foi escolhido: a [FAQ oficial](https://www.expressturn.com/) reserva a emissão por segredo compartilhado/credenciais temporárias ao Premium. Metered permanece sem homologação das condições. **Nenhum teste relay real foi realizado nesta etapa: faltam configuração segura e confirmação do painel. Áudio continua não homologado. O #40 permanece em rascunho e bloqueado para publicação.**

Regressões da configuração: `node --test tests/turn-account.test.mjs` usa provedor e segredo fictícios; `powershell -NoProfile -File scripts/test-turn-hidden-input.ps1` usa outro repositório local fictício, exige entrada mascarada, ACL privada, flags falsas, chamada do validador e bloqueio antes de solicitar/gravar segredo quando o arquivo não está ignorado. Este último também roda no check Windows, sem chamar a API real. Nunca executar o comando interativo em CI.

Diagnóstico Impeccable: `doctor` reportou somente `design-md-sprawl`, sem falha de instalação. A prévia de `design-compact` indica11.655→4.221 bytes; não foi gravada. A tipografia oficial foi preservada e as exceções de Inter foram versionadas somente por valor/arquivo, sem `ignore-rule` ou `ignore-file`. Compactar o documento é opcional e exige aprovação específica, não é pré-requisito para a homologação de tela.

Consultado em 22/11/2026, sem cadastro, cartão, ativação ou contratação. O par externo já recebeu mídia sem TURN; retransmissão não foi demonstrada necessária para esse par.

| Opção | Condições atuais | Decisão |
| --- | --- | --- |
| [Cloudflare](https://developers.cloudflare.com/realtime/turn/faq/) | STUN gratuito/ilimitado. TURN: franquia de 1.000 GB compartilhada; excedente US$ 0,05/GB; self-service com cartão. | Somente STUN em uso. Aprovar cobrança antes de ativar TURN. |
| [Metered](https://www.metered.ca/pricing) | Trial 500 MB/mês entrada+saída, sem cartão. Growth US$ 99/mês, 150 GB, excedente US$ 0,40/GB. Preços e [documentação de API](https://www.metered.ca/docs/turn-rest-api/get-credentials-v2/) divergem sobre acesso no free. | Não configurado. Confirmar API temporária e quota com bloqueio rígido antes de recomendar conta. |
| Coturn próprio | Servidor público, portas, TLS, banda e operação. | Infraestrutura não disponível; custo zero não presumido. |

Se outra rede falhar com SDP/ICE aplicado, testar relay para distinguir falta de rota de defeito. Integração futura: endpoint servidor valida apresentador/sessão ou capacidade de espectador aprovado, aplica rate limit e devolve apenas credenciais TTL curto limitado à sessão. Segredo permanente no secret manager, resposta no-store e sem logs. [Cloudflare documenta emissão server-side](https://developers.cloudflare.com/realtime/turn/generate-credentials/). Não habilitar nem pôr segredo permanente no frontend.

## Publicação futura e recuperação

Só após revisão/autorização: conferir main/candidato/checks → dry-run remoto contendo apenas 20261121020000 → aplicar/verificar funções, grants, tabelas e auditoria sem alterar vínculos reais → merge/frontend → confirmar Vercel READY/SHA e canonical /assistir. Rewrite SPA restrito a /assistir. A versão direta tolera ausência da Edge; o relay opcional preparado exige hub-screen-ice antes do frontend quando for habilitado.

Recuperar frontend do #41, SHA 100dc1ace52e1bd39d10d1fe39bbc3697bc15ec9, deployment dpl_AdADcyizc8PaFZatue6ed97JrXNj. Encerrar sessões pelo caminho administrativo; abandonadas perdem lease. Preservar migração, auditoria, restrições financeiras, membros e documentos. Não reabrir grants nem apagar registros. **Nada aplicado em produção nesta rodada.**

Prévia temporária: gateway expira em 24 horas e depende da máquina, Docker e cloudflared. A URL/validade ativas são informadas na entrega; nunca gravar sua senha no repositório.

## Reprodução de 22/11 e preparação de relay

No SHA d918788ef51e156d75b5b0b8bda5674938818cb4, o [ensaio remoto](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45022971883) falhou em first-negotiation. Receptor: três gerações, SDP remoto/local aplicado em todas, oito candidatos aceitos por geração, zero recusas e zero incompatibilidades de ufrag/mid. Apresentador: resposta aplicada e candidatos do receptor aceitos sem erro. Amostra de ICE mostrou dois pares, nenhum bem-sucedido, zero frames. A falha demonstrada fica **na conectividade ICE, depois da autorização/sinalização/SDP**. Não há evidência de erro de aplicação de candidatos nessa tentativa; tampouco foi comprovado qual NAT/firewall/rota a impede. O teste anterior e167ddf passou sem TURN, portanto a conectividade direta é dependente do par de redes, não uma garantia.

O ensaio ampliado na **mesma máquina**, antes do teste remoto, passou: pixels/frames, perda deliberada do peer e reconexão, vencimento de convite, fim da fonte, reuso negado, segunda captura e prazo da sessão com tracks paradas. Não aprova redes distintas. O gate falhou corretamente junto à mídia; o histórico de falha foi preservado.

Foi preparada uma integração TURN **desativada**, não homologada com provedor real:
- Edge opcional hub-screen-ice; HUB_TURN_ENABLED ausente/false não consulta provedor.
- Segredos exclusivos do servidor: HUB_TURN_KEY_ID e HUB_TURN_API_TOKEN. Nunca variáveis VITE, args de processos, Git ou logs.
- A Edge usa a RPC hub_screen_relay com o JWT original do apresentador ou capacidade do espectador já aprovado; não usa service_role para contornar autorização. A RPC confere papel ativo, sessão, lease, encerramento e capacidade; lock serializa emissão e limita uma por participante a cada trinta segundos. TTL de no máximo trinta minutos, limitado ao restante da sessão.
- Frontend pede credenciais após aprovação, guarda apenas em memória da sessão e reutiliza em renegociação. Falha/desativação do emissor conserva STUN e informa alternativa externa; disponibilizar relay não significa afirmar que ele foi a rota escolhida.
- Unitários usam fetch/provedor **simulado**, chaves temporárias aleatórias e respostas filtradas; não comprovam TURN externo. SQL/API cobrem pendente, anônimo sem capacidade, integrante não apresentador, papel restrito, capacidade incorreta, concorrência de emissão e sessão encerrada. A Edge local foi invocada com relay desligado, sem acesso ao provedor.
- Credenciais emitidas não são DRM nem revogação central de tráfego malicioso: clientes oficiais encerram por autorização/lease; credenciais expiram. Configurar limite rígido de uso do provedor antes da ativação; limite da RPC não é teto financeiro.

### Configuração que falta para um ensaio relay

1. Escolher e aprovar provedor/plano **sem presumir ausência de cobrança**. Cloudflare self-service requer cartão e pode cobrar excedente; não foi ativado. Metered free precisa confirmar acesso à API temporária e bloqueio da quota (documentação divergente). Não há conta TURN conectada disponível nesta rodada.
2. Criar chave TURN e armazenar ID/token no secret manager do **ambiente isolado**, por mecanismo privado; não enviar segredo no chat nem incluir no frontend. Esta implementação preparada usa a API Cloudflare, não promete compatibilidade Metered sem adaptação.
3. Aplicar a migração somente no descartável, servir hub-screen-ice e habilitar HUB_TURN_ENABLED apenas ali. Fazer teste com rota relay forçada por instrumentação de teste, validar candidato selecionado relay e frames; repetir fluxo completo entre redes no SHA final, sem relaxar gate.
4. Só depois de mídia/encerramento/expiração/reuso aprovados e limites visíveis, pedir revisão de publicação. Ordem futura com relay: banco → Edge compatível → frontend. Desligar relay recupera apenas tentativa direta; se a rede exige retransmissão, usar chamada externa. Preservar todos os dados e restrições.

O usuário não precisa repetir teste manual no portal. Enquanto faltar esse recurso ou o ensaio externo completo falhar, situação objetiva: **bloqueado para publicação**, PR em rascunho. O resultado de áudio permanece não homologado após nova tentativa isolada de tom no Chromium headless em 22/11.

## Evidência ampliada e correção da regressão de busca

O candidato 79298ea347d5b35fb5090df7de1fb9f6390563f0 passou no [ensaio completo entre redes](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45024305172/job/137213831224): apresentador Chromium Windows com captura nativa e receptor Chromium Linux no runner GitHub. Frames/pixels avançando, perda deliberada do peer e retomada com nova geração, prazo do convite, encerramento pelo navegador, recusa de reuso, nova sessão e prazo da sessão com tracks encerradas. Tipos remotos srflx, um par bem-sucedido por geração, zero candidatos recusados; não houve relay. O gate de mídia passou. Viewports desktop/claro e celular/escuro possuem capturas no artefato tela-recebida-entre-redes, sem convites ou dados reais.

O [CI completo desse SHA](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45024305234) teve 48 cenários aprovados e uma falha em busca global: a asserção procurava o valor financeiro 180 em todo o JSON e encontrou esses dígitos dentro de um UUID fictício. A correção mantém a lista exata de campos permitidos e a verificação financeira no conteúdo retornado (título/detalhe); adiciona um UUID deliberadamente com 180/2400 para reproduzir o falso positivo. Não altera a busca ou suas permissões e não resolve a falha apenas reexecutando até passar.

O ensaio de recuperação foi ajustado para usar **exatamente o frontend #41 (100dc1a)**, em vez do pai do primeiro protótipo de tela. A partir dessa correção, o head seguinte precisa dos próprios checks e de nova prova de mídia. O PR registra o SHA final e os links desses resultados; a prova 79298ea não é herdada automaticamente.
