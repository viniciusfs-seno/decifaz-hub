# Decifaz Hub

Portal interno de demonstração em React, TypeScript e Vite. Use dados fictícios nesta versão.

## Executar localmente no VS Code

1. Abra esta pasta com Node.js 22.12+ ou 24.
2. Execute `npm ci` e `npm run dev`.
3. Abra a URL indicada pelo terminal.
4. Use `npm run check` para validar tipos e `npm run build` para gerar a distribuição estática em `dist/`.

A prévia HTML portátil, quando fornecida, abre diretamente no navegador. O armazenamento em arquivos locais depende do navegador. Para persistência previsível, use o servidor local acima.

## Organização

- `src/domain.ts`: entidades, catálogos, critérios, funil e métricas.
- `src/repository.ts`: interface de persistência, implementação local, exemplos fictícios e exportação JSON.
- `src/commercial.tsx`: CRM, triagem, atividades e reuniões.
- `src/dashboard.tsx`: dashboard e relatórios derivados dos registros.
- `src/secondary.tsx`: conhecimento, catálogo e cadastros iniciais de propostas, projetos e financeiro.
- `src/manual.json`: transcrição estruturada do manual, incluindo suas tabelas.

## Demonstração

Cadastre um lead com responsável, próxima ação e prazo. Na triagem, critérios desconhecidos ficam em branco e o rascunho permanece sem prioridade definitiva. Registre fatos, relatos e hipóteses separadamente. Depois de concluir, crie uma atividade e registre uma reunião realizada, marque a opção de atualizar o CRM e confira o histórico e o dashboard. Use Configurações para exportar o estado em JSON.

O estado é local por navegador e origem, sem autenticação, sincronização entre dispositivos ou backup automático. A exportação JSON é manual e a importação pela interface fica para a fase seguinte. As métricas de conversão usam apenas ganhos e perdas no denominador. Valores financeiros realizados exigem data efetiva.

## Decisões para produção

- Definir repositório privado, permissões de manutenção, revisão de PRs e CI.
- Definir papéis, alçadas comerciais e escopo de acesso a documentação, contatos e valores.
- Substituir persistência local por uma implementação assíncrona com API e PostgreSQL, com migrações e autorização no servidor e no banco.
- Implementar autenticação real, auditoria de mudanças, reconciliação de duplicatas, concorrência de gravação e política de backups com restauração testada.
- Validar histórico e privacidade do material interno antes de qualquer compartilhamento.
- Validar modelos, regras de versionamento, aceite, homologação, recorrências, faturamento e pós-venda com os sócios.
