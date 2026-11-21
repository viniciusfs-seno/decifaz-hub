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
