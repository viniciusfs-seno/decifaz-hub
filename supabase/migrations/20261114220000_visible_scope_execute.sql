begin;
-- Functions in view expressions execute with the querying user's function
-- privileges. This helper only redacts the supplied JSON; it reads no business
-- table and cannot disclose a record supplied by another user.
grant execute on function hub_private.visible_scope(uuid,jsonb) to authenticated;
commit;
