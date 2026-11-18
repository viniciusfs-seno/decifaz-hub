import {test,expect} from '@playwright/test'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test.use({actionTimeout:15000})
test('Ficha: campos antigos, duas sessões, conflito, celular, autorização e auditoria atômica',async({browser})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(120000)
 const f=await operationalFixture(),contexts=[]
 const open=async(user,width)=>{const c=await browser.newContext({viewport:{width,height:900}});contexts.push(c);const p=await c.newPage();await p.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),user.session);await p.goto('/');await p.getByRole('heading',{name:'Fila de ações'}).waitFor();const menu=p.getByRole('button',{name:'Abrir navegação',exact:true});if(await menu.isVisible())await menu.click();await p.getByRole('navigation').getByRole('button',{name:'Captação e CRM',exact:true}).click();await p.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click();await p.locator('summary').filter({hasText:'Editar dados do estabelecimento'}).click();return p}
 try{
  await checked(f.admin.from('hub_leads').update({profile:{owner:'Caio · fictício',legacy_extra:{preserved:true}}}).eq('workspace_id',f.workspace).eq('id',f.prospect))
  const page=await open(f.owner,1440),second=await open(f.second,390)
  for(const p of [page,second]){await p.getByText('Canais e contato',{exact:true}).click();await p.getByText('Contexto comercial',{exact:true}).click()}
  await page.getByLabel('Responsável pelo estabelecimento',{exact:true}).fill('Pessoa fictícia')
  await page.getByLabel('Contato do responsável',{exact:true}).fill('contato@example.invalid')
  await page.getByLabel('WhatsApp',{exact:true}).fill('00000000000')
  await page.getByLabel('Origem da oportunidade',{exact:true}).fill('Indicação fictícia')
  await page.getByLabel('Necessidades identificadas',{exact:true}).fill('Organizar o atendimento')
  await page.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click()
  await expect(page.getByText('Pessoa fictícia · contato@example.invalid',{exact:true})).toBeVisible()
  await second.getByLabel('Responsável pelo estabelecimento',{exact:true}).fill('Seleção desatualizada')
  await second.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click()
  await expect(second.getByRole('alert')).toContainText('Outra sessão alterou')
  await expect(second.getByLabel('Responsável pelo estabelecimento',{exact:true})).toHaveValue('Pessoa fictícia')
  await second.getByLabel('Contato do responsável',{exact:true}).fill('nova-referencia@example.invalid')
  await second.getByRole('button',{name:'Salvar estabelecimento',exact:true}).click()
  await expect(second.getByRole('status').filter({hasText:'Ficha salva.'}).first()).toBeVisible()
  const current=await checked(f.owner.client.from('hub_leads').select('*').eq('workspace_id',f.workspace).eq('id',f.prospect).single())
  expect(current.profile.contactInfo).toBe('nova-referencia@example.invalid')
  expect(current.profile.legacy_extra).toEqual({preserved:true})
  expect(current.profile.contact).toBe('Pessoa fictícia');expect(current.profile.origin).toBe('Indicação fictícia');expect(current.profile.owner).toBe('Caio · fictício')
  const audit=await checked(f.owner.client.from('hub_lead_audit').select('*').eq('workspace_id',f.workspace).eq('lead_id',f.prospect).order('id'))
  expect(audit).toHaveLength(4);expect(audit.at(-1).actor_id).toBe(f.second.id);expect(audit.at(-1).before_record.revision+1).toBe(audit.at(-1).after_record.revision)
  expect((await f.restricted.client.from('hub_lead_audit').select('*').eq('workspace_id',f.workspace)).data).toEqual([])
  expect((await f.owner.client.from('hub_lead_audit').insert({workspace_id:f.workspace,lead_id:f.prospect,after_record:{}})).error?.code).toBe('42501')
  expect((await f.owner.client.rpc('hub_save_lead',{w:f.other,l:f.prospect,expected_revision:current.revision,body:{name:'Outro'}})).error?.code).toBe('42501')
  // A denied writer and an inactive JWT cannot save a ficha.
  await checked(f.owner.client.rpc('hub_set_roles',{w:f.workspace,u:f.restricted.id,r:['operations']}))
  expect((await f.restricted.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:current.revision,body:{name:'Negado'}})).error?.code).toBe('42501')
  sql(`create function hub_private.fail_lead_audit_test() returns trigger language plpgsql as $$begin raise exception 'falha fictícia';end$$;create trigger fail_lead_audit_test before insert on public.hub_lead_audit for each row when (new.workspace_id='${f.workspace}'::uuid) execute function hub_private.fail_lead_audit_test();`)
  try{expect((await f.owner.client.rpc('hub_save_lead',{w:f.workspace,l:f.prospect,expected_revision:current.revision,body:{name:'Não deve persistir'}})).error).toBeTruthy()}finally{sql('drop trigger fail_lead_audit_test on public.hub_lead_audit;drop function hub_private.fail_lead_audit_test();')}
  expect((await checked(f.owner.client.from('hub_leads').select('revision').eq('workspace_id',f.workspace).eq('id',f.prospect).single())).revision).toBe(current.revision)
  const geometry=await second.evaluate(()=>({fits:document.documentElement.scrollWidth<=innerWidth+1,width:document.documentElement.scrollWidth,inner:innerWidth,x:scrollX,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.scrollWidth>e.clientWidth+2).slice(0,12).map(e=>({tag:e.tagName,class:e.className,width:Math.round(e.getBoundingClientRect().width),scroll:e.scrollWidth,client:e.clientWidth}))}))
  expect(geometry.fits,JSON.stringify(geometry)).toBe(true)
 }finally{for(const c of contexts)await c.close();await f.cleanup()}
})
