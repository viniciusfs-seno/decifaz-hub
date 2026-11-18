import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('Contratos: existente/proposta, revisão, documento privado, timeline e papéis',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(120000)
 const f=await operationalFixture(),c=randomUUID(),d=randomUUID()
 try{
  const body={lead_id:f.lead,proposal_id:f.proposal,project_ids:[f.proposal],title:'Contrato fictício',owner:'Sócio fictício',owner_id:f.owner.id,status:'Vigente',starts_on:f.today,ends_on:f.today,renews_on:f.today,notice_days:30,amount:2400,monthly:180,conditions:'Condição reservada fictícia',confirmation:'Documento conferido em teste fictício.'}
  const args={w:f.workspace,c,expected_revision:null,operation_id:randomUUID(),body}
  const saved=await checked(f.owner.client.rpc('hub_save_contract',args));expect(saved.current.proposal_version).toBe(1);expect(saved.current.financial.source_snapshot.record.setup).toBe(2400)
  expect(await checked(f.owner.client.rpc('hub_save_contract',args))).toEqual(saved)
  const existing=await checked(f.owner.client.rpc('hub_save_contract',{...args,c:randomUUID(),operation_id:randomUUID(),body:{...body,proposal_id:null,project_ids:[],title:'Contrato anterior fictício'}}));expect(existing.current.proposal_id).toBeNull()
  const restricted=await checked(f.restricted.client.rpc('hub_contract_detail',{w:f.workspace,c}));expect(restricted).not.toHaveProperty('financial');expect(JSON.stringify(await checked(f.restricted.client.from('hub_contracts').select('*').eq('workspace_id',f.workspace)))).not.toContain('Condição reservada')
  expect((await f.restricted.client.rpc('hub_save_contract',{...args,c:randomUUID(),operation_id:randomUUID()})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_contract_detail',{w:f.other,c})).error?.code).toBe('42501')
  const createdId=randomUUID(),creates=await Promise.all([f.owner,f.second].map(user=>checked(user.client.rpc('hub_save_contract',{...args,c:createdId,operation_id:randomUUID()}))));expect(creates.map(r=>r.status).sort()).toEqual(['conflict','saved'])
  const rejectedId=randomUUID()
  sql(`create function public.test_contract_audit_failure() returns trigger language plpgsql as $$begin if new.record_id='${rejectedId}'::uuid then raise exception 'Falha fictícia de auditoria';end if;return new;end$$;create trigger test_contract_audit_failure before insert on public.hub_registry_events for each row execute function public.test_contract_audit_failure();`)
  try{expect((await f.owner.client.rpc('hub_save_contract',{...args,c:rejectedId,operation_id:randomUUID()})).error).toBeTruthy();expect(await checked(f.owner.client.from('hub_contracts').select('id').eq('id',rejectedId))).toHaveLength(0)}finally{sql('drop trigger test_contract_audit_failure on public.hub_registry_events;drop function public.test_contract_audit_failure();')}
  const updates=await Promise.all([f.owner,f.second].map(user=>checked(user.client.rpc('hub_save_contract',{...args,expected_revision:0,operation_id:randomUUID(),body:{...body,title:'Edição concorrente fictícia'}}))));expect(updates.map(r=>r.status).sort()).toEqual(['conflict','saved'])
  const path=f.workspace+'/contract/'+c+'/'+d+'.pdf',pdf=Buffer.from('%PDF-1.4\nDocumento assinado FICTICIO para homologacao.\n%%EOF')
  await checked(f.owner.client.storage.from('hub-private-documents').upload(path,pdf,{contentType:'application/pdf',cacheControl:'0'}))
  const attach={w:f.workspace,d,k:'contract',r:c,path,label:'contrato-assinado-ficticio.pdf'}
  expect(await checked(f.owner.client.rpc('hub_attach_document',attach))).toBe(d);expect(await checked(f.owner.client.rpc('hub_attach_document',attach))).toBe(d)
  expect((await f.restricted.client.storage.from('hub-private-documents').download(path)).error).toBeTruthy()
  expect((await checked(f.owner.client.storage.from('hub-private-documents').download(path))).size).toBe(pdf.length)
  expect((await f.owner.client.storage.from('hub-private-documents').upload(path,pdf,{contentType:'application/pdf',upsert:true})).error).toBeTruthy()
  const events=await checked(f.owner.client.rpc('hub_registry_timeline',{w:f.workspace,k:'contract',r:c}));expect(events.filter(e=>e.action==='Documento assinado anexado (informado)')).toHaveLength(1);expect(events.some(e=>e.actor_id===f.owner.id)).toBe(true)
  expect(JSON.stringify(await checked(f.restricted.client.rpc('hub_registry_timeline',{w:f.workspace,k:'contract',r:c})))).not.toContain('Condição reservada')
  expect((await f.owner.client.from('hub_registry_events').insert({workspace_id:f.workspace,kind:'contract',record_id:c,action:'Forjado'})).error?.code).toBe('42501')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Contratos',exact:true}).click();await page.getByRole('button',{name:'Edição concorrente fictícia',exact:true}).click();await expect(page.getByRole('dialog').locator('p').filter({hasText:'contrato-assinado-ficticio.pdf'}).getByRole('button',{name:'Baixar documento'})).toBeVisible()
  await page.getByRole('dialog').getByRole('button',{name:'Fechar contrato',exact:true}).click()
  await page.getByRole('button',{name:'Cadastrar contrato',exact:true}).click();await page.getByRole('dialog').getByRole('combobox',{name:'Estabelecimento',exact:true}).selectOption(f.prospect);await page.getByLabel(/^Título do contrato/).fill('Cadastro UI fictício');await page.getByLabel(/^Responsável pelo contrato/).fill('Sócio fictício');await page.getByLabel(/^Confirmação administrativa/).fill('Cadastro legado fictício confirmado');await page.getByRole('button',{name:'Salvar contrato',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Linha do tempo')
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:0}));expect((await f.second.client.rpc('hub_contract_detail',{w:f.workspace,c})).error?.code).toBe('42501');expect((await f.second.client.storage.from('hub-private-documents').download(path)).error).toBeTruthy()
  await f.admin.storage.from('hub-private-documents').remove([path])
 }finally{await f.admin.storage.from('hub-private-documents').remove([f.workspace+'/contract/'+c+'/'+d+'.pdf']);sql(`delete from public.hub_private_documents where workspace_id='${f.workspace}';delete from hub_private.contract_values where workspace_id='${f.workspace}';delete from public.hub_contracts where workspace_id='${f.workspace}';delete from public.hub_registry_events where workspace_id='${f.workspace}';delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
