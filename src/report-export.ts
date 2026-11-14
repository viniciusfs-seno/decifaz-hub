import {metrics,type Data} from './domain.ts'

export function reportCsv(data: Data): string {
 const m = metrics(data)
 const rows = [
  ['Indicador', 'Valor'],
  ['Leads cadastrados', m.leads],
  ['Leads em qualificação', m.qualifying],
  ['Leads prioritários', m.priority],
  ['Reuniões agendadas', m.meetings],
  ['Propostas enviadas', m.proposals],
  ['Negociações em andamento', m.negotiations],
  ['Clientes conquistados', m.won],
  ['Taxa de conversão (%)', m.conversion ?? ''],
  ['Atividades pendentes', m.pending],
  ['Atividades em atraso', m.overdue],
  ['Projetos em andamento', m.projects],
  ['Receita prevista (R$)', data.finance.some(entry => entry.kind === 'Receita' && entry.state === 'Previsto') ? m.expected.toFixed(2).replace('.', ',') : ''],
  ['Receita realizada (R$)', data.finance.some(entry => entry.kind === 'Receita' && entry.state === 'Realizado') ? m.received.toFixed(2).replace('.', ',') : ''],
 ]
 return '\uFEFF' + rows.map(row => row.join(';')).join('\r\n') + '\r\n'
}

export function downloadReport(data: Data) {
 const url = URL.createObjectURL(new Blob([reportCsv(data)], {type:'text/csv;charset=utf-8'}))
 const link = document.createElement('a')
 link.href = url
 link.download = 'decifaz-indicadores.csv'
 link.click()
 setTimeout(() => URL.revokeObjectURL(url), 1000)
}
