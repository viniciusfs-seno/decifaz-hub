# Revisão de publicação — tela por link (#40)

**Sem publicação nesta etapa.** Prova preservada no commit `62ebd6e965e590069b4cd43579eaecd9509886e7`, [ensaio externo, tentativa2](https://github.com/viniciusfs-seno/decifaz-hub/actions/runs/45077355994/attempts/2). Resumo sanitizado e hashes do código em `capturas/tela/relay-62ebd6e.json`; capturas fictícias no mesmo diretório. O PR registra o head documental atual e seus próprios checks; não apresentar o SHA novo como uma nova execução de mídia. Documentação/testes adicionais não alteram os arquivos de transmissão ou autorização que foram homologados. Não repetir mídia somente para atualizar o relatório.

## Limites efetivos

| Item | Produto preparado | Ensaio comprovado |
|---|---|---|
| Qualidade | `getDisplayMedia` pede15fps como preferência, sem teto explícito de resolução/bitrate. WebRTC/navegador ajustam o resultado. Não há garantia de15fps,128kbit/s ou tamanho fixo. | Instrumentação de teste limita encoder a128kbit/s/5fps e32kbit/s para áudio;4min e8MiB observados, sem equivalência com faturamento. Esses limites **não se aplicam ao produto**. |
| Participantes | Um apresentador autorizado e um espectador aprovado por sessão, sob lock no servidor. Até5 solicitações registradas; aprovação recusa as outras. | Chromium Windows → Chromium Linux no runner GitHub; relay selecionado, frames/pixels avançando, reconexão e remoção do espectador. |
| Prazos | Convite10min; sessão30min no servidor; lease45s; watchdog de autorização15s nos clientes. Encerrar fonte/sair/encerrar sessão interrompe captura oficial. | Três sessões,107s entre primeira criação e último encerramento; convite/sessão expirados por edição de datas **somente na fixture**. |
| Credenciais | Capacidade256bits em fragmento apagado da barra, hash no banco; ICE temporário até1800s ou restante da sessão, emissão no máximo a cada30s por participante. | Sem credenciais, SDP, endereços ou links de convite nos artefatos. Expirar credencial TURN bloqueia novas alocações, não é corte central de cliente modificado já conectado. |
| Áudio | Apresentador e espectador mostram explicitamente **“Áudio ainda não homologado”**. Visualizador inicia silenciado. Não é microfone/videoconferência completa. | Track/amostras RTP presentes, energia0: não houve comprovação de som útil. Sem anúncio de suporte. |

Antes de publicar, decidir se o plano gratuito atende ao uso real. A cobertura da home region após30 dias permanece desconhecida. Não usar a lista de regiões do trial como confirmação nem prometer uso diário sustentado. Um limite de qualidade/tráfego **do produto**, caso escolhido, exige implementação e revalidação próprias; não fingir que o limite do ensaio já o protege.

## Franquia e indisponibilidade

Reutilizada a declaração do titular de conta Developer gratuita sem cartão/upgrade e a documentação oficial de500MB/mês com corte. Consumo remoto veio indisponível antes/depois; não foi tratado como zero. Bytes de transporte são observações amostradas, podem omitir tráfego entre última amostra/fechamento e não devem ser somados entre extremidades para estimar faturamento.

Se a emissão retornar429,5xx, envelope inválido/recusado ou erro de rede, a Edge responde503 genérico sem resposta privada. `screenConfiguration` volta somente ao STUN direto, sem credencial TURN, e a interface informa a alternativa de chamada externa. Não há garantia de conexão direta nas redes que exigem relay. Novas regressões usam provedor fictício para esses cenários, sem esgotar a franquia real.

Se o provedor aceitar emitir credenciais e bloquear o relay por franquia no momento da alocação ou durante a conexão, não há hoje consulta automática de saldo nem mensagem específica “franquia esgotada”. O cliente observa ICE/conexão interrompida e oferece a chamada externa. A mera configuração de relay disponível não comprova rota conectada; o estado de transmissão deve ser lido separadamente. **Não foi realizado um esgotamento real da franquia**, nem prometida contabilização ou alerta de saldo em tempo real.

## Segredos na Edge de produção — procedimento futuro, não executado

1. Após autorização própria, alinhar #40 à main que contém #42/#43, resolver eventuais conflitos sem perder a prova histórica e revalidar os fluxos afetados. Não usar um artefato antigo que omita migrações já publicadas.
2. Preparar artefato de banco com o histórico atual mais `20261121020000_tela_por_link.sql`. Por ter versão anterior às migrações de avisos, o CLI pode exigir `--include-all`; só usá-lo depois de dry-run que liste **exclusivamente** a migração de tela. Não reparar/apagar histórico remoto nem aplicar outros pendentes por conveniência.
3. No projeto correto, em **Supabase → Edge Functions → Secrets**, configurar as variáveis abaixo por mecanismo privado. Alternativa CLI: `supabase secrets set --project-ref <projeto> --env-file <arquivo-privado-absoluto>`. Nunca valores em argumentos, `VITE_*`, commits, CI público ou chat. O arquivo deve ficar fora do Git e com DACL do usuário/SYSTEM no Windows. Não copiar o arquivo de runtime de homologação habilitado para produção.

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
