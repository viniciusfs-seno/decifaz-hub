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
