# Financeiro compartilhado

Na seção **Financeiro**, escolha um projeto, selecione implantação ou mensalidade e informe o vencimento. O Supabase copia o valor da proposta aprovada. A implantação pode ser prevista uma vez por projeto. A mensalidade pode ser prevista uma vez por mês de vencimento. Lance cada competência quando houver uma previsão válida.

Ao receber um pagamento, selecione a previsão e informe a data efetiva e o valor recebido. Pagamentos parciais mantêm o restante em aberto. O banco serializa registros na mesma previsão para impedir que o total recebido ultrapasse o valor previsto.

As previsões e os recebimentos ficam em tabelas separadas. O painel exibe total previsto, recebido e saldo. O acesso é restrito aos membros do espaço. Nesta etapa, os lançamentos são manuais. Edição de previsões e cobranças automáticas ainda precisam de fluxos próprios.

## Visão mensal, atrasos e estornos

O filtro de mês usa o vencimento para previsões e a data efetiva para recebimentos e despesas pagas. O saldo de uma previsão considera todos os recebimentos válidos associados a ela, mesmo quando registrados em outro mês. O dashboard mostra o mês atual e o saldo atrasado acumulado.

Estorne um recebimento pelo histórico, informando o motivo. O lançamento original permanece visível com a data e o motivo do estorno. O total recebido é recalculado excluindo o lançamento estornado no mês original e o saldo da previsão reabre. Esta é uma correção de registro, sem movimentação bancária.

Cadastre despesas com descrição, vencimento e valor previsto. Na baixa, informe a data e o valor efetivo. Esta versão registra uma baixa integral por despesa.

## Regressão

`npm test` valida os totais por competência e data efetiva. O arquivo `supabase/tests/financeiro_jornada.sql` cobre proposta, aceite, projeto, previsão, recebimento, estorno, despesa e isolamento. Execute com um papel administrativo em um banco de teste já migrado. As fixtures ficam em uma transação revertida.
