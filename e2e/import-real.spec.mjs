import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('CSV: prévia, duplicidade explícita, atualização revisada, falha parcial e repetição',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(120000)
 const f=await operationalFixture()
 try{
  const base={w:f.workspace,operation_id:randomUUID(),body:{name:'Importado fictício',city:'Fortaleza',profile:{whatsapp:'85999998888'}},initial_stage:'Identificado'}
  expect((await checked(f.owner.client.rpc('hub_import_lead',base))).status).toBe('ready')
  const [a,b]=await Promise.all([checked(f.restricted.client.rpc('hub_import_lead',{...base,decision:'create'})),checked(f.restricted.client.rpc('hub_import_lead',{...base,decision:'create'}))]);expect(a).toEqual(b)
  expect((await checked(f.restricted.client.rpc('hub_import_lead',base))).status).toBe('created')
  const duplicate={...base,operation_id:randomUUID()}
  expect((await checked(f.owner.client.rpc('hub_import_lead',{...duplicate,decision:'create'}))).status).toBe('review')
  const preview=await checked(f.owner.client.rpc('hub_import_lead',duplicate));expect(preview.matches).toHaveLength(1)
  const conflict=await checked(f.owner.client.rpc('hub_import_lead',{...duplicate,decision:'update',target:a.lead_id,expected_revision:-1}));expect(conflict.status).toBe('conflict')
  expect((await checked(f.owner.client.rpc('hub_import_lead',{...duplicate,decision:'update',target:a.lead_id,expected_revision:preview.matches[0].revision}))).status).toBe('updated')
  expect((await checked(f.owner.client.rpc('hub_import_lead',{...base,operation_id:randomUUID(),initial_stage:'Ganho'}))).status).toBe('invalid')
  expect((await checked(f.owner.client.rpc('hub_import_lead',{...base,operation_id:randomUUID(),body:{...base.body,profile:{budget:'1000'}}}))).status).toBe('invalid')
  expect((await f.owner.client.rpc('hub_import_lead',{...base,w:f.other})).error?.code).toBe('42501')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await page.getByRole('navigation').getByRole('button',{name:'Importar estabelecimentos',exact:true}).click()
  const csv='Nome;Cidade;WhatsApp\r\nImportado fictício;Fortaleza;(85) 99999-8888\r\nNovo CSV fictício;Fortaleza;(85) 98888-7777\r\n;Fortaleza;123'
  await page.getByLabel('Arquivo CSV').setInputFiles({name:'ficticio.csv',mimeType:'text/csv',buffer:Buffer.from(csv)})
  await page.getByRole('button',{name:'Validar e mostrar prévia',exact:true}).click()
  const row=page.getByRole('row').filter({hasText:'2 · Importado fictício'})
  await expect(row).toContainText('Possível duplicidade')
  await row.getByRole('combobox',{name:'Ação da linha 2',exact:true}).selectOption('update')
  await row.getByRole('combobox',{name:'Cadastro a atualizar na linha 2',exact:true}).selectOption(a.lead_id)
  await page.getByRole('button',{name:'Confirmar linhas selecionadas',exact:true}).click()
  await expect(row).toContainText('Atualizada')
  await expect(page.getByRole('row').filter({hasText:'3 · Novo CSV fictício'})).toContainText('Criada')
  await expect(page.getByRole('row').filter({hasText:'4 · Nome ausente'})).toContainText('Nome obrigatório')
  await page.getByRole('button',{name:'Confirmar linhas selecionadas',exact:true}).click()
  expect((await checked(f.admin.from('hub_leads').select('id').eq('workspace_id',f.workspace).eq('name','Novo CSV fictício')))).toHaveLength(1)
  await page.getByRole('button',{name:'Validar e mostrar prévia',exact:true}).click()
  await expect(page.getByRole('row').filter({hasText:'3 · Novo CSV fictício'})).toContainText('Criada')
 }finally{sql(`delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
