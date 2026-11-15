begin;
alter table public.hub_members add column role_revision bigint not null default 0 check(role_revision>=0);
create function hub_private.advance_role_revision() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.role is distinct from old.role or new.extra_roles is distinct from old.extra_roles then
  new.role_revision:=old.role_revision+1;
 else new.role_revision:=old.role_revision;
 end if;
 return new;
end;
$$;
revoke all on function hub_private.advance_role_revision() from public,anon,authenticated;
create trigger hub_member_role_revision before update on public.hub_members
for each row execute function hub_private.advance_role_revision();

-- Return type changes atomically; older clients ignore the extra JSON field.
drop function public.hub_list_members(uuid);
create function public.hub_list_members(w uuid)
returns table(user_id uuid,email text,roles text[],revision text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then
  raise insufficient_privilege using message='Sem permissão para consultar a equipe deste espaço';
 end if;
 return query select m.user_id,u.email::text,array[m.role]||m.extra_roles,m.role_revision::text
 from public.hub_members m join auth.users u on u.id=m.user_id
 where m.workspace_id=w order by lower(u.email),m.user_id;
end;
$$;
revoke all on function public.hub_list_members(uuid) from public,anon;
grant execute on function public.hub_list_members(uuid) to authenticated;

create function public.hub_update_member_roles(w uuid,u uuid,r text[],expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_member public.hub_members%rowtype;
begin
 -- Same lock as hub_set_roles: comparison and write cannot interleave with it.
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then
  raise insufficient_privilege using message='Sem permissão para alterar a equipe deste espaço';
 end if;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u for update;
 if not found then return jsonb_build_object('status','missing'); end if;
 if expected_revision is null or expected_revision<0 then return jsonb_build_object('status','rejected'); end if;
 if current_member.role_revision<>expected_revision then
  return jsonb_build_object('status','conflict','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text);
 end if;
 if not public.hub_set_roles(w,u,r) then return jsonb_build_object('status','rejected'); end if;
 select * into current_member from public.hub_members where workspace_id=w and user_id=u;
 return jsonb_build_object('status','saved','roles',array[current_member.role]||current_member.extra_roles,'revision',current_member.role_revision::text);
end;
$$;
revoke all on function public.hub_update_member_roles(uuid,uuid,text[],bigint) from public,anon;
grant execute on function public.hub_update_member_roles(uuid,uuid,text[],bigint) to authenticated;
commit;
