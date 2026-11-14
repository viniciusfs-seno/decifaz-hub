begin;
alter table public.hub_projects drop constraint hub_project_delivery_required;
create function hub_private.require_delivery()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status<>'Entregue' then return new; end if;
 if tg_op='UPDATE' then
  if old.status='Entregue' and old.delivery is null and new.delivery is null then return new; end if;
 end if;
 if not coalesce(jsonb_typeof(new.delivery)='object'
  and new.delivery->'checks' @> '["tests","scope","pending"]'::jsonb
  and nullif(btrim(new.delivery->>'reference'),'') is not null and new.delivery->>'acceptedAt' is not null,false)
 then raise check_violation using message='Registre o aceite da entrega antes de concluir o projeto'; end if;
 return new;
end;
$$;
revoke all on function hub_private.require_delivery() from public,anon,authenticated;
create trigger hub_project_delivery_guard before insert or update on public.hub_projects
 for each row execute function hub_private.require_delivery();
commit;
