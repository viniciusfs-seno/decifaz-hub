begin;
-- Admin-only directory, scoped to existing members. No Auth metadata or tokens.
create function public.hub_list_members(w uuid)
returns table(user_id uuid,email text,roles text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then
  raise insufficient_privilege using message='Sem permissão para consultar a equipe deste espaço';
 end if;
 return query select m.user_id,u.email::text,array[m.role]||m.extra_roles
 from public.hub_members m join auth.users u on u.id=m.user_id
 where m.workspace_id=w order by lower(u.email),m.user_id;
end;
$$;
revoke all on function public.hub_list_members(uuid) from public,anon;
grant execute on function public.hub_list_members(uuid) to authenticated;
commit;
