begin;
-- Workspace labels do not modify Auth, memberships, roles or their revisions.
create table hub_private.member_labels(
 workspace_id uuid not null,user_id uuid not null,display_name text not null,
 revision bigint not null default 1,primary key(workspace_id,user_id),
 foreign key(workspace_id,user_id) references public.hub_members(workspace_id,user_id) on delete cascade,
 check(length(display_name)<=80)
);
revoke all on hub_private.member_labels from public,anon,authenticated;
create trigger member_labels_clock after insert or update on hub_private.member_labels for each row execute function hub_private.bump_workspace_version();

create function public.hub_member_labels(w uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.hub_can(w,'admin',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',coalesce(l.display_name,''),'revision',coalesce(l.revision,0)) order by m.user_id),'[]') from public.hub_members m left join hub_private.member_labels l on l.workspace_id=m.workspace_id and l.user_id=m.user_id where m.workspace_id=w);
end $$;

create function public.hub_set_member_label(w uuid,u uuid,n text,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_label hub_private.member_labels; normalized text; previous text; rev bigint;
begin
 perform 1 from public.hub_workspaces where id=w for update;
 if not public.hub_can(w,'admin',true) then raise exception 'Acesso negado' using errcode='42501';end if;
 if n is null or expected_revision is null or expected_revision<0 then raise exception 'Informe nome e revisão' using errcode='22023';end if;
 normalized:=regexp_replace(btrim(n),'\s+',' ','g');
 if length(normalized)>80 or normalized ~ '[[:cntrl:]]' then raise exception 'Use até 80 caracteres, sem caracteres de controle' using errcode='22023';end if;
 perform 1 from public.hub_members where workspace_id=w and user_id=u for update;
 if not found then raise exception 'Integrante indisponível' using errcode='42501';end if;
 select * into current_label from hub_private.member_labels where workspace_id=w and user_id=u;
 previous:=coalesce(current_label.display_name,'');rev:=coalesce(current_label.revision,0);
 if expected_revision<>rev then return jsonb_build_object('status','conflict','display_name',previous,'revision',rev);end if;
 if normalized=previous then return jsonb_build_object('status','saved','display_name',previous,'revision',rev);end if;
 insert into hub_private.member_labels values(w,u,normalized,rev+1) on conflict(workspace_id,user_id) do update set display_name=excluded.display_name,revision=excluded.revision;
 insert into public.hub_registry_events(workspace_id,kind,record_id,actor_id,action,before_record,after_record,revision)
 values(w,'member',u,auth.uid(),'Identificação do integrante atualizada',jsonb_build_object('display_name',previous),jsonb_build_object('display_name',normalized),rev+1);
 return jsonb_build_object('status','saved','display_name',normalized,'revision',rev+1);
end $$;

create or replace function hub_private.workspace_people(w uuid) returns jsonb language sql stable security definer set search_path='' as $$
 with members as (
  select m.user_id,m.active,
   nullif(left(regexp_replace(btrim(coalesce(nullif(l.display_name,''),nullif(btrim(u.raw_user_meta_data->>'full_name'),''),nullif(btrim(u.raw_user_meta_data->>'name'),''),'')), '\s+', ' ', 'g'),100),'') as display_name,
   nullif(left(split_part(coalesce(u.email,''),'@',1),64),'') as handle,
   row_number() over(order by m.user_id) as ordinal
  from public.hub_members m join auth.users u on u.id=m.user_id left join hub_private.member_labels l on l.workspace_id=m.workspace_id and l.user_id=m.user_id where m.workspace_id=w
 ), labels as (
  select *,coalesce(display_name,'Conta '||handle,'Integrante sem nome · '||ordinal) as label from members
 ), counted as (select *,count(*) over(partition by lower(label)) as duplicates from labels)
 select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',label||case when duplicates>1 then ' · integrante '||ordinal else '' end,'active',active) order by lower(label),user_id),'[]'::jsonb) from counted
$$;
revoke all on function public.hub_member_labels(uuid),public.hub_set_member_label(uuid,uuid,text,bigint) from public,anon;
grant execute on function public.hub_member_labels(uuid),public.hub_set_member_label(uuid,uuid,text,bigint) to authenticated;
revoke all on function hub_private.workspace_people(uuid) from public,anon,authenticated;
commit;
