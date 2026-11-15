# Papéis e permissões

A matriz abaixo foi implementada na migração `20261114210000_papeis.sql`, em validação exclusivamente local. Continua sujeita à revisão antes de atribuir papéis reais ou migrar produção.

| Papel | Comercial | Projetos e suporte | Financeiro |
| --- | --- | --- | --- |
| Administração | Consulta e edição | Consulta e edição | Consulta e edição |
| Comercial | Consulta e edição | Consulta | Sem acesso |
| Operação | Consulta | Consulta e edição | Sem acesso |
| Financeiro | Consulta | Consulta | Consulta e edição |

Os valores persistidos dos papéis são `admin`, `commercial`, `operations` e `finance`. A migração mantém os membros existentes como `admin`, preservando o acesso anterior. Convites novos devem informar explicitamente um papel pela RPC `hub_set_role(w,u,r)`. Somente Administração pode usá-la, no próprio espaço. A RPC serializa alterações e impede remover o último administrador. Não há concessão de escrita direta em `hub_members` para usuários autenticados.

`hub_can` verifica o usuário autenticado e o espaço, sem aceitar um usuário arbitrário. As políticas de tabelas distinguem consulta e escrita. Atividades comerciais usam a permissão Comercial; atividades vinculadas a projetos usam Projetos. As RPCs com `security definer` verificam a permissão antes de executar a implementação existente. As RPCs de triagem e reunião mantêm `security invoker` e estão sujeitas ao RLS.

O JSON bruto de propostas (`record`) e projetos (`approved`) não é consultável diretamente por membros, inclusive administradores. O frontend consulta `hub_proposals_visible` e `hub_projects_visible`: essas views verificam o espaço explicitamente, têm barreira de segurança e só retornam valores financeiros para Administração e Financeiro. Para outros papéis, usam uma lista de campos permitidos e omitem implantação, mensalidade, condições, evidências e eventos. Não registre preços ou condições financeiras em campos livres de escopo, título, serviços ou histórico comercial.

Comercial pode criar e revisar escopo sem enviar campos financeiros. Novas propostas começam com valores zerados; revisões preservam os valores anteriores. Enviar `setup`, `monthly` ou `terms` pela RPC sem acesso financeiro é recusado. Administração pode editar esses valores na proposta. O papel Financeiro consulta propostas e projetos, sem alterar o escopo comercial. O editor exibe os dados financeiros apenas quando autorizados. A criação de projetos, homologação e suporte exigem escrita em Projetos.

A Edge Function `hub-workspaces` valida a sessão, consulta as associações pelo JWT do usuário e retorna o papel de cada espaço autorizado. Falta de sessão retorna 401 e conta sem associação retorna 403. Ela não usa chave administrativa. Cargas de módulos com falha geram avisos próprios e preservam os demais módulos. Sem permissão financeira, o frontend não consulta as tabelas financeiras.

## Validação e implantação

Use apenas contas fictícias e uma pilha descartável local:

```sh
npx --yes supabase@3.0.0 start
node scripts/local-validation.mjs
node scripts/mock-validation.mjs
```

O executor local obtém as chaves pelo status da CLI, mantém os valores na memória e recusa qualquer endpoint diferente de `http://127.0.0.1:54321`. Não use `db push`, `functions deploy` ou variáveis de produção durante a validação. Os workflows de PR executam as mesmas suítes. Veja `docs/validacao-papeis.md` para resultados e pendências desta entrega.
