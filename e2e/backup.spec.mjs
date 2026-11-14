import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'

test('exportação, prévia, restauração, conflito entre abas e desfazer',async({page,context})=>{
 const other=await context.newPage()
 const button=(tab,name)=>tab.getByRole('button',{name,exact:true})
 await Promise.all([page.goto('/'),other.goto('/')])
 await button(other,'Equipe e responsabilidades').click()
 await other.getByLabel('Nome do responsável').fill('Gravação desatualizada QA')
 await button(page,'Configurações').click()
 const downloadEvent=page.waitForEvent('download')
 await button(page,'Exportar JSON').click()
 const exported=JSON.parse(await readFile(await (await downloadEvent).path(),'utf8'))
 expect(exported.backup.formatVersion).toBe(1)
 expect(Number.isNaN(Date.parse(exported.backup.exportedAt))).toBe(false)
 const lead=exported.leads[0]
 const oldOwner=lead.owner
 lead.owner='Responsável restaurado QA'
 exported.team.push(lead.owner)

 await button(page,'Restaurar backup').click()
 await page.getByLabel('Arquivo JSON do Decifaz Hub').setInputFiles({
  name:'backup-qa.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported)),
 })
 await expect(page.getByText(/Backup v1 · Exportado em/)).toBeVisible()
 await page.getByText(/Leads · 0 adicionados · 1 alterados/).click()
 await page.getByText(lead.name,{exact:true}).click()
 await expect(page.getByRole('row',{name:'Responsável '+oldOwner+' '+lead.owner})).toBeVisible()
 await expect(button(page,'Confirmar restauração')).toBeDisabled()
 await page.getByRole('checkbox',{name:/Confirmo a substituição/}).check()
 await button(page,'Confirmar restauração').click()
 await button(other,'Adicionar').click()
 await expect(other.getByText('Recarregue a página para obter os dados da outra aba.',{exact:true})).toBeVisible()
 await button(other,'Recarregar dados').click()
 await expect(other.getByText(lead.owner,{exact:true})).toBeVisible()
 await expect(other.getByText('Gravação desatualizada QA',{exact:true})).toHaveCount(0)
 await button(other,'Configurações').click()
 await button(other,'Desfazer última restauração').click()
 await other.getByRole('checkbox',{name:/Confirmo a substituição/}).check()
 await button(other,'Confirmar desfazer').click()
 await button(page,'Recarregar dados').click()
 await button(page,'Equipe e responsabilidades').click()
 await expect(page.getByText(oldOwner,{exact:true})).toBeVisible()
 await expect(page.getByText(lead.owner,{exact:true})).toHaveCount(0)
})
