# Contribuindo com o Decifaz Hub

## Branch e escopo

- Parta da `main` atualizada. Para trabalho dependente, use a branch do PR anterior como base e indique a dependência na descrição. Depois do merge anterior, atualize a base e confira se o diff contém só o escopo deste PR.
- Use branches como `feat/central-comercial`, `fix/preco-concorrente`, `test/permissoes` ou `docs/padrao-de-pr`.
- Use títulos em português no formato `tipo(área): ação e resultado`, como `fix(propostas): preserva valores em edições concorrentes`. Mantenha um objetivo por PR.
- Use rascunho enquanto houver bloqueios conhecidos. Indique na descrição o que falta para revisão.

## Descrição e evidências

Use o [template de PR](.github/pull_request_template.md), inclusive em PRs abertos pelo Codex. Inclua objetivo, escopo, dependências, evidências e plano de publicação quando houver impacto operacional. Marque seções que não se aplicam.

Identifique o SHA validado e registre o comando, resultado e link do CI quando disponível. Distinga aprovado, falhou, pendente e não executado. Após alterar código ou atualizar a base, confira a evidência associada ao novo commit. Documente mudanças de comportamento junto ao código e mantenha a descrição atualizada.

## Revisão e publicação

Para alterações de interface, mostre o fluxo afetado e, quando disponível, inclua evidência visual. Para permissões, liste os perfis e registre cenários de acesso permitido, negado e isolamento por espaço. Para banco, Edge Functions, ambiente ou Vercel, descreva dependências entre versões, ordem de aplicação, verificações e recuperação. Use dados fictícios em testes e mantenha credenciais fora do PR.

Antes do merge, confira o diff contra a base atual, os checks do commit a integrar e os comentários de revisão. Registre qualquer etapa pendente que afete produção. Quando o merge disparar um deploy, confira o resultado e a versão publicada.
