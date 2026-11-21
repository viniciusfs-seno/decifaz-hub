begin;
-- Display only. No membership, Auth, assignment, revision or audit row is changed.
-- Keep the existing public RPC signatures and workspace authorization contract.
create function hub_private.workspace_people(w uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with members as (
  select m.user_id,m.active,
   nullif(left(regexp_replace(btrim(coalesce(
    nullif(btrim(u.raw_user_meta_data->>'full_name'),''),
    nullif(btrim(u.raw_user_meta_data->>'name'),''),'')), '\s+', ' ', 'g'),100),'') as display_name,
   nullif(left(split_part(coalesce(u.email,''),'@',1),64),'') as handle,
   row_number() over(order by m.user_id) as ordinal
  from public.hub_members m join auth.users u on u.id=m.user_id where m.workspace_id=w
 ), labels as (
  select *,coalesce(display_name,'Conta '||handle,'Integrante sem nome · '||ordinal) as label from members
 ), counted as (
  select *,count(*) over(partition by lower(label)) as duplicates from labels
 )
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',label||case when duplicates>1 then ' · integrante '||ordinal else '' end,'active',active) order by lower(label),user_id),'[]'::jsonb) from counted
$$;
revoke all on function hub_private.workspace_people(uuid) from public,anon,authenticated;

create or replace function public.hub_registry_people(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return hub_private.workspace_people(w);
end $$;

create or replace function public.hub_work_assignees(w uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'commercial') then raise exception 'Acesso negado' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(p-'active'),'[]'::jsonb) from jsonb_array_elements(hub_private.workspace_people(w)) p where (p->>'active')::boolean);
end $$;
revoke all on function public.hub_registry_people(uuid),public.hub_work_assignees(uuid) from public,anon;
grant execute on function public.hub_registry_people(uuid),public.hub_work_assignees(uuid) to authenticated;
commit;
