import {test,expect} from '@playwright/test'
import {randomUUID} from 'node:crypto'
import {operationalFixture,checked} from './helpers/operational-fixture.mjs'
test('Catálogo: admin, arquivo, API restrita, escopo versionado e isolamento',async({page})=>{
 test.skip(process.env.HUB_REAL_E2E!=='1','Requer Supabase local');test.setTimeout(90000)
 const f=await operationalFixture()
 try{
  const args={w:f.workspace,i:null,n:'Solução consultiva fictícia',c:'Atendimento',d:'Descrição pública fictícia',items:['Escopo original'],enabled:true,expected_revision:null}
  expect((await f.restricted.client.rpc('hub_save_solution',args)).error?.code).toBe('42501')
  const saved=await checked(f.owner.client.rpc('hub_save_solution',args)),solution=saved.current
  expect(await checked(f.restricted.client.from('hub_solutions').select('id').eq('workspace_id',f.workspace).eq('name',args.n))).toHaveLength(1)
  expect(await checked(f.second.client.from('hub_solutions').select('id').eq('workspace_id',f.other))).toEqual([])
  const p=randomUUID(),base={w:f.workspace,l:f.prospect,p,s:p,v:1,m:null,body:{title:'Proposta de catálogo',scope:'Escopo registrado original',services:[args.n],setup:200,monthly:20,terms:'Condição reservada',validity:f.today},decision:null,occurred:null,evidence:null}
  expect(await checked(f.owner.client.rpc('hub_save_proposal',base))).toBe(true)
  await checked(f.owner.client.rpc('hub_save_solution',{...args,i:solution.id,items:['Escopo alterado depois'],expected_revision:0}))
  expect(await checked(f.owner.client.rpc('hub_save_proposal',{...base,body:null,decision:'Enviada',occurred:f.today,evidence:'Envio fictício'}))).toBe(true)
  const next=randomUUID()
  expect(await checked(f.owner.client.rpc('hub_save_proposal',{...base,p:next,v:2,body:{...base.body,scope:'Escopo da revisão'}}))).toBe(true)
  const versions=await checked(f.owner.client.from('hub_proposals_visible').select('record,version').eq('workspace_id',f.workspace).eq('series_id',p).order('version'))
  expect(versions[0].record.scope).toBe('Escopo registrado original');expect(versions[0].record.terms).toBe('Condição reservada')
  expect(versions.map(v=>v.record.catalog_snapshot[0].scope_items)).toEqual([['Escopo original'],['Escopo original']])
  await checked(f.owner.client.rpc('hub_save_solution',{...args,i:solution.id,enabled:false,expected_revision:1}))
  const fresh=randomUUID()
  expect((await f.owner.client.rpc('hub_save_proposal',{...base,p:fresh,s:fresh})).error?.code).toBe('22023')
  const restricted=await checked(f.restricted.client.from('hub_proposals_visible').select('record').eq('workspace_id',f.workspace).eq('id',p).single())
  expect(restricted.record.setup).toBeUndefined();expect(restricted.record.monthly).toBeUndefined();expect(restricted.record.terms).toBeUndefined()
  expect((await f.restricted.client.from('hub_proposals').select('record')).error?.code).toBe('42501')
  await page.addInitScript(s=>localStorage.setItem('sb-127-auth-token',JSON.stringify(s)),f.owner.session);await page.goto('/')
  await page.getByRole('navigation').getByRole('button',{name:'Catálogo de soluções',exact:true}).click()
  await page.getByLabel('Mostrar arquivadas').check();await page.getByLabel('Buscar solução').fill(args.n)
  await expect(page.getByRole('heading',{name:args.n,exact:true})).toBeVisible()
  await expect(page.getByText('Atendimento · Arquivada')).toBeVisible()
 }finally{await f.cleanup()}
})
