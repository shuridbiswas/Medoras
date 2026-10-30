-- Medyra Phase 4A: user safety and moderation foundation.
--
-- What this adds
--   * member_mutes        private "hide this member" list (blocks already exist, see network migration)
--   * reports             user reports of a post, comment or profile (created only through submit_report)
--   * staff_roles         who may use the admin area (managed in SQL by the project owner, never by the app)
--   * member_status       active or suspended
--   * member_notices      what a member is told about a moderation decision (never internal notes)
--   * appeals             a member's appeal of a notice
--   * moderation_actions  internal record of each decision
--   * audit_logs          append-only record of staff actions (ids and decisions, never content)
--   * moderate_report, set_member_status, decide_appeal, claim_report, submit_report (RPC)
--
-- Authorization model: nothing here is writable by a client directly except a member's own mutes
-- and appeals. Reports are created by submit_report (which validates the target and snapshots a
-- short excerpt so a report stays reviewable after the content is deleted). Every staff action
-- goes through a security definer function that checks private.is_admin() and writes the audit
-- log in the same transaction. No AI or automated moderation exists: these are human decisions.

-- ---------------------------------------------------------------------------
-- Status and staff roles
-- ---------------------------------------------------------------------------
create table public.member_status (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  status text not null default 'active',
  reason text,
  updated_at timestamptz not null default now(),
  constraint member_status_valid check (status in ('active', 'suspended')),
  constraint member_status_reason_length check (reason is null or char_length(reason) <= 500)
);

create table public.staff_roles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role text not null,
  granted_at timestamptz not null default now(),
  constraint staff_roles_valid check (role in ('admin'))
);

-- A suspended member counts as "not a member" for every policy that calls private.is_member().
create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarding_completed
  ) and not exists (
    select 1 from public.member_status s
    where s.user_id = (select auth.uid()) and s.status = 'suspended'
  )
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff_roles r
    where r.user_id = (select auth.uid()) and r.role = 'admin'
  )
$$;

-- ---------------------------------------------------------------------------
-- Mutes (private, one direction)
-- ---------------------------------------------------------------------------
create table public.member_mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  constraint member_mutes_not_self check (muter_id <> muted_id)
);

-- ---------------------------------------------------------------------------
-- Reports, notices, appeals, decisions, audit
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  -- Kept (as null) if the reporter later deletes their account.
  reporter_id uuid references public.profiles (id) on delete set null,
  target_type text not null,
  target_id uuid not null,
  -- Who wrote the content / owns the profile at report time.
  target_member_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  details text,
  -- A short snapshot so the report can be reviewed even after the content is removed.
  excerpt text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,

  constraint reports_target_valid check (target_type in ('post', 'comment', 'profile')),
  constraint reports_reason_valid check (reason in (
    'harassment', 'hate_or_discrimination', 'patient_privacy', 'medical_misinformation',
    'spam', 'impersonation', 'inappropriate_content', 'safety_concern', 'other'
  )),
  constraint reports_status_valid check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  constraint reports_details_length check (details is null or char_length(details) <= 1000),
  constraint reports_excerpt_length check (excerpt is null or char_length(excerpt) <= 300)
);

-- One live report per reporter and target; a resolved one can be filed again.
create unique index reports_one_live_per_reporter
  on public.reports (reporter_id, target_type, target_id)
  where status in ('open', 'reviewing');
create index reports_queue_idx on public.reports (status, created_at);
create index reports_target_member_idx on public.reports (target_member_id);
create index reports_reporter_idx on public.reports (reporter_id, created_at desc);

create table public.member_notices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint member_notices_kind_valid check (kind in (
    'warning', 'content_removed', 'suspended', 'restored', 'appeal_decision'
  )),
  constraint member_notices_message_length check (char_length(message) between 1 and 1000)
);
create index member_notices_member_idx on public.member_notices (member_id, created_at desc);

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references public.member_notices (id) on delete cascade,
  member_id uuid not null references public.profiles (id) on delete cascade,
  message text not null,
  status text not null default 'open',
  decided_by uuid references public.profiles (id) on delete set null,
  decision_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint appeals_status_valid check (status in ('open', 'upheld', 'overturned')),
  constraint appeals_message_length check (char_length(message) between 1 and 2000),
  constraint appeals_note_length check (decision_note is null or char_length(decision_note) <= 1000),
  constraint appeals_one_per_notice unique (notice_id)
);
create index appeals_queue_idx on public.appeals (status, created_at);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  moderator_id uuid references public.profiles (id) on delete set null,
  member_id uuid references public.profiles (id) on delete set null,
  action text not null,
  -- Internal note: never shown to the member.
  note text,
  created_at timestamptz not null default now(),
  constraint moderation_actions_action_valid check (action in (
    'dismiss', 'warn', 'remove_content', 'suspend', 'restore', 'appeal_upheld', 'appeal_overturned'
  )),
  constraint moderation_actions_note_length check (note is null or char_length(note) <= 1000)
);
create index moderation_actions_member_idx on public.moderation_actions (member_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  -- Ids and decisions only. Never post, comment or profile text.
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_recent_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

create function private.deny_audit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function private.deny_audit_change();

create function private.audit(p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values ((select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit a report (any active member)
-- ---------------------------------------------------------------------------
create function public.submit_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  owner_id uuid;
  snapshot text;
  recent integer;
  report_id uuid;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  if p_target_type = 'post' then
    select author_id, left(body, 300) into owner_id, snapshot from public.posts where id = p_target_id;
  elsif p_target_type = 'comment' then
    select author_id, left(body, 300) into owner_id, snapshot from public.post_comments where id = p_target_id;
  elsif p_target_type = 'profile' then
    select id, left(coalesce(headline, first_name), 300) into owner_id, snapshot
      from public.profiles where id = p_target_id and onboarding_completed;
  else
    raise exception 'Unknown report target' using errcode = 'check_violation';
  end if;

  if owner_id is null then
    raise exception 'That content is no longer available.' using errcode = 'no_data_found';
  end if;
  if owner_id = me then
    raise exception 'You cannot report your own content.' using errcode = 'check_violation';
  end if;

  select count(*) into recent from public.reports
    where reporter_id = me and created_at > now() - interval '1 hour';
  if recent >= 10 then
    raise exception 'You are sending reports too quickly. Please try again later.'
      using errcode = 'check_violation';
  end if;

  insert into public.reports (reporter_id, target_type, target_id, target_member_id, reason, details, excerpt)
  values (me, p_target_type, p_target_id, owner_id, p_reason, nullif(btrim(p_details), ''), snapshot)
  returning id into report_id;
  return report_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: staff actions (admin only, always audited)
-- ---------------------------------------------------------------------------
create function public.claim_report(p_report uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.reports
    set status = 'reviewing', reviewed_by = (select auth.uid())
    where id = p_report and status = 'open';
  if not found then
    raise exception 'That report is not open.' using errcode = 'no_data_found';
  end if;
  perform private.audit('report.claim', 'report', p_report, '{}');
end;
$$;

create function public.moderate_report(
  p_report uuid,
  p_decision text,
  p_note text default null,
  p_member_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.reports;
  member_message text := nullif(btrim(p_member_message), '');
  kind text;
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('dismiss', 'warn', 'remove_content', 'suspend') then
    raise exception 'Unknown decision' using errcode = 'check_violation';
  end if;
  if p_decision <> 'dismiss' and member_message is null then
    raise exception 'A message for the member is required.' using errcode = 'check_violation';
  end if;

  select * into r from public.reports where id = p_report for update;
  if not found or r.status not in ('open', 'reviewing') then
    raise exception 'That report is not open.' using errcode = 'no_data_found';
  end if;
  if p_decision = 'suspend' and (
    r.target_member_id is null
    or r.target_member_id = (select auth.uid())
    or exists (select 1 from public.staff_roles s where s.user_id = r.target_member_id)
  ) then
    raise exception 'That member cannot be suspended from here.' using errcode = 'check_violation';
  end if;

  if p_decision = 'remove_content' then
    if r.target_type = 'post' then
      delete from public.posts where id = r.target_id;
    elsif r.target_type = 'comment' then
      delete from public.post_comments where id = r.target_id;
    else
      raise exception 'A profile cannot be removed; warn or suspend instead.' using errcode = 'check_violation';
    end if;
  end if;

  if p_decision = 'suspend' then
    insert into public.member_status (user_id, status, reason, updated_at)
    values (r.target_member_id, 'suspended', left(member_message, 500), now())
    on conflict (user_id) do update
      set status = 'suspended', reason = excluded.reason, updated_at = now();
  end if;

  if p_decision <> 'dismiss' and r.target_member_id is not null then
    kind := case p_decision
      when 'warn' then 'warning'
      when 'remove_content' then 'content_removed'
      else 'suspended'
    end;
    insert into public.member_notices (member_id, kind, message)
    values (r.target_member_id, kind, member_message);
  end if;

  update public.reports
    set status = case when p_decision = 'dismiss' then 'dismissed' else 'actioned' end,
        reviewed_by = (select auth.uid()),
        resolved_at = now()
    where id = p_report;

  insert into public.moderation_actions (report_id, moderator_id, member_id, action, note)
  values (p_report, (select auth.uid()), r.target_member_id, p_decision, nullif(btrim(p_note), ''));

  perform private.audit(
    'report.' || p_decision, 'report', p_report,
    jsonb_build_object('target_type', r.target_type, 'target_member_id', r.target_member_id)
  );
end;
$$;

create function public.set_member_status(
  p_member uuid,
  p_status text,
  p_reason text default null,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  message text := nullif(btrim(p_message), '');
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'Unknown status' using errcode = 'check_violation';
  end if;
  if message is null then
    raise exception 'A message for the member is required.' using errcode = 'check_violation';
  end if;
  if p_status = 'suspended' and (
    p_member = (select auth.uid())
    or exists (select 1 from public.staff_roles s where s.user_id = p_member)
  ) then
    raise exception 'That member cannot be suspended from here.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = p_member) then
    raise exception 'No such member.' using errcode = 'no_data_found';
  end if;

  insert into public.member_status (user_id, status, reason, updated_at)
  values (p_member, p_status, left(nullif(btrim(p_reason), ''), 500), now())
  on conflict (user_id) do update
    set status = excluded.status, reason = excluded.reason, updated_at = now();

  insert into public.member_notices (member_id, kind, message)
  values (p_member, case when p_status = 'suspended' then 'suspended' else 'restored' end, message);

  insert into public.moderation_actions (moderator_id, member_id, action, note)
  values ((select auth.uid()), p_member,
          case when p_status = 'suspended' then 'suspend' else 'restore' end,
          nullif(btrim(p_reason), ''));

  perform private.audit('member.' || p_status, 'member', p_member, '{}');
end;
$$;

create function public.decide_appeal(p_appeal uuid, p_decision text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appeals;
  original text;
  note text := nullif(btrim(p_note), '');
begin
  if not private.is_admin() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_decision not in ('upheld', 'overturned') then
    raise exception 'Unknown decision' using errcode = 'check_violation';
  end if;
  if note is null then
    raise exception 'A note for the member is required.' using errcode = 'check_violation';
  end if;

  select * into a from public.appeals where id = p_appeal for update;
  if not found or a.status <> 'open' then
    raise exception 'That appeal is not open.' using errcode = 'no_data_found';
  end if;
  select kind into original from public.member_notices where id = a.notice_id;

  update public.appeals
    set status = p_decision, decided_by = (select auth.uid()), decision_note = left(note, 1000), decided_at = now()
    where id = p_appeal;

  if p_decision = 'overturned' and original = 'suspended' then
    insert into public.member_status (user_id, status, reason, updated_at)
    values (a.member_id, 'active', null, now())
    on conflict (user_id) do update set status = 'active', reason = null, updated_at = now();
  end if;

  insert into public.member_notices (member_id, kind, message)
  values (a.member_id, 'appeal_decision', left(note, 1000));

  insert into public.moderation_actions (moderator_id, member_id, action, note)
  values ((select auth.uid()), a.member_id, 'appeal_' || p_decision, note);

  perform private.audit('appeal.' || p_decision, 'appeal', p_appeal, jsonb_build_object('member_id', a.member_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocking and suspension are enforced for posting, liking and commenting, too
-- ---------------------------------------------------------------------------
drop policy "posts: members can publish as themselves" on public.posts;
create policy "posts: members can publish as themselves"
  on public.posts for insert
  to authenticated
  with check (author_id = (select auth.uid()) and (select private.is_member()));

drop policy "post_likes: members can like as themselves" on public.post_likes;
create policy "post_likes: members can like as themselves"
  on public.post_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and not coalesce((
      select private.has_block_between(user_id, (select p.author_id from public.posts p where p.id = post_id))
    ), false)
  );

drop policy "post_comments: members can comment as themselves" on public.post_comments;
create policy "post_comments: members can comment as themselves"
  on public.post_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_member())
    and not coalesce((
      select private.has_block_between(author_id, (select p.author_id from public.posts p where p.id = post_id))
    ), false)
  );

-- ---------------------------------------------------------------------------
-- Notifications honour mutes (the recipient muted the person who caused them)
-- ---------------------------------------------------------------------------
create or replace function private.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select inapp_connections from public.notification_preferences where user_id = new.addressee_id), true)
     and not private.pair_blocked(new.requester_id, new.addressee_id)
     and not exists (select 1 from public.member_mutes m where m.muter_id = new.addressee_id and m.muted_id = new.requester_id) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (new.addressee_id, new.requester_id, 'connection_request', 'connection', new.id);
  end if;
  return new;
end;
$$;

create or replace function private.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    update public.notifications set read_at = coalesce(read_at, now())
      where recipient_id = new.addressee_id and type = 'connection_request' and entity_id = new.id;
    if coalesce((select inapp_connections from public.notification_preferences where user_id = new.requester_id), true)
       and not private.pair_blocked(new.requester_id, new.addressee_id)
       and not exists (select 1 from public.member_mutes m where m.muter_id = new.requester_id and m.muted_id = new.addressee_id) then
      insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
      values (new.requester_id, new.addressee_id, 'connection_accepted', 'connection', new.id);
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;

  if post_author is not null and post_author <> new.author_id
     and coalesce((select inapp_comments from public.notification_preferences where user_id = post_author), true)
     and not private.pair_blocked(new.author_id, post_author)
     and not exists (select 1 from public.member_mutes m where m.muter_id = post_author and m.muted_id = new.author_id) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (post_author, new.author_id, 'post_comment', 'post', new.post_id);
  end if;

  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  select prior.author_id, new.author_id, 'comment_reply', 'post', new.post_id
  from (
    select distinct c.author_id
    from public.post_comments c
    where c.post_id = new.post_id
      and c.author_id <> new.author_id
      and c.author_id is distinct from post_author
    limit 20
  ) prior
  where coalesce((select inapp_comments from public.notification_preferences where user_id = prior.author_id), true)
    and not private.pair_blocked(new.author_id, prior.author_id)
    and not exists (select 1 from public.member_mutes m where m.muter_id = prior.author_id and m.muted_id = new.author_id);

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------
alter table public.member_status enable row level security;
alter table public.staff_roles enable row level security;
alter table public.member_mutes enable row level security;
alter table public.reports enable row level security;
alter table public.member_notices enable row level security;
alter table public.appeals enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.member_status, public.staff_roles, public.member_mutes, public.reports,
  public.member_notices, public.appeals, public.moderation_actions, public.audit_logs
  from anon, authenticated;

-- Everything staff-related is read-only from the client; writes happen in the functions above.
grant select on public.member_status to authenticated;
grant select on public.staff_roles to authenticated;
grant select on public.reports to authenticated;
grant select on public.member_notices to authenticated;
grant select on public.moderation_actions to authenticated;
grant select on public.audit_logs to authenticated;

grant select, delete on public.member_mutes to authenticated;
grant insert (muter_id, muted_id) on public.member_mutes to authenticated;

grant select on public.appeals to authenticated;
grant insert (notice_id, member_id, message) on public.appeals to authenticated;

create policy "member_status: owner or staff can read"
  on public.member_status for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "staff_roles: a member can see their own role"
  on public.staff_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "member_mutes: muter can read"
  on public.member_mutes for select to authenticated
  using (muter_id = (select auth.uid()));
create policy "member_mutes: members can mute as themselves"
  on public.member_mutes for insert to authenticated
  with check (muter_id = (select auth.uid()) and (select private.is_member()));
create policy "member_mutes: muter can unmute"
  on public.member_mutes for delete to authenticated
  using (muter_id = (select auth.uid()));

create policy "reports: reporter or staff can read"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select private.is_admin()));

create policy "member_notices: owner or staff can read"
  on public.member_notices for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));

-- A suspended member must still be able to appeal, so this does not use is_member().
create policy "appeals: owner or staff can read"
  on public.appeals for select to authenticated
  using (member_id = (select auth.uid()) or (select private.is_admin()));
create policy "appeals: a member can appeal their own notice"
  on public.appeals for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and exists (
      select 1 from public.member_notices n
      where n.id = notice_id and n.member_id = (select auth.uid())
        and n.kind in ('warning', 'content_removed', 'suspended')
    )
  );

create policy "moderation_actions: staff can read"
  on public.moderation_actions for select to authenticated
  using ((select private.is_admin()));

create policy "audit_logs: staff can read"
  on public.audit_logs for select to authenticated
  using ((select private.is_admin()));

-- Functions: callable only by signed-in members; each one re-checks who is calling.
revoke execute on function public.submit_report(text, uuid, text, text) from public, anon;
revoke execute on function public.claim_report(uuid) from public, anon;
revoke execute on function public.moderate_report(uuid, text, text, text) from public, anon;
revoke execute on function public.set_member_status(uuid, text, text, text) from public, anon;
revoke execute on function public.decide_appeal(uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;
grant execute on function public.claim_report(uuid) to authenticated;
grant execute on function public.moderate_report(uuid, text, text, text) to authenticated;
grant execute on function public.set_member_status(uuid, text, text, text) to authenticated;
grant execute on function public.decide_appeal(uuid, text, text) to authenticated;

-- The private schema stays closed except for the policy helpers.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;
