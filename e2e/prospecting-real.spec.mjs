import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
import {sql} from './helpers/local-db.mjs'
test('Prospecção: plano e abordagem atômicos, repetição, conflito e canais sem contato implícito',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Somente Supabase local.');test.setTimeout(90000)
 const f=await operationalFixture()
 try{
  const lead=await checked(f.admin.from('hub_leads').update({profile:{website:'https://example.invalid',instagram:'@ficticio',whatsapp:'85999999999'}}).eq('workspace_id',f.workspace).eq('id',f.prospect).select('revision').single())
  const args={w:f.workspace,l:f.prospect,expected_revision:lead.revision,operation_id:randomUUID(),body:{result:'Tentativa fictícia; sem resposta. Necessidade ainda não confirmada.',next:'Retomar abordagem fictícia',owner:'Equipe fictícia',due:f.today,create_activity:true}}
  const [a,b]=await Promise.all([checked(f.owner.client.rpc('hub_plan_contact',args)),checked(f.owner.client.rpc('hub_plan_contact',args))]);expect(a).toEqual(b)
  expect((await checked(f.admin.from('hub_interactions').select('id').eq('workspace_id',f.workspace).eq('lead_id',f.prospect)))).toHaveLength(1)
  expect((await checked(f.admin.from('hub_activities').select('id').eq('workspace_id',f.workspace).eq('title',args.body.next)))).toHaveLength(1)
  expect((await checked(f.second.client.rpc('hub_plan_contact',{...args,operation_id:randomUUID()}))).status).toBe('conflict')
  expect((await f.owner.client.rpc('hub_plan_contact',{...args,w:f.other,operation_id:randomUUID()})).error?.code).toBe('42501')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await page.getByRole('navigation').getByRole('button',{name:'Central de prospecção',exact:true}).click()
  await expect(page.getByRole('button',{name:'Studio Aurora · fictício',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Studio Aurora · fictício',exact:true}).click()
  await expect(page.getByRole('link',{name:'Abrir WhatsApp',exact:true})).toHaveAttribute('href','https://wa.me/5585999999999')
  await expect(page.getByRole('link',{name:'Abrir Instagram',exact:true})).toHaveAttribute('href','https://www.instagram.com/ficticio/')
  await page.route('https://example.invalid/**',r=>r.fulfill({body:'Canal fictício sem envio'}))
  const popup=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir site',exact:true}).click();await(await popup).close()
  expect((await checked(f.admin.from('hub_interactions').select('id').eq('workspace_id',f.workspace).eq('lead_id',f.prospect)))).toHaveLength(1)
  await page.getByLabel(/^Resultado da abordagem/).fill('Contato fictício realizado; retorno combinado.')
  await page.getByRole('button',{name:'Salvar abordagem e plano',exact:true}).click()
  await expect(page.getByText('Abordagem registrada.',{exact:true})).toBeVisible()
  await expect(page.getByText(/Contato fictício realizado; retorno combinado\./).last()).toBeVisible()
 }finally{sql(`delete from public.hub_lead_audit where workspace_id='${f.workspace}';delete from public.hub_activity_events where workspace_id='${f.workspace}';`);await f.cleanup()}
})
