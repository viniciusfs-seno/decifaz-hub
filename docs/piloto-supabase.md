# Piloto interno do Decifaz Hub

## Preparação

- Criar o projeto `decifaz-hub-piloto` no Supabase Free, em São Paulo se disponível. Usar registros fictícios durante a homologação.
- Ativar Vercel Authentication para todos os deployments e confirmar que uma janela anônima pede login. Testar as duas contas autorizadas.
- Manter o GitHub como fonte do código. Aplicar as mudanças via PR e validar a prévia antes de atualizar o Sites.

## Primeiro fluxo compartilhado

Começar por estabelecimentos, histórico e atividades. Migrar triagem, reuniões, propostas, projetos e financeiro por etapas, preservando os vínculos existentes. Usar migrações versionadas e manter a demonstração local disponível para testes.

Proposta inicial de acesso: um espaço de trabalho Decifaz, com associação de usuários por convite. Administradores gerenciam membros. Membros convidados trabalham nos registros do espaço. Validar com os sócios se o financeiro precisa de acesso separado antes de migrá-lo.

Cada registro compartilhado deve ter vínculo com o espaço de trabalho. O banco deve conferir a associação ativa via RLS em leitura e escrita, bloquear acesso anônimo e rejeitar vínculos entre espaços distintos. A interface usa a chave publicável. Chaves secretas e credenciais do banco ficam fora do frontend e do Git.

## Critérios de aceite

1. A primeira conta cria um lead fictício. A segunda conta o visualiza, edita e registra uma atividade.
2. Uma terceira conta autenticada sem vínculo e uma sessão anônima têm leitura e escrita bloqueadas pela API.
3. A remoção de um membro revoga o acesso aos registros nas requisições seguintes.
4. Conflitos de edição são detectados. A importação de teste preserva os vínculos e uma segunda execução evita duplicações.
5. A homologação em dupla cobre CRM, proposta, projeto, suporte, backup e o teste de reunião com compartilhamento de tela em dois dispositivos.

O piloto com dados reais depende da validação de acesso, migração e recuperação. O plano Free pode pausar o banco após uma semana com pouca atividade.
