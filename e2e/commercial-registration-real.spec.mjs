import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import fs from 'node:fs'
test.skip(process.env.HUB_REAL_E2E!=='1','Supabase local obrigatório')
test('Cadastro: IDs estáveis, arquivo, legado, responsável ativo, verificação, isolamento e API',async()=>{
 const f=await operationalFixture()
 try{
  const before=await checked(f.owner.client.from('hub_leads').select('*').eq('id',f.prospect).single());expect(before.profile.segment_id).toBeUndefined()
  let r=await checked(f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:before.revision,body:{name:before.name,profile:{segment_id:'food',origin_id:'other',origin_other:'Evento fictício',owner_id:f.second.id,municipality_id:'2304400',uf:'CE'}}}));expect(r.status).toBe('saved');expect(r.current.profile.segment_legacy).toBe(before.segment);expect(r.current.profile.owner_id).toBe(f.second.id)
  const rename=await checked(f.owner.client.rpc('hub_save_commercial_classification',{w:f.workspace,k:'segment',i:'food',n:'Alimentação revisada fictícia',parent:null,enabled:false,expected_revision:0}));expect(rename.status).toBe('saved')
  const existing=await checked(f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:r.current.revision,body:{name:'Legado permanece editável'}}));expect(existing.current.profile.segment_id).toBe('food');expect(existing.current.segment).toBe('Alimentação revisada fictícia')
  expect((await f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.lead,expected_revision:0,body:{name:'Nova associação negada',profile:{segment_id:'food'}}})).error?.code).toBe('22023')
  expect((await f.restricted.client.rpc('hub_save_commercial_classification',{w:f.workspace,k:'segment',i:'food',n:'Negado',parent:null,enabled:true,expected_revision:1})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_commercial_classifications',{w:f.other})).error?.code).toBe('42501')
  await checked(f.owner.client.rpc('hub_update_member_active',{w:f.workspace,u:f.second.id,enabled:false,expected_revision:0}))
  r=await checked(f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:existing.current.revision,body:{name:'Vínculo antigo preservado'}}));expect(r.current.profile.owner_id).toBe(f.second.id)
  expect((await f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.lead,expected_revision:0,body:{name:'Novo vínculo negado',profile:{owner_id:f.second.id}}})).error?.code).toBe('22023')
  expect((await f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:r.current.revision,body:{name:r.current.name,profile:{verification_code:'checked',verification_criteria:'identity',verification_note:'Não basta'}}})).error?.code).toBe('22023')
  r=await checked(f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:r.current.revision,body:{name:r.current.name,profile:{verification_code:'checked',verification_criteria:'identity,location,contact',verification_note:'Conferência fictícia documentada',whatsapp:'(11) 99999-0000',phone_kind:'br'}}}));expect(r.current.profile.verification_by).toBe(f.owner.id);expect(r.current.profile.phone_normalized).toBe('+5511999990000');expect(r.current.stage).toBe(before.stage)
  expect((await f.owner.client.from('hub_commercial_classification_audit').update({kind:'origin'}).eq('workspace_id',f.workspace)).error?.code).toBe('42501')
  const csv=await checked(f.owner.client.rpc('hub_crm_export',{w:f.workspace}));expect(csv).toContain('"segment_id"');expect(csv).toContain('"food"');expect(csv).not.toContain('2400,00')
 }finally{await f.cleanup()}
})
test('Cadastro: CEP opcional, resposta atrasada, edição preservada, telefone, teclado e celular',async({page})=>{
 const f=await operationalFixture();test.setTimeout(90000)
 try{
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/');await page.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click();await page.getByText('Editar dados do estabelecimento',{exact:true}).click()
  await expect(page.getByLabel('Nome da empresa',{exact:true})).toHaveValue('Studio Aurora · fictício');await page.getByLabel('Pesquisar segmento',{exact:true}).fill('Alimentação');await page.getByLabel('Segmento',{exact:true}).selectOption('food')
  await page.getByRole('button',{name:'Localização',exact:true}).click();await page.getByLabel('CEP',{exact:true}).fill('00000000')
  let release;const gate=new Promise(r=>release=r);const requested=page.waitForRequest(r=>r.url().includes('viacep.com.br'))
  await page.route('https://viacep.com.br/**',async route=>{await gate;await route.fulfill({contentType:'application/json',body:JSON.stringify({uf:'CE',ibge:'2304400',localidade:'Fortaleza',bairro:'Bairro fictício',logradouro:'Sugestão fictícia'})})},{times:1})
  await page.getByRole('button',{name:'Sugerir endereço pelo CEP'}).click();await requested;await page.getByLabel('Logradouro',{exact:true}).fill('Rua digitada durante a consulta');release();await expect(page.getByRole('status').filter({hasText:'Sugestões aplicadas'})).toBeVisible();await expect(page.getByLabel('Logradouro',{exact:true})).toHaveValue('Rua digitada durante a consulta')
  await page.route('https://viacep.com.br/**',route=>route.abort());await page.getByRole('button',{name:'Sugerir endereço pelo CEP'}).click();await expect(page.getByRole('status').filter({hasText:'CEP indisponível'})).toBeVisible()
  await page.getByRole('button',{name:'Canais e contato',exact:true}).click();await page.getByLabel('WhatsApp',{exact:true}).fill('+44 20 7946 0000');await page.getByLabel('Tratamento do telefone').selectOption('international')
  await page.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click();await expect(page.locator('.lead-details').getByText('Ficha salva.',{exact:true})).toBeVisible();const row=await checked(f.owner.client.from('hub_leads').select('profile').eq('id',f.prospect).single());expect(row.profile.street).toBe('Rua digitada durante a consulta');expect(row.profile.phone_normalized).toBe('+442079460000');expect(row.profile.segment_id).toBe('food')
  fs.mkdirSync('.validation/commercial-registration',{recursive:true});for(const [width,theme]of [[1440,'light'],[390,'dark']]){await page.setViewportSize({width,height:900});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:'.validation/commercial-registration/ficha-'+width+'-'+theme+'.png',fullPage:true})}
 }finally{await f.cleanup()}
})
