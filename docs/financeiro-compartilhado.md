# Financeiro compartilhado

Na seção **Financeiro**, escolha um projeto, selecione implantação ou mensalidade e informe o vencimento. O Supabase copia o valor da proposta aprovada. A implantação pode ser prevista uma vez por projeto. A mensalidade pode ser prevista uma vez por mês de vencimento. Lance cada competência quando houver uma previsão válida.

Ao receber um pagamento, selecione a previsão e informe a data efetiva e o valor recebido. Pagamentos parciais mantêm o restante em aberto. O banco serializa registros na mesma previsão para impedir que o total recebido ultrapasse o valor previsto.

As previsões e os recebimentos ficam em tabelas separadas. O painel exibe total previsto, recebido e saldo. O acesso é restrito aos membros do espaço. Nesta etapa, os lançamentos são manuais. Edição, estorno, despesas e cobranças automáticas ainda precisam de fluxos próprios.
