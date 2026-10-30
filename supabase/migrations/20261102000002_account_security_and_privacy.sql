-- Medyra Phase 4A: account security (MFA recovery) and privacy workflows.
--
-- What this adds
--   * mfa_recovery_codes / redeem_mfa_recovery_code: one-time codes that reset a member's
--     authenticator factors when the device is lost. Only hashes are stored.
--   * profiles.profile_visibility and profiles.directory_listed: member-controlled privacy settings.
--     Visibility is enforced in the database for the education, experience and skills tables; for the
--     profile's own columns (bio and so on) it is applied by the application only.
--   * consent_records: which version of each policy a member accepted, and when.
--   * data_requests: export and deletion requests (deletion has a cooling-off period).
--   * retention_policies and private.run_retention_purge: how long operational data is kept.
--
-- This is technical groundwork. It is not legal advice and does not by itself make Medyra
-- compliant with any privacy law; see DEPLOYMENT.md and the policy drafts.

-- ---------------------------------------------------------------------------
-- Helper: is this session allowed to manage MFA material?
--   true when the member has no verified factor, or the session already passed a second factor.
-- ---------------------------------------------------------------------------
create function private.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (select auth.uid()) and f.status = 'verified'
  ) or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
$$;

-- ---------------------------------------------------------------------------
-- MFA recovery codes
-- ---------------------------------------------------------------------------
create table public.mfa_recovery_codes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- sha256 of the code (codes are random and long, so an unsalted hash is enough).
  code_hash text not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  primary key (user_id, code_hash),
  constraint mfa_recovery_codes_hash_shape check (code_hash ~ '^[0-9a-f]{64}$')
);

create table public.mfa_recovery_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index mfa_recovery_attempts_user_idx on public.mfa_recovery_attempts (user_id, attempted_at desc);

-- Redeeming a code removes the member's authenticator factors so they can sign in and enroll a new
-- device. Five wrong codes per hour lock the attempt (the member can still use the device).
create function public.redeem_mfa_recovery_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  recent integer;
  hashed text;
begin
  if me is null then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  select count(*) into recent from public.mfa_recovery_attempts
    where user_id = me and attempted_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'Too many attempts. Please try again later.' using errcode = 'check_violation';
  end if;

  hashed := encode(sha256(convert_to(lower(regexp_replace(coalesce(p_code, ''), '[^0-9a-zA-Z]', '', 'g')), 'UTF8')), 'hex');

  update public.mfa_recovery_codes set used_at = now()
    where user_id = me and code_hash = hashed and used_at is null;
  if not found then
    insert into public.mfa_recovery_attempts (user_id) values (me);
    return false;
  end if;

  delete from auth.mfa_factors where user_id = me;
  -- The remaining codes belonged to the old setup; the member generates new ones after enrolling again.
  delete from public.mfa_recovery_codes where user_id = me;
  perform private.audit('mfa.recovery_used', 'member', me, '{}');
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profile privacy settings
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column profile_visibility text not null default 'members',
  add column directory_listed boolean not null default true,
  add constraint profiles_visibility_valid check (profile_visibility in ('members', 'connections'));

grant update (profile_visibility, directory_listed) on public.profiles to authenticated;

-- Fields-of-practice filter in the member directory.
create index profiles_fields_idx on public.profiles using gin (fields);

-- Education, experience and skills follow the visibility setting: "connections" means the owner
-- and accepted connections only.
create function private.can_see_profile_details(p_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_owner = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = p_owner and p.onboarding_completed
        and (
          p.profile_visibility = 'members'
          or exists (
            select 1 from public.connections c
            where c.status = 'accepted'
              and ((c.requester_id = (select auth.uid()) and c.addressee_id = p_owner)
                or (c.addressee_id = (select auth.uid()) and c.requester_id = p_owner))
          )
        )
    )
$$;

drop policy "profile_education: members can view completed profiles and their own" on public.profile_education;
create policy "profile_education: visible per the owner's privacy setting"
  on public.profile_education for select to authenticated
  using ((select private.can_see_profile_details(profile_id)));

drop policy "profile_experience: members can view completed profiles and their own" on public.profile_experience;
create policy "profile_experience: visible per the owner's privacy setting"
  on public.profile_experience for select to authenticated
  using ((select private.can_see_profile_details(profile_id)));

drop policy "profile_skills: members can view completed profiles and their own" on public.profile_skills;
create policy "profile_skills: visible per the owner's privacy setting"
  on public.profile_skills for select to authenticated
  using ((select private.can_see_profile_details(profile_id)));

-- ---------------------------------------------------------------------------
-- Consent records (append-only)
-- ---------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  constraint consent_records_kind_valid check (kind in ('terms', 'privacy', 'community_guidelines')),
  constraint consent_records_version_length check (char_length(version) between 1 and 40),
  constraint consent_records_unique unique (user_id, kind, version)
);

-- ---------------------------------------------------------------------------
-- Data requests (export and account deletion)
-- ---------------------------------------------------------------------------
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  -- Kept (as null) after the account is gone, as proof the request was handled.
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null,
  status text not null default 'requested',
  requested_at timestamptz not null default now(),
  -- Deletion waits out a cooling-off period so an accidental or hijacked request can be cancelled.
  scheduled_for timestamptz not null default now(),
  completed_at timestamptz,
  constraint data_requests_kind_valid check (kind in ('export', 'deletion')),
  constraint data_requests_status_valid check (status in ('requested', 'cancelled', 'completed'))
);

create unique index data_requests_one_open on public.data_requests (user_id, kind) where status = 'requested';
create index data_requests_user_idx on public.data_requests (user_id, requested_at desc);
create index data_requests_due_idx on public.data_requests (scheduled_for) where status = 'requested';

create function private.schedule_data_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.scheduled_for := case when new.kind = 'deletion' then now() + interval '30 days' else now() end;
  return new;
end;
$$;

create trigger data_requests_schedule before insert on public.data_requests
  for each row execute function private.schedule_data_request();

-- A self-serve export is generated on the spot by the application; this records that it happened.
create function public.record_data_export()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  request_id uuid;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  insert into public.data_requests (user_id, kind, status, completed_at)
  values (me, 'export', 'completed', now())
  returning id into request_id;
  return request_id;
end;
$$;

-- Staff carry out a deletion once its cooling-off period has passed. Removing the auth user
-- cascades to the profile and everything the member owns.
create function public.admin_execute_deletion(p_request uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.data_requests;
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.data_requests where id = p_request for update;
  if not found or r.kind <> 'deletion' or r.status <> 'requested' or r.user_id is null then
    raise exception 'That is not an open deletion request.' using errcode = 'no_data_found';
  end if;
  if r.scheduled_for > now() then
    raise exception 'The cooling-off period has not ended.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.staff_roles s where s.user_id = r.user_id) then
    raise exception 'Remove the staff role first.' using errcode = 'check_violation';
  end if;

  perform private.audit('account.deleted', 'data_request', p_request, '{}');
  update public.data_requests set status = 'completed', completed_at = now() where id = p_request;
  delete from auth.users where id = r.user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
create table public.retention_policies (
  key text primary key,
  days integer not null,
  description text not null,
  constraint retention_policies_days_positive check (days > 0)
);

insert into public.retention_policies (key, days, description) values
  ('read_notifications', 90, 'Read notifications are deleted after this many days.'),
  ('resolved_reports', 365, 'Resolved reports and their decisions are deleted after this many days.'),
  ('audit_logs', 730, 'Audit log entries are deleted after this many days.'),
  ('recovery_attempts', 2, 'Failed recovery-code attempts are deleted after this many days.'),
  ('completed_data_requests', 365, 'Completed or cancelled data requests are deleted after this many days.');

create function public.set_retention_days(p_key text, p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.retention_policies set days = p_days where key = p_key;
  if not found then
    raise exception 'Unknown retention setting' using errcode = 'no_data_found';
  end if;
  perform private.audit('retention.changed', 'retention', null, jsonb_build_object('key', p_key, 'days', p_days));
end;
$$;

-- The audit log is append-only, except for the retention job below.
create or replace function private.deny_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('medyra.retention_purge', true) = 'on' then
    return old;
  end if;
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end;
$$;

-- Run on a schedule by the database owner (for example pg_cron); no client can call it.
create function private.run_retention_purge()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  days integer;
  n_notifications integer;
  n_reports integer;
  n_audit integer;
  n_attempts integer;
  n_requests integer;
begin
  select p.days into days from public.retention_policies p where p.key = 'read_notifications';
  delete from public.notifications where read_at is not null and read_at < now() - make_interval(days => days);
  get diagnostics n_notifications = row_count;

  select p.days into days from public.retention_policies p where p.key = 'resolved_reports';
  delete from public.reports where status in ('actioned', 'dismissed') and resolved_at < now() - make_interval(days => days);
  get diagnostics n_reports = row_count;

  select p.days into days from public.retention_policies p where p.key = 'recovery_attempts';
  delete from public.mfa_recovery_attempts where attempted_at < now() - make_interval(days => days);
  get diagnostics n_attempts = row_count;

  select p.days into days from public.retention_policies p where p.key = 'completed_data_requests';
  delete from public.data_requests where status in ('completed', 'cancelled') and coalesce(completed_at, requested_at) < now() - make_interval(days => days);
  get diagnostics n_requests = row_count;

  select p.days into days from public.retention_policies p where p.key = 'audit_logs';
  perform set_config('medyra.retention_purge', 'on', true);
  delete from public.audit_logs where created_at < now() - make_interval(days => days);
  get diagnostics n_audit = row_count;
  perform set_config('medyra.retention_purge', 'off', true);

  return jsonb_build_object(
    'read_notifications', n_notifications, 'resolved_reports', n_reports, 'audit_logs', n_audit,
    'recovery_attempts', n_attempts, 'completed_data_requests', n_requests
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------
alter table public.mfa_recovery_codes enable row level security;
alter table public.mfa_recovery_attempts enable row level security;
alter table public.consent_records enable row level security;
alter table public.data_requests enable row level security;
alter table public.retention_policies enable row level security;

revoke all on public.mfa_recovery_codes, public.mfa_recovery_attempts, public.consent_records,
  public.data_requests, public.retention_policies from anon, authenticated;

-- Recovery codes: the hash column is never readable by the client.
grant select (user_id, created_at, used_at) on public.mfa_recovery_codes to authenticated;
grant insert (user_id, code_hash) on public.mfa_recovery_codes to authenticated;
grant delete on public.mfa_recovery_codes to authenticated;
-- Attempts are written and read only by redeem_mfa_recovery_code.

grant select on public.consent_records to authenticated;
grant insert (user_id, kind, version) on public.consent_records to authenticated;

grant select on public.data_requests to authenticated;
grant insert (user_id, kind) on public.data_requests to authenticated;
grant update (status) on public.data_requests to authenticated;

grant select on public.retention_policies to authenticated;

create policy "mfa_recovery_codes: owner can read"
  on public.mfa_recovery_codes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mfa_recovery_codes: owner can create after a second factor"
  on public.mfa_recovery_codes for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.mfa_ok()));
create policy "mfa_recovery_codes: owner can replace after a second factor"
  on public.mfa_recovery_codes for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.mfa_ok()));

create policy "consent_records: owner can read"
  on public.consent_records for select to authenticated
  using (user_id = (select auth.uid()));
create policy "consent_records: owner can record their own consent"
  on public.consent_records for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "data_requests: owner or staff can read"
  on public.data_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));
create policy "data_requests: owner can ask for deletion"
  on public.data_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and kind = 'deletion' and (select private.is_member()));
create policy "data_requests: owner can cancel while requested"
  on public.data_requests for update to authenticated
  using (user_id = (select auth.uid()) and status = 'requested' and kind = 'deletion')
  with check (user_id = (select auth.uid()) and status = 'cancelled');

create policy "retention_policies: members can read"
  on public.retention_policies for select to authenticated
  using (true);

revoke execute on function public.redeem_mfa_recovery_code(text) from public, anon;
revoke execute on function public.record_data_export() from public, anon;
revoke execute on function public.admin_execute_deletion(uuid) from public, anon;
revoke execute on function public.set_retention_days(text, integer) from public, anon;
grant execute on function public.redeem_mfa_recovery_code(text) to authenticated;
grant execute on function public.record_data_export() to authenticated;
grant execute on function public.admin_execute_deletion(uuid) to authenticated;
grant execute on function public.set_retention_days(text, integer) to authenticated;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;
grant execute on function private.mfa_ok() to authenticated;
grant execute on function private.can_see_profile_details(uuid) to authenticated;
