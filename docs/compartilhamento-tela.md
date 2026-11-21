# Tela por link — estudo e homologação

## Referências conferidas

Consultadas em 21/11/2026, por HTTP e navegador isolado. Nenhum código desses projetos foi copiado ou adaptado.

| Referência | Implementação observada | Licença e dependências |
|---|---|---|
| [Artigo](https://www.luannzin.com/writing/your-screen-as-a-link) e [Sightline](https://sightline.luannzin.com/) | Captura nativa, convite e visualizador enxuto; sinalização via Trystero/Nostr, mídia WebRTC. TURN próprio opcional, não fornecido pelo site | [Snapshot `6a0ed32`](https://github.com/luannzin/sightline/tree/6a0ed32490393cde9701276a22299019e7fc51f2): React, Base UI, Trystero, Tailwind, Vite/Bun. Não há arquivo LICENSE nem declaração de licença no pacote examinado; usar somente como referência de experiência |
| [TelaLink](https://github.com/maya-gc/telalink) | Servidor Node HTTP/WebSocket local, túnel externo, sinalização e retransmissão cifrada; limite no servidor de 50 espectadores, com TURN opcional | [Snapshot `5539c0e`](https://github.com/maya-gc/telalink/tree/5539c0eaad0a934f786e07575b8fa73e0f3a579c): pacote/README declaram MIT, mas não foi encontrado arquivo LICENSE completo na raiz. Sem dependências npm de produção; distribuição inclui QR e launchers Node/cloudflared. Não reutilizado |

Licenças de bibliotecas não concedem automaticamente licença ao código dos aplicativos. A implementação do Hub é própria, baseada nas APIs padronizadas do navegador e nos contratos existentes do Supabase. Não se adota alegação de segurança, latência ou compatibilidade de uma referência sem teste próprio.

## Decisão técnica

Primeiro provar captura e recepção nativas em dois processos de navegador. Depois integrar o apresentador à reunião do projeto e manter o espectador numa rota exclusiva, sem sessão do Hub. Sinalização pelo Supabase já utilizado; mídia WebRTC entre os participantes. Isso evita novo servidor WebSocket, executável no computador dos sócios e contratação. Um módulo de mídia separado ou serviço externo permanece alternativa se as redes exigirem retransmissão.

Primeira versão: um apresentador autenticado, um espectador aprovado por vez. O link é uma credencial temporária; não é convite de integrante nem concede papel ou vínculo. Entrada sujeita a aprovação do apresentador, nome do espectador autodeclarado. Encerrar revoga a sessão. Credencial em fragmento, removida da barra após leitura, mantida apenas em memória; nunca na reunião, auditoria ou telemetria. Registrar apenas início/encerramento administrativos, sem SDP, ICE, nomes de janelas ou conteúdo da captura.

## Rede, dependências e custos

- [WebRTC](https://webrtc.org/getting-started/peer-connections) exige sinalização; STUN auxilia descobrir candidatos, mas não retransmite mídia. O REST/RPC do Supabase existente pode transportar a negociação, sem passar o vídeo pela Vercel.
- [STUN Cloudflare](https://developers.cloudflare.com/realtime/turn/faq/) é declarado gratuito e ilimitado, sem garantia de conectividade universal. A mídia direta usa banda dos participantes. O Supabase continua sujeito às cotas do projeto existente.
- Não há TURN provisionado nesta entrega. Redes corporativas, VPNs ou certos NATs de operadora podem impedir conexão direta; nesses casos, usar o link da chamada externa.
- [TURN Cloudflare](https://developers.cloudflare.com/realtime/sfu/platform/pricing/) publica franquia compartilhada de 1.000 GB/mês e US$ 0,05/GB excedente. Exige conta/configuração; não foi contratado ou ativado. Mesmo com franquia, eventual cobrança exige aprovação. Coturn próprio requer servidor, tráfego e operação; não é infraestrutura gratuita presumida.
- Sem SFU, gravação ou retransmissão pelo Hub. O limite de participantes do protótipo do Hub não deriva do limite do TelaLink. Nenhum compromisso pago foi assumido.

## Evidência inicial isolada

`node scripts/screen-prototype-validation.mjs`: captura real por `getDisplayMedia` numa aba fictícia, WebRTC em dois processos Chromium, frames decodificados e pixels mudando no receptor. Fechar a aba capturada encerra a track. SDP, candidatos e credenciais permanecem em memória; resultado em `.validation/screen-prototype/result.json`, sem endereços de rede ou identificadores pessoais.

O Chromium headless shell recusou captura com `NotSupportedError`; o Chromium completo em modo headless funcionou. A seleção automática de aba existe somente no teste e aponta para fonte fictícia; em uso normal, o navegador exige gesto e escolha do apresentador. Foi observada uma track de áudio, sem comprovação de som útil nesta primeira execução. Essa execução é **no mesmo computador**, não comprova redes distintas, NAT restritivo, aparelho físico ou suporte de áudio em outros navegadores.

## Critérios de publicação

Manter rascunho até implementar autorização/entrada, expiração, encerramento, desconexão/retomada e evidência no receptor. Testar link expirado/reutilizado, papéis, espaço e integrante desativado. Prévia isolada protegida e jornada externa devem ser verificadas. Evidência entre redes deve distinguir tipo de candidato e frames recebidos, sem publicar IP, SDP ou convite. Se conexão externa não passar, documentar o bloqueio e manter a entrega de tela em homologação; publicar acabamento independente validado.

Ordem futura: migração de sinalização/controle de acesso → verificar grants e testes isolados → frontend do apresentador/visualizador → verificar domínio e limites reais. Recuperação do frontend mantém as restrições do banco e encerra sessões abertas; não deve expor credenciais nem remover registros administrativos. Artefatos, comandos, candidato e checks finais serão registrados no PR, sem herdar resultado de outro SHA.

## Implementação e privacidade

Migração aditiva `20261121020000_tela_por_link.sql`, após nomes por espaço (20261121010000). Tabelas privadas de sessão/solicitações; sem SELECT, INSERT, UPDATE ou DELETE do app. `hub_screen_start` exige integrante ativo com Administração ou Operação e reunião persistida de projeto no próprio espaço. `hub_screen_host` valida o apresentador e o acesso a cada operação. `hub_screen_watch` é uma API de capacidade disponível ao anônimo: credencial de 256 bits, aprovação explícita, apenas oferta/resposta e estado daquela sessão. Não consulta nomes de estabelecimentos, reuniões, notas, valores, membros ou espaços.

A fonte é escolhida no seletor nativo após gesto. O apresentador copia o convite; a credencial fica em fragmento e memória. O visualizador remove o fragmento antes de carregar seu cliente Supabase independente, sem sessão persistida do Hub. Não registrar corpos das RPCs de negociação em ferramentas de observabilidade, analytics, proxy ou logs personalizados. Nenhuma telemetria nova foi instalada. O servidor guarda somente hash da credencial; SDP efêmero permanece privado até o encerramento, quando é apagado.

Até cinco solicitações por convite e um espectador aprovado. Nome autodeclarado, sem autenticação de identidade: confirme por outro canal antes de permitir. Convite novo por dez minutos, sessão até trinta minutos, validade renovada pelo apresentador a cada consulta e lease de 45 segundos. Falha de confirmação por mais de 12 segundos interrompe o cliente. Encerrar, fechar a fonte pelo navegador ou sair da ficha para a captura e revoga a sessão. Reconexão de rede mantém o mesmo visualizador em memória; recarregar a página perde a credencial e exige novo convite. Não há histórico de URLs.

Expiração é conferida em cada RPC. Iniciar outra sessão também varre até 20 sessões expiradas e apaga envelopes encerrados há mais de um dia. Não há cron novo: sem tráfego, a limpeza física aguarda próxima operação; a autorização já considera a expiração. Eventos de início/encerramento são duráveis, na mesma transação, sem credenciais, SDP, nome de janela ou mídia. Fechar após expiração registra o encerramento observado, sem inventar horário exato de queda.

WebRTC direto não é DRM: não apaga frames já recebidos nem impede um participante de gravar a própria recepção. O encerramento fecha conexões dos clientes oficiais; não se promete corte centralizado contra clientes alterados que já negociaram a mídia. Sem gravação do Hub, câmera, microfone ou videoconferência. O áudio é somente o que a fonte do navegador fornecer e exige ativação no receptor.

## Testes e publicação

`node scripts/local-validation.mjs screen-link-real.spec.mjs project-meetings-real.spec.mjs --workers=1`: autorização, outro espaço, anônimo, entrada, aprovação, expiração, repetição, rollback do evento, desativação e envelopes privados; captura nativa e frames em outro processo, recuperação de HTTP, fechamento da fonte e tentativa de reuso. Fonte e contas fictícias, sem gravar SDP/ICE/IP/convites. Chromium completo: mesmo computador, sem prova de redes distintas nem áudio útil.

`node scripts/screen-upgrade-validation.mjs --reset-local-fixtures`: esquema anterior 20261121010000 → dry-run exclusivo → expansão → frontend anterior/candidato/recuperação, registros e restrições preservados. Parar prévia antes de resetar. CI também executa tipagem, unitários, builds e regressões anteriores.

Prévia protegida: o gateway permite /assistir e um probe de teste em memória, protegido pela senha/cookie da homologação. `screen-external-viewer.mjs` recebe em runner remoto somente o convite fictício mantido em memória, sem escrevê-lo em argumentos, artefatos ou logs. Habilitar `HUB_SCREEN_PROBE_ENABLED` apenas durante ensaio assistido por apresentador fictício automático. Link de revisão e senha nunca ficam no Git.

Publicar somente depois da evidência exigida: conferir candidato/checks/main → dry-run remoto contendo só 20261121020000 → aplicar e verificar grants/tabelas/funções, sem criar sessão real de teste → merge/frontend → Vercel READY/SHA e acesso anônimo isolado ao visualizador. Recuperação: frontend anterior do acabamento diário; preservar migração, eventos e demais restrições. Encerrar sessões pelo caminho administrativo antes de recuperar; leases expiram sessões abandonadas. Não reabrir grants nem apagar vínculos/documentos. Sem prova externa, manter PR em rascunho e não aplicar migração em produção.

Encerramentos automáticos por prazo, lease ou perda de autorização têm ação explícita e ator nulo; não são atribuídos ao apresentador como se ele tivesse clicado. A limpeza administrativa conserva os eventos. Cancelamento do seletor e navegador incompatível não criam sessão/evento. Falha transitória de negociação recria a conexão e é coberta por regressão que rejeita uma primeira descrição remota antes de receber vídeo. Escolher tela inteira pode revelar notas/notificações da fonte: a interface orienta usar aba preparada; o visualizador não consulta notas do portal.

## Recepção entre redes — 21/11/2026

Candidato `417714c50c5fa64a54660e528390d82ef20843e1`: [ensaio externo aprovado](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/44946132798), com apresentador Chromium nesta máquina e espectador Chromium no runner GitHub, conectados por redes distintas. Captura nativa fictícia, aprovação, frames decodificados no receptor e encerramento pelo navegador comprovados. Credencial e SDP somente em memória; artefatos contêm captura e resultados sanitizados. O guia diário também abriu externamente em desktop e celular escuro. Não é prova de todas as redes, aparelhos físicos ou áudio útil.

A tentativa anterior não recebeu vídeo. A revisão encontrou uma falha reproduzível na retomada após erro de negociação; foi corrigida e coberta por uma descrição remota que falha uma vez no teste. Não se atribui toda a falha externa anterior a essa causa: a primeira tentativa não tinha diagnóstico suficiente. Durante a atualização da prévia, uma execução atingiu o gateway parado; o mesmo candidato foi reexecutado após restabelecê-lo e passou, mantendo as asserções.

Para produção, `vercel.json` reescreve somente /assistir para /index.html, conforme a [orientação SPA da Vercel](https://vercel.com/docs/frameworks/frontend/vite). O fragmento permanece no navegador e é removido antes do visualizador. Após esta revisão, os checks e o ensaio externo são repetidos no candidato final antes de aplicar a migração.

A revisão anterior à publicação conferiu por leitura a configuração de logs do banco: log_statement=ddl, log_min_duration_statement=-1, log_parameter_max_length_on_error=0 e pgaudit.log_parameter=off. Não se habilitou logging de argumentos ou corpos; manter essa restrição ao instrumentar as RPCs. A interface bloqueia copiar/aprovar convite vencido e o visualizador preserva o tema claro/escuro, sem reutilizar sessão do Hub.

## Candidatos tardios e limites da rede

A repetição do candidato d7082d2 não recebeu vídeo; o diagnóstico sanitizado mostrou negociação com resposta HTTP 200, ICE sem conexão e ausência de candidatos remotos no receptor. Uma única fotografia do SDP após espera fixa pode perder rotas descobertas depois. A implementação passou a **trickle ICE**: descrição inicial sem candidatos, fila incremental por negociação, envio em lotes de até 40 e limite de 64 por participante. Revisões antigas são recusadas; duplicatas não são acumuladas. Só o espectador aprovado recebe a sinalização. Encerramento/recusa apaga envelopes; ICE/SDP não vão ao histórico. O mecanismo continua sem TURN e não torna todas as redes alcançáveis.

A regressão de navegador retarda as notificações ICE do receptor por sete segundos, mantém a primeira falha transitória de descrição remota e exige vídeo decodificado; assim não depende da descoberta rápida de rotas. As RPCs também testam revisão, deduplicação e limites. O novo candidato precisa dos próprios checks e recepção externa antes de publicar.

Áudio: tentativa isolada com tom sintético no Chromium headless não comprovou energia de áudio recebida. Não se anuncia áudio útil homologado; controles dependem do que a fonte/navegador fornecer. Chromium em desktop foi o navegador de transmissão avaliado; celulares foram avaliados por viewport para recepção/layout, sem alegar teste em aparelho físico ou Safari.

Uma execução anterior do CI falhou na restauração de foco do CRM; as mesmas asserções passaram em três execuções locais consecutivas. Não se alterou essa asserção nem se atribui causa ainda não reproduzida. A regressão completa permanece obrigatória no candidato final.
