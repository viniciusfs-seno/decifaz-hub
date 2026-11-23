# Tela por link — funcionamento e homologação

## Perfil econômico atual — substitui limites anteriores

O #40 permanece em rascunho sobre a main `510555b` (#42/#43 publicados). Sem merge, migração remota, publicação ou contratação nesta rodada. Central, avisos internos e e-mail desligado preservados. SHA final e resultados no corpo do PR e nos artefatos imutáveis do CI correspondente.

| Limite | Valor | Aplicação e verificação |
|---|---|---|
| Sessões simultâneas | 1 em toda a instalação, entre espaços/apresentadores | `hub_screen_start` com lock transacional global antes de espaço/sessão. Inícios concorrentes: somente um vence; outro espaço recebe recusa sem identidade. Repetição do mesmo início não renova prazo. |
| Espectadores | 1 aprovado; até5 solicitações | Aprovação/entrada sob lock da sessão; regressões de segunda entrada e isolamento. |
| Duração | 5 minutos | Servidor fixa `ends_at`, host/watch/relay revalidam. Clientes oficiais fecham peer/tracks ao atingir prazo; teste reduz prazo somente na fixture e espera expiração. |
| Convite | 2 minutos | Sem novas entradas/aprovações após `invite_until`; aprovado continua somente até fim da sessão. |
| Captura | até1280×720, 5FPS | `applyConstraints` após seleção nativa, leitura de `getSettings` e rechecagem durante a captura. Ausência/recusa/excesso encerra captura. |
| Encoder | até256.000bit/s de vídeo e5FPS | `setParameters` e leitura de `getParameters` em cada peer/reconexão. `contentHint=detail`, preferência por manter resolução. Recusa encerra. |
| Autorização | watchdog15s, lease45s, RPC timeout8s | Perda de acesso/HTTP pendente interrompe mídia, com regressões fictícias. |
| Áudio | não capturado | `audio:false`, interface mantém “Áudio ainda não homologado”. Sem suporte anunciado. |

Valores conservadores para apresentações curtas de textos e sistemas: HD preserva detalhes e5FPS priorizam leitura sobre animação. Preferir aba/janela preparada e texto ampliado. A qualidade depende da fonte, movimento e rede; o novo ensaio salva um quadro de texto para inspeção de legibilidade. **Controles do navegador não garantem limite global de consumo ou faturamento**. Reiniciar sessões permite mais uso; overhead/retransmissões e corte da conta pertencem ao provedor.

O apresentador mostra configuração aceita e tempo restante. Estados distinguem captura local, espera, conexão, transmissão/recepção, reconexão e encerramento. Falha do provedor não é rotulada como franquia esgotada; saldo indisponível não vira zero. Encerrar/sair da ficha/fonte ou perder autorização libera recursos dos clientes oficiais. Revogar espectador encerra sua recepção; o apresentador pode continuar capturando localmente até encerrar/prazo.

O novo ensaio usa o **encoder do produto sem alteração pela instrumentação**, relay forçado Windows→runnerLinux, par ICE selecionado, frames/pixels, quadro de texto e capturas desktop/celular. Watchdog de4min/8MiB observados limita somente o teste. Revalida reconexão controlada, fim pelo navegador, revogação, expiração reduzida e reuso recusado. Bytes dos navegadores não são faturamento, nem devem ser somados entre pontas. Consumo ausente do provedor permanece indisponível. Região permanente segue pendente externa, sem impedir o ensaio já autorizado.

Prova histórica `62ebd6e` e seus arquivos permanecem intactos; não substituem a nova validação. `screen-release-gate` exige mídia do SHA final. Após ensaio, desligar runtime TURN e probe. Configuração privada já existente é reutilizada, sem pedir segredo novamente. Procedimento de publicação/recuperação e pendências em [revisao-publicacao-tela.md](revisao-publicacao-tela.md).

## Registro histórico anterior ao perfil econômico

As seções abaixo preservam diagnósticos e decisões dos ensaios anteriores. Seus limites30min/10min e alterações de encoder de teste foram **substituídos** pelo perfil acima; frases históricas “não executado” não descrevem o estado atual. Resultados e checks atuais ficam no PR, vinculados ao candidato. #42/#43 já foram publicados independentemente.

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

A conta Developer foi criada pelo titular, que informou não ter cadastrado cartão nem feito upgrade. A [página oficial de preços](https://xirsys.com/pricing), reconferida em22/11, confirma a continuidade gratuita, 500MB/mês e corte da franquia. **Da conta, falta somente a região permanente de testes**, cuja autoridade é o painel segundo a [documentação da API](https://docs.xirsys.com/api/introduction); não inferir essa região de uma alocação durante os primeiros30 dias. A conferência do painel não foi declarada concluída. Não é necessário repetir perguntas sobre criação da conta, cartão ou upgrade já respondidas. Nenhum compromisso financeiro ou provedor foi ativado pela implementação.

Passos que faltam:

1. Conta criada pelo titular no plano **Developer gratuito**, sem cartão ou upgrade; a região permanente continua pendente em Connect → Your Network → view, não em Account/Plans. Validar o canal exato pela API `GET /_ns?depth=100`, sem criar, renomear ou remover canais por suposição.
2. Usar configuração privada somente no servidor: `HUB_TURN_PROVIDER=xirsys`, `HUB_TURN_XIRSYS_IDENT`, `HUB_TURN_XIRSYS_SECRET`, `HUB_TURN_XIRSYS_CHANNEL`. O modelo local ignorado reaproveita o identificador informado e o canal exato. Executar diretamente `powershell.exe -NoProfile -File scripts/configure-turn-hml.ps1`: reutiliza segredo existente; só solicita entrada oculta quando ausente. A gravação local não consulta a API. Usar separadamente `-Inspect` para presença/ACL e `-ValidateApi` para confirmar o canal por leitura, sem Chrome, prompt ou gravação. Detalhes e diagnóstico abaixo. TURN e confirmação de plano continuam false; só habilitar no isolado depois da região permanente e condições verificadas. Nada em VITE ou nos exemplos contém segredo.
3. A Edge existente valida o participante na RPC antes de pedir `PUT /_turn/{canal}?webrtc=1&expire={ttl}`. TTL de até 1.800 segundos, limitado à sessão; só a configuração ICE temporária filtrada é devolvida. Expirar a credencial impede novas alocações; não encerra uma chamada existente: o encerramento/revogação do Hub continua necessário.
4. No controlador fictício, passar `relay:true` por stdin. No runner externo, configurar `HUB_SCREEN_FORCE_RELAY=true`. Ambos usam instrumentação exclusiva de teste (`iceTransportPolicy=relay`). O receptor exige **par selecionado com candidato local relay e frames decodificados avançando**, não apenas um candidato disponível. O gate exige `verified=true` e `relay_verified=true`: uma nova tentativa direta não libera esta homologação. Nenhum SDP, IP ou segredo é registrado. Repetir encerramento, recuperação, expiração, revogação e novo convite no SHA final. A prévia de tela usa variável `HUB_SCREEN_HML_PREVIEW_URL` e segredo `HUB_SCREEN_HML_REVIEW_PASSWORD`, separados dos avisos; não executar o ensaio contra a prévia de outro candidato.
5. Guardar artefatos e consumo antes/depois, sem segredos. Consultar `GET /_stats/decifazhub` para `turn:recv` e `turn:sent`, além do total da conta para estimar a franquia restante. A [API de estatísticas](https://docs.xirsys.com/api/statistics) agrega por hora: ausência de delta imediato não prova ausência de consumo; guardar o horário da consulta e reconferir após a agregação. Não iniciar se o saldo conhecido não comportar um ensaio curto; interromper a captura ao fim, sem repetição automática de tentativas de mídia. A estimativa conservadora da FAQ é cerca de15MB/minuto para dois participantes a512kbit/s: 500MB cobrem ensaios curtos, **não garantem uso diário**. Latência e região do plano gratuito também precisam de medição. Ao esgotar ou falhar, informar indisponibilidade e usar o link externo da reunião; não habilitar upgrade automático.

O adaptador Xirsys e os testes simulados estão implementados, sem ativação. Cloudflare preparado anteriormente exige aprovação financeira própria e agora tem uma trava explícita adicional; não é alternativa gratuita autorizada. ExpressTURN gratuito não foi escolhido: a [FAQ oficial](https://www.expressturn.com/) reserva a emissão por segredo compartilhado/credenciais temporárias ao Premium. Metered permanece sem homologação das condições. **Nenhum teste relay real foi realizado nesta etapa: falta confirmar a região permanente no painel e executar a prova de mídia. Áudio continua não homologado. O #40 permanece em rascunho e bloqueado para publicação.**

Regressões da configuração: `node --test tests/turn-account.test.mjs` e `powershell.exe -NoProfile -File scripts/test-turn-hidden-input.ps1`. São11 cenários fictícios: entrada oculta, reutilização sem prompt, inspeção sem valores, gravação separada da API, recusa/falha da API, guarda do git-ignore, falhas de ACL/gravação e redação de exceção com conteúdo sensível simulado. A matriz Windows executa em powershell.exe5.1 e pwsh7, sem chave nem provedor real. Nunca executar o modo interativo em CI.

Diagnóstico Impeccable: `doctor` reportou somente `design-md-sprawl`, sem falha de instalação. A prévia de `design-compact` indica11.655→4.221 bytes; não foi gravada. A tipografia oficial foi preservada e as exceções de Inter foram versionadas somente por valor/arquivo, sem `ignore-rule` ou `ignore-file`. Compactar o documento é opcional e exige aprovação específica, não é pré-requisito para a homologação de tela.

### Conferência de homologação em22/11 — região ainda não confirmada

**Autorização posterior do titular:** ensaio curto no isolado com as regiões atualmente habilitadas, reutilizando a conta Developer gratuita sem cartão/upgrade e o corte oficial da franquia. A região permanente não impede este ensaio autorizado, continua desconhecida e não pode fundamentar liberação de produção. Nenhuma contratação ou excedente é autorizado. A configuração original permanece false; só a cópia privada de runtime é ligada durante o ensaio e deve voltar a false ao final.

O controlador e receptor possuem watchdog de4 minutos, observação de bytes de transporte e corte de8MiB (cumulativo no apresentador; por página no receptor), encoder limitado a128kbit/s/5fps para vídeo e32kbit/s se houver áudio. A observação por segundo pode ter pequeno atraso; payload/overhead não equivalem a faturamento TURN. O hard cap gratuito do provedor continua necessário. Testes fictícios comprovam o corte por tempo/bytes e limitação de encoder. Falha ao aplicar limite interrompe o ensaio. Não fazer loops de tentativas de mídia. O espectador revogado deve fechar o peer antes do encerramento total da sessão; expiração usa datas reduzidas apenas na fixture. Captura usa aba fictícia e tom sintético, nunca tela/microfone dos sócios. Áudio é avaliado separadamente por tracks/amostras/energia e só pode ser anunciado se houver prova específica.

Mensagem sugerida ao suporte (não enviada): “Olá! Uso uma conta Developer gratuita, sem cartão ou upgrade. Qual será a home TURN region da minha conta após os30 dias iniciais? Onde posso consultar essa atribuição no painel? A lista atual pode refletir o trial; preciso confirmar a região permanente e que as credenciais dinâmicas permanecem disponíveis com500MB/mês e corte da franquia, sem excedente automático. Obrigado.” Não anexar API Key, credenciais TURN ou links de acesso.

O candidato `d25d4101c71a6facff563b89479e979fe42366f9` concluiu [Supabase/navegador e recuperação](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45068007724) com sucesso. No [workflow de interface](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45068007654), interface e os11 cenários de configuração passaram nos executáveis PowerShell5.1 e7; `screen-release-gate` falhou deliberadamente e `screen-external` foi pulado. Portanto o CI completo foi conferido, mas **não está integralmente verde nem libera mídia**. Novos commits precisam dos próprios checks, registrados no PR.

Corrigindo a orientação anterior: para consultar regiões, abrir [Xirsys Dashboard](https://global.xirsys.net/) → **Connect → Your Network → view**. Esse é o cartão e diálogo de regiões documentados no [guia oficial](https://docs.xirsys.com/dashboard#your-network). **Account → Plan** mostra plano/franquia; **Plans** é comparação/upgrade e não deve ser usado para alterar assinatura nesta homologação. Não clicar em Update Plan nem cadastrar pagamento. Se o diálogo listar todas as regiões durante os30 dias iniciais sem indicar a home region permanente, essa lista temporária não confirma a região pós-trial; esclarecer esse ponto no suporte do provedor, sem enviar chave. Basta registrar a região, nunca copiar o bloco API Key ou iceServers.

A janela Xirsys está aberta, porém o inventário de22/11 retornou `The browser access host is unavailable`. Não foi possível ler a configuração da conta por automação do navegador. A API pública de canais não informa a home region; uma emissão temporária durante o trial também não a prova. As condições gerais gratuitas foram reconferidas na documentação, mas **a região desta conta continua desconhecida**. O arquivo local foi reutilizado, permanece ignorado/privado e com TURN/confirmacão de plano false. Não há nova solicitação de segredo nem alocação TURN.

Medição somente por leitura: `node scripts/turn-usage.mjs` consulta `turn:recv` e `turn:sent` da conta e do canal no mês UTC atual, com timeout, sem repetição automática. A saída contém somente métricas numéricas ou códigos sanitizados, sem headers, nomes de conta, credenciais ou resposta bruta. Em22/11 a API respondeu HTTP200, envelope ok e arrays vazios nos quatro agregados. Isso é **consumo indisponível**, não franquia comprovadamente intacta; o script retorna código1. Não repetir a mesma consulta esperando resultado diferente sem nova hipótese ou nova janela de agregação. Estatísticas são horárias; delta imediato vazio/zero não prova ausência de tráfego. Comparar futuras consultas com Analytics → Report Dates → Report Target → Bandwidth, que também tem atraso.

Nenhum ensaio de mídia com TURN foi iniciado nesta conferência. Após confirmar a região, preparar um único ensaio curto com teto de duração e tráfego observados, encoder limitado e encerramento independente; exigir margem conhecida na franquia e guardar snapshots antes/depois. Falta de métrica ou corte deve aparecer como limite, sem anunciar cobrança zero medida nem consumo zero. Não repetir um cenário ICE sem hipótese nova. Vídeo entre redes, relay selecionado, reconexão, encerramento, expiração/revogação e áudio permanecem pendentes **no SHA final**. Áudio deve continuar indicado como não homologado. #42/#43 não dependem dessa informação e continuam sem publicação.

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

### Situação atual da configuração relay

A preparação Cloudflare descrita nesta reprodução é histórica: não é o procedimento vigente nem uma solicitação de nova conta. O adaptador atual também suporta Xirsys, escolhido para o ensaio gratuito. Seguir somente os passos Xirsys acima: entrada oculta local, validação do canal pela API, região permanente, consumo e ensaio isolado com relay forçado. O plano, conta sem cartão e canal informado pelo titular não precisam ser perguntados novamente. A migração continua exclusivamente local; nenhuma evidência anterior libera mídia de um SHA novo.

Só depois de mídia/encerramento/expiração/reuso aprovados e limites visíveis, pedir revisão de publicação. Ordem futura com relay: banco → Edge compatível → frontend. Desligar relay recupera apenas tentativa direta; se a rede exige retransmissão, usar chamada externa. Preservar todos os dados e restrições.

O usuário não precisa repetir teste manual no portal. Enquanto faltar esse recurso ou o ensaio externo completo falhar, situação objetiva: **bloqueado para publicação**, PR em rascunho. O resultado de áudio permanece não homologado após nova tentativa isolada de tom no Chromium headless em 22/11.

## Evidência ampliada e correção da regressão de busca

O candidato 79298ea347d5b35fb5090df7de1fb9f6390563f0 passou no [ensaio completo entre redes](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45024305172/job/137213831224): apresentador Chromium Windows com captura nativa e receptor Chromium Linux no runner GitHub. Frames/pixels avançando, perda deliberada do peer e retomada com nova geração, prazo do convite, encerramento pelo navegador, recusa de reuso, nova sessão e prazo da sessão com tracks encerradas. Tipos remotos srflx, um par bem-sucedido por geração, zero candidatos recusados; não houve relay. O gate de mídia passou. Viewports desktop/claro e celular/escuro possuem capturas no artefato tela-recebida-entre-redes, sem convites ou dados reais.

O [CI completo desse SHA](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45024305234) teve 48 cenários aprovados e uma falha em busca global: a asserção procurava o valor financeiro 180 em todo o JSON e encontrou esses dígitos dentro de um UUID fictício. A correção mantém a lista exata de campos permitidos e a verificação financeira no conteúdo retornado (título/detalhe); adiciona um UUID deliberadamente com 180/2400 para reproduzir o falso positivo. Não altera a busca ou suas permissões e não resolve a falha apenas reexecutando até passar.

O ensaio de recuperação foi ajustado para usar **exatamente o frontend #41 (100dc1a)**, em vez do pai do primeiro protótipo de tela. A partir dessa correção, o head seguinte precisa dos próprios checks e de nova prova de mídia. O PR registra o SHA final e os links desses resultados; a prova 79298ea não é herdada automaticamente.

## Diagnóstico e execução direta no Windows

Não é necessário RTK nem terminal elevado. Na raiz do repositório:

```powershell
# Somente presença dos seis campos, flags de segurança, versão e proteção da ACL
powershell.exe -NoProfile -File scripts/configure-turn-hml.ps1 -Inspect

# Reutiliza segredo salvo; recusa se ausente, sem solicitar nova entrada
powershell.exe -NoProfile -File scripts/configure-turn-hml.ps1 -NoPrompt

# Somente consulta de canais; não altera arquivo, ACL, conta ou TURN
powershell.exe -NoProfile -File scripts/configure-turn-hml.ps1 -ValidateApi
```

Somente no primeiro preenchimento, se o segredo estiver realmente ausente, executar sem os switches para usar `Read-Host -AsSecureString`. Nunca fornecer segredo em argumento. O comando local restringe o arquivo ao usuário atual e SYSTEM, mantém flags falsas e relê o conteúdo para comprovar a gravação. Não há envio automático nem alocação TURN. A inspeção nunca corrige/escreve; a validação de API nunca pede segredo.

Cada etapa imprime JSON sanitizado: git_ignore, read_local, acl_read, secret_input, acl_build, acl_apply, acl_verify, file_write, file_verify e local_complete; api_query é separado. Falhas locais incluem tipo da exceção externa e causa, HRESULT/código numérico e nome de privilégio somente se conhecido. Nunca imprimir Message, ErrorRecord, TargetObject, stack, cabeçalhos ou resposta bruta. Erros de provedor usam códigos limitados, sem corpo privado. O processo retorna código1 em falha.

Em22/11, reproduzido em Windows PowerShell5.1.26100.8655: `Set-Acl` na etapa acl_apply tentou usar **SeSecurityPrivilege** e lançou `System.Security.AccessControl.PrivilegeNotHeldException`, HRESULT **0x80070005**. O segredo já estava presente; esse erro não prova perda da gravação anterior. O tratamento antigo ocultava a etapa, por isso não se pode reconstruir a primeira tentativa apenas pelo Write-Error genérico.

Correção: persistir exclusivamente a DACL com APIs .NET usando AccessControlSections.Access, sem alterar proprietário, grupo ou SACL/auditoria; identificar SYSTEM por SID, sem depender de idioma. Não solicitar administrador nem ampliar privilégios. No arquivo existente, acl_apply/acl_verify/file_write/file_verify passaram em5.1, sem redigitar segredo. Consulta real separada confirmou o canal; todos os campos presentes, TURN desligado e plano ainda não habilitado. Essa evidência não comprova mídia nem região permanente.
