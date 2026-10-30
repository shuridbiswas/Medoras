-- Medyra: email notification preferences (owner-only, private).
--
-- Only "activity" emails (comments, connections; not built yet) honour this. Transactional and
-- security emails are always sent. Rows are created on demand when a member changes the setting;
-- a missing row means the default (on). Email addresses are never stored here.

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  notify_activity boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function private.set_updated_at();

alter table public.notification_preferences enable row level security;

revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
grant insert (user_id, notify_activity) on public.notification_preferences to authenticated;
grant update (notify_activity) on public.notification_preferences to authenticated;

create policy "notification_preferences: owner can read"
  on public.notification_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notification_preferences: owner can create"
  on public.notification_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "notification_preferences: owner can update"
  on public.notification_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No DELETE: the row is removed with the member (cascade).
