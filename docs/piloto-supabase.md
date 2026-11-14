# Piloto compartilhado do Decifaz Hub

O piloto contém cadastro e edição básica de estabelecimentos, histórico de interações, triagem, reuniões, diagnósticos e atividades vinculadas. Cada registro pertence a um espaço de trabalho. Os membros do mesmo espaço podem atualizar registros. Use **Atualizar** para recarregar os dados compartilhados. Edições concorrentes do mesmo registro seguem a última gravação.

## Configuração da prévia

Em `.env.local` ou nas variáveis de build do projeto Decifaz Hub na Vercel, configure:

```dotenv
VITE_HUB_MODE=shared
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Essas variáveis são públicas no bundle. Use a chave publicável. Senha do banco e chaves administrativas pertencem ao ambiente de administração.

Aplique as migrations e disponibilize a função Edge `hub-workspaces`. No Supabase Auth, inclua a URL exata da prévia na lista de redirecionamentos e configure a entrega de e-mail para os destinatários do piloto. Para cada participante, crie ou convide a conta pelo Supabase Auth e associe seu ID de usuário ao espaço em `public.hub_members`. Os espaços ficam em `public.hub_workspaces`. O formulário de login solicita um link para uma conta existente.

A função Edge recebe a sessão do usuário e lista os espaços que ele pode acessar. As consultas e gravações passam pela Data API com o token do usuário e são limitadas pelas políticas de RLS.

## Validação antes de habilitar

1. Entre pela prévia com uma conta de teste vinculada ao espaço. Cadastre um lead fictício, uma interação e uma atividade.
2. Entre em outro navegador com um segundo membro do mesmo espaço. Confira os registros e altere o status da atividade.
3. Entre com uma conta sem vínculo ou de outro espaço. Verifique que os registros do primeiro espaço ficam inacessíveis.
4. Mantenha dados reais fora do piloto até concluir essa validação.

O build padrão abre a demonstração local. O modo compartilhado começa vazio e não importa o histórico local. A visão geral compartilhada consulta totais do banco para funil, prioridades concluídas, reuniões, diagnósticos e atividades. Propostas, projetos e financeiro seguem na demonstração. As listas do piloto ainda não possuem paginação.

Use a triagem guiada e conclua os sete critérios para ver a prioridade. Registre uma reunião realizada com diagnóstico e marque as opções de avanço e acompanhamento para conferir os reflexos no funil e nas atividades.

Na Vercel, configure as três variáveis para o ambiente desejado e gere um novo deploy. Para o domínio de produção, cadastre `https://decifaz-hub.vercel.app/` em Redirect URLs no Supabase Auth e use esse endereço como Site URL se ele for o destino padrão do projeto. O app envia a origem da implantação atual como destino do login.
