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
