-- ============================================================================
-- Fix: events_select must allow the host directly, not only via event_members.
-- The host is enrolled in event_members by an AFTER INSERT trigger, which has
-- not fired yet when PostgREST evaluates the RETURNING row on `insert().select()`
-- — so the SELECT policy (is_event_member) saw no membership and the insert's
-- returned row was rejected ("new row violates row-level security policy").
-- Adding the immediate `host_user_id = auth.uid()` branch (mirrors crews_select)
-- fixes event creation while keeping guest/crew read access intact.
-- ============================================================================
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated
  using (host_user_id = auth.uid() or public.is_event_member(id));
