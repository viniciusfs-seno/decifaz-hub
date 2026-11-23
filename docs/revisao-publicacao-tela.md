# Revisão de publicação — tela por link (#40)

**Publicação experimental autorizada pelo titular em23/11/2026**, a partir do candidato5a4f837, com um espectador, uma sessão global,5min, perfil econômico e áudio desligado. O titular aceita a região permanente desconhecida e indisponibilidade após trial/franquia; não autoriza cartão, upgrade, contratação ou excedente. O rótulo Experimental foi acrescentado antes do rollout; resultado/SHAs/migração/deployment no registro operacional do PR40. Não criar dados fictícios em produção nem simular integrante para smoke de mídia. Prova preservada no commit `62ebd6e965e590069b4cd43579eaecd9509886e7`, [ensaio externo, tentativa2](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45077355994/attempts/2). Resumo sanitizado e hashes do código em `capturas/tela/relay-62ebd6e.json`; capturas fictícias no mesmo diretório. O PR registra o head documental atual e seus próprios checks; não apresentar o SHA novo como uma nova execução de mídia. Esta rodada altera transmissão e limites de autorização: a prova histórica não substitui a nova homologação do perfil econômico. O SHA final e seus resultados são registrados no PR e nos artefatos do CI.

Após a publicação de #42/#43, a base foi alinhada à main `510555b5dfa6d7ee016900852c6c844a35ece77b`. Conflitos de workflows, documentação, defaults de validação, estilos e exemplos de configuração foram combinados preservando as entregas independentes. O shell do portal incorpora os avisos; a Edge mantém o contrato de emissão; componentes de tela e RPC de início recebem os limites econômicos. Interface/autorização usam fixtures e mídia externa é revalidada no candidato final. O gate continua exigindo prova do SHA candidato para uma liberação futura e não foi dispensado. Os hashes preservados descrevem exclusivamente a prova histórica, não o código novo.

`scripts/screen-upgrade-validation.mjs` parte do histórico Git do #43 publicado (sem a migração de tela), simula no isolado geração interna ligada/e-mail desligado e exige dry-run exclusivo da migração mais antiga com `--include-all`. Confere dados, JSONs financeiros protegidos, grants, flags dos avisos, frontend anterior/candidato e recuperação para #43. Não rodar o reset na pilha local com prévia ativa; o workflow usa Docker descartável.

## Limites efetivos

Na integração da base, o ensaio de avisos recusou corretamente um dry-run que incluía também a migração independente de tela. O script de avisos agora recompõe o histórico Git publicado do #41 e adiciona exclusivamente as duas migrações de avisos, mantendo a exigência de uma migração por fase. Isso corrige o artefato de teste desta branch, sem alterar banco ou produto publicado. O ensaio de tela separado continua partindo do #43.

| Item | Produto preparado | Ensaio comprovado |
|---|---|---|
| Qualidade | Captura até1280×720/5FPS, encoder até256kbit/s/5FPS, leitura dos controles aceitos e interrupção se indisponíveis/excedidos. Preferência por resolução/texto. Não é quota global de consumo. | Novo ensaio usa perfil do produto sem sobrescrever encoder; quadro de texto e controles aceitos nos artefatos do SHA final. Histórico62 usava encoder de teste128kbit/s. |
| Participantes | Uma sessão ativa global no Hub, início serializado por lock transacional. Um apresentador autorizado e um espectador aprovado, até5 solicitações. Repetição não estende prazo. | Regressão concorrente e outro espaço; novo ensaio Chromium Windows→runnerLinux, relay/frames/pixels, reconexão e remoção. Resultado final no PR. |
| Prazos | Convite2min; sessão5min no servidor; lease45s; watchdog de autorização15s. Prazo local libera recursos mesmo com RPC pendente. | Testes de tempo/idempotência/liberação, com prazo reduzido somente na fixture. Evidência62 preserva limites antigos; não substitui a nova. |
| Credenciais | Capacidade256bits em fragmento apagado da barra, hash no banco; ICE temporário até300s/restante da sessão, emissão no máximo a cada30s por participante. | Sem credenciais, SDP, endereços ou links de convite nos artefatos. Expirar credencial TURN bloqueia novas alocações, não é corte central de cliente modificado já conectado. |
| Áudio | Explicitamente **“Áudio ainda não homologado”**, desativado no perfil econômico (`audio:false`). Não é videoconferência. | Teste exige zero tracks de áudio no perfil; histórico62 com energia0 não prova som útil. |

Antes de publicar, decidir se o plano gratuito atende ao uso real. A home region após30dias permanece desconhecida. Não usar regiões do trial como confirmação nem prometer uso diário sustentado. Os limites do produto foram implementados; a homologação de mídia precisa corresponder ao novo candidato, com texto legível e encoder sem alteração por teste. Não há medição automática da franquia ou teto mensal no Hub.

## Franquia e indisponibilidade

Reutilizada a declaração do titular de conta Developer gratuita sem cartão/upgrade e a documentação oficial de500MB/mês com corte. Consumo remoto veio indisponível antes/depois; não foi tratado como zero. Bytes de transporte são observações amostradas, podem omitir tráfego entre última amostra/fechamento e não devem ser somados entre extremidades para estimar faturamento.

Se a emissão retornar429,5xx, envelope inválido/recusado ou erro de rede, a Edge responde503 genérico sem resposta privada. `screenConfiguration` volta somente ao STUN direto, sem credencial TURN, e a interface informa a alternativa de chamada externa. Não há garantia de conexão direta nas redes que exigem relay. Novas regressões usam provedor fictício para esses cenários, sem esgotar a franquia real.

Se o provedor aceitar emitir credenciais e bloquear o relay por franquia no momento da alocação ou durante a conexão, não há hoje consulta automática de saldo nem mensagem específica “franquia esgotada”. O cliente observa ICE/conexão interrompida e oferece a chamada externa. A mera configuração de relay disponível não comprova rota conectada; o estado de transmissão deve ser lido separadamente. **Não foi realizado um esgotamento real da franquia**, nem prometida contabilização ou alerta de saldo em tempo real.

## Segredos na Edge de produção — procedimento futuro, não executado

1. Após autorização própria, alinhar #40 à main que contém #42/#43, resolver eventuais conflitos sem perder a prova histórica e revalidar os fluxos afetados. Não usar um artefato antigo que omita migrações já publicadas.
2. Preparar artefato de banco com o histórico atual mais `20261121020000_tela_por_link.sql`. Por ter versão anterior às migrações de avisos, o CLI pode exigir `--include-all`; só usá-lo depois de dry-run que liste **exclusivamente** a migração de tela. Não reparar/apagar histórico remoto nem aplicar outros pendentes por conveniência.
3. No projeto correto, em **Supabase → Edge Functions → Secrets**, configurar as variáveis abaixo por mecanismo privado. Alternativa CLI: `supabase secrets set --remote=<projeto> --env-file <arquivo-privado-absoluto>`. Nunca valores em argumentos, `VITE_*`, commits, CI público ou chat. O arquivo deve ficar fora do Git e com DACL do usuário/SYSTEM no Windows. Não copiar o arquivo de runtime de homologação habilitado para produção.

| Nome | Configuração |
|---|---|
| `HUB_TURN_PROVIDER` | `xirsys` |
| `HUB_TURN_XIRSYS_IDENT` | Identificador da conta, somente servidor. |
| `HUB_TURN_XIRSYS_SECRET` | Segredo somente no secret manager. Não reproduzir valor nem exigir nova entrada se já armazenado corretamente. |
| `HUB_TURN_XIRSYS_CHANNEL` | Canal aprovado, exato e validado; valor configurado de forma privada. |
| `HUB_TURN_ENABLED` | `false` durante preparação/recuperação. |
| `HUB_TURN_FREE_PLAN_CONFIRMED` | `false` até conferência das condições aprovadas para a ativação. Não comprova home region. |

4. Publicar **somente** `hub-screen-ice` com a configuração própria `verify_jwt=false`: espectador usa capacidade anônima, por isso a função/RPC deve validar apresentador ou espectador aprovado, espaço, vínculo ativo, sessão e prazo. Nunca substituir essa autorização por service_role, nem desativar validação global de funções em produção. `SUPABASE_URL`/`SUPABASE_ANON_KEY` são valores de runtime fornecidos pela plataforma; não expor chave de serviço ao navegador.
5. Verificar anon/capacidade incorreta/usuário restrito/encerrado recusados; ligar as flags somente no servidor e na fase autorizada, com limites visíveis. Credenciais temporárias ficam apenas na memória do cliente autorizado. Não ligar Cloudflare pago ou faturamento como fallback.
6. Depois do banco/Edge compatíveis, integrar frontend autorizado e confirmar SHA/deployment/domínio. Recuperação: parar sessões e desligar `HUB_TURN_ENABLED` (com runtime recarregado), preservar banco/auditoria/permissões, recuperar frontend compatível e manter chamada externa. Não usar rollback de banco que reabra dados protegidos.

Nenhum segredo de tela, migração ou Edge desse fluxo foi aplicado em produção. #42/#43 e seus avisos internos são independentes; não publicar worker/eventos de e-mail por causa desta configuração.

Publicação experimental concluída em23/11: merge12f94ca69b6427932cf239170956997003f8181e, migração20261121020000 e somente hub-screen-ice. Deployment dpl_GUSW59WHvqyTEaFgKhdxALb5vSDj READY no domínio principal. Proteções verificadas por chamadas sem sessão/capacidade inválida, sem registros fictícios ou identidade simulada. Região permanente aceita como pendência; áudio desligado. Registro completo no PR40.
