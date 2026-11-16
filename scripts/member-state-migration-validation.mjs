import {spawnSync} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {sql} from '../e2e/helpers/local-db.mjs'
if(!process.argv.includes('--reset-local-fixtures'))throw Error('Confirme a recriação da pilha fictícia local com --reset-local-fixtures.')
const run=args=>{
 const r=spawnSync('npx',['--yes','supabase@3.0.0',...args],{encoding:'utf8',shell:process.platform==='win32'})
 if(r.status!==0)throw Error('Falha de CLI local: '+r.stderr)
 return r.stdout
}
const status=run(['status','-o','env'])
if(!/^API_URL="http:\/\/127\.0\.0\.1:54321"$/m.test(status.replaceAll('\r','')))throw Error('Somente a pilha local é permitida.')
const w='00000000-0000-4000-8000-000000003805',a='00000000-0000-4000-8000-000000003801',m='00000000-0000-4000-8000-000000003802'
const digest=`select jsonb_build_object(
 'members',(select md5(jsonb_agg(to_jsonb(x)-'active' order by x.user_id)::text) from public.hub_members x where workspace_id='${w}'),
 'events',(select md5(jsonb_agg(to_jsonb(x)-'before_active'-'after_active' order by x.id)::text) from public.hub_role_audit x where workspace_id='${w}'));`
try{
 run(['db','reset','--local','--version','20261115230000','--yes'])
 sql(`insert into auth.users(id,email) values('${a}','migration-admin@example.invalid'),('${m}','migration-member@example.invalid');
 insert into public.hub_workspaces(id,name) values('${w}','Migração fictícia');
 insert into public.hub_members(workspace_id,user_id,role) values('${w}','${a}','admin'),('${w}','${m}','commercial');
 begin;set local role authenticated;select set_config('request.jwt.claim.sub','${a}',true);
 select public.hub_set_roles('${w}','${m}',array['finance','operations']);commit;`)
 const before=sql(digest)
 sql(readFileSync(new URL('../supabase/migrations/20261116010000_desativacao_integrantes.sql',import.meta.url),'utf8'))
 if(sql(digest)!==before)throw Error('Migração alterou vínculos/revisões ou eventos existentes')
 if(sql(`select count(*)=2 and bool_and(active) from public.hub_members where workspace_id='${w}';`)!=='t')throw Error('Backfill não manteve vínculos ativos')
 if(sql(`select count(*)=3 and bool_and(after_active and case when operation='created' then before_active is null else before_active end) from public.hub_role_audit where workspace_id='${w}';`)!=='t')throw Error('Estado histórico incompatível')
 console.log('Migração #17 → estado ativo: dois vínculos e três eventos preservados; papéis/revisões/atores/horários idênticos. Sem concessão ou evento novo.')
}finally{
 run(['db','reset','--local','--yes'])
 console.log('Pilha local fictícia restaurada com todas as migrações atuais.')
}
