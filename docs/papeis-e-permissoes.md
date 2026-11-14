# Papéis e permissões

Hoje, membros autenticados de um espaço compartilham seus módulos. O banco usa RLS por espaço de trabalho. A matriz abaixo é uma proposta para a próxima migração de acesso.

| Papel | Comercial | Projetos e suporte | Financeiro |
| --- | --- | --- | --- |
| Administração | Consulta e edição | Consulta e edição | Consulta e edição |
| Comercial | Consulta e edição | Consulta | Sem acesso |
| Operação | Consulta | Consulta e edição | Sem acesso |
| Financeiro | Consulta | Consulta | Consulta e edição |

Antes de atribuir papéis reais, valide a matriz com contas fictícias. As regras precisam cobrir tabelas, RPCs e Edge Functions, inclusive os valores financeiros embutidos nas propostas e nas cópias do projeto. O frontend deve tratar ausência de acesso sem interromper a carga das outras áreas. A atribuição de papéis deve ficar restrita a administradores e preservar o acesso de membros existentes durante a migração.
