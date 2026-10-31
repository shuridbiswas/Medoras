-- Medyra Phase 7: private messaging and professional mentorship.
--
-- Messaging
--   * conversations, conversation_participants, messages
--   * Direct (one-to-one) and group conversations. A first message to someone you are not
--     connected with is a MESSAGE REQUEST: the recipient sees it, and must accept before they can
--     reply. Until then the sender may send at most two messages. A decline is never shown to
--     the sender.
--   * Only participants can read a conversation (row level security, via private helpers).
--     Messages are NOT end-to-end encrypted: they are protected in transit and at rest by the
--     platform, and Medyra staff with database access could read them. The UI says so.
--   * Blocks stop new direct messages in both directions. Reports use submit_report and keep a
--     300-character snapshot; staff see only reported messages, never conversations.
--
-- Mentorship
--   * mentor_profiles, mentor_availability, mentorship_requests, mentorships, mentorship_feedback
--   * Expertise, experience and organisation are SELF-DECLARED. Nothing here verifies a
--     qualification, accreditation or clinical-supervision status, and a mentor must
--     acknowledge that before listing. Students cannot list as mentors.
--   * A request carries the mentee's goals. The mentor accepts (subject to capacity) or declines;
--     acceptance starts a mentorship and opens a direct conversation between the two.
--   * Availability is an internal weekly list of windows. There is no calendar integration.
--   * Feedback is private to the two people involved.

-- ---------------------------------------------------------------------------
-- Widen existing constraints
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_valid;
alter table public.reports add constraint reports_target_valid check (
  target_type in ('post', 'comment', 'profile', 'question', 'answer', 'reply', 'community', 'message', 'mentor')
);

alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in (
  'connection_request', 'connection_accepted', 'post_comment', 'comment_reply', 'mention',
  'community_event', 'mentorship_event',
  'community_join_request', 'community_request_approved', 'community_post_removed',
  'forum_answer', 'forum_reply', 'forum_answer_accepted',
  'message_request'
));
alter table public.notifications drop constraint notifications_entity_valid;
alter table public.notifications add constraint notifications_entity_valid check (
  entity_type is null or entity_type in ('post', 'connection', 'community', 'mentorship', 'forum_question', 'conversation')
);

-- ---------------------------------------------------------------------------
-- Messaging tables
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  title text,
  created_by uuid references public.profiles (id) on delete set null,
  -- "<smaller id>:<larger id>" for a direct conversation, so a pair has exactly one.
  direct_key text,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint conversations_kind_valid check (kind in ('direct', 'group')),
  constraint conversations_title_valid check (
    (kind = 'direct' and title is null and direct_key is not null)
    or (kind = 'group' and direct_key is null and char_length(btrim(title)) between 1 and 80)
  )
);
create unique index conversations_direct_key on public.conversations (direct_key) where direct_key is not null;
create index conversations_recent_idx on public.conversations (last_message_at desc);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- pending: a message request not yet answered. declined / left: out of the conversation.
  status text not null default 'active',
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id),
  constraint conversation_participants_status_valid check (status in ('active', 'pending', 'declined', 'left')),
  constraint conversation_participants_role_valid check (role in ('admin', 'member'))
);
create index conversation_participants_user_idx on public.conversation_participants (user_id, status);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  -- Kept (as null) if the sender later deletes their account.
  sender_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 4000)
);
create index messages_thread_idx on public.messages (conversation_id, created_at desc, id desc);
create index messages_sender_idx on public.messages (sender_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Messaging helpers (security definer; each answers only about the caller)
-- ---------------------------------------------------------------------------
create function private.conv_status(p_conversation uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.status from public.conversation_participants p
  where p.conversation_id = p_conversation and p.user_id = (select auth.uid())
$$;

create function private.can_read_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.conv_status(p_conversation) in ('active', 'pending'), false)
$$;

-- True when the caller is active in the conversation and, for a direct one, the other person
-- is still reachable (not blocked either way, not gone).
create function private.can_send_in_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.conv_status(p_conversation) = 'active', false)
    and not exists (
      select 1
      from public.conversations c
      join public.conversation_participants o on o.conversation_id = c.id and o.user_id <> (select auth.uid())
      where c.id = p_conversation and c.kind = 'direct'
        and (o.status in ('declined', 'left') or private.has_block_between(o.user_id, (select auth.uid())))
    )
$$;

-- Spam guards and the request throttle.
create function private.enforce_message_limits()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent integer;
  mine integer;
begin
  select count(*) into recent from public.messages
    where sender_id = new.sender_id and created_at > now() - interval '1 hour';
  if recent >= 300 then
    raise exception 'You are sending messages too quickly. Please try again later.' using errcode = 'check_violation';
  end if;
  if exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = new.conversation_id and p.user_id <> new.sender_id and p.status = 'pending'
  ) then
    select count(*) into mine from public.messages
      where conversation_id = new.conversation_id and sender_id = new.sender_id;
    if mine >= 2 then
      raise exception 'This person has not accepted your message request yet.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger messages_limits before insert on public.messages
  for each row execute function private.enforce_message_limits();

create function private.touch_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  -- The sender has read their own message.
  update public.conversation_participants set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;
create trigger messages_touch after insert on public.messages
  for each row execute function private.touch_conversation();

-- ---------------------------------------------------------------------------
-- Messaging functions
-- ---------------------------------------------------------------------------
create function public.start_direct_conversation(p_other uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  key text;
  cid uuid;
  mine text;
  connected boolean;
  recent integer;
  refusal constant text := 'You can''t message this member.';
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  -- Every refusal below reads the same, so a block or a decline is never revealed.
  if p_other is null or p_other = me
     or not exists (select 1 from public.profiles pr where pr.id = p_other and pr.onboarding_completed)
     or exists (select 1 from public.member_status s where s.user_id = p_other and s.status = 'suspended')
     or private.has_block_between(me, p_other) then
    raise exception '%', refusal using errcode = 'check_violation';
  end if;

  key := least(me, p_other)::text || ':' || greatest(me, p_other)::text;
  select id into cid from public.conversations where direct_key = key;

  if cid is not null then
    mine := private.conv_status(cid);
    if mine is distinct from 'active'
       or exists (select 1 from public.conversation_participants o
                  where o.conversation_id = cid and o.user_id = p_other and o.status in ('declined', 'left')) then
      raise exception '%', refusal using errcode = 'check_violation';
    end if;
  else
    select count(*) into recent from public.conversations where created_by = me and created_at > now() - interval '1 day';
    if recent >= 20 then
      raise exception 'You are starting conversations too quickly. Please try again tomorrow.' using errcode = 'check_violation';
    end if;
    connected := exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((c.requester_id = me and c.addressee_id = p_other) or (c.requester_id = p_other and c.addressee_id = me))
    );
    insert into public.conversations (kind, created_by, direct_key) values ('direct', me, key) returning id into cid;
    -- The other person has read nothing yet: their marker starts at the epoch, not at "now".
    insert into public.conversation_participants (conversation_id, user_id, status, role, last_read_at)
      values (cid, me, 'active', 'admin', now()),
             (cid, p_other, case when connected then 'active' else 'pending' end, 'member', timestamptz 'epoch');
    if not connected
       and not exists (select 1 from public.member_mutes m where m.muter_id = p_other and m.muted_id = me) then
      insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
      values (p_other, me, 'message_request', 'conversation', cid);
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (cid, me, p_body);
  return cid;
end;
$$;

create function public.respond_to_message_request(p_conversation uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.conversation_participants
    set status = case when p_accept then 'active' else 'declined' end, last_read_at = now()
    where conversation_id = p_conversation and user_id = (select auth.uid()) and status = 'pending';
  if not found then
    raise exception 'That request is no longer open.' using errcode = 'no_data_found';
  end if;
  update public.notifications set read_at = coalesce(read_at, now())
    where recipient_id = (select auth.uid()) and type = 'message_request' and entity_id = p_conversation;
end;
$$;

create function public.create_group_conversation(p_title text, p_members uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  members uuid[];
  cid uuid;
  recent integer;
  m uuid;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select array_agg(distinct x) into members from unnest(coalesce(p_members, '{}')) x where x <> me;
  if members is null or cardinality(members) < 1 or cardinality(members) > 19 then
    raise exception 'Choose between 1 and 19 other people.' using errcode = 'check_violation';
  end if;
  select count(*) into recent from public.conversations where created_by = me and kind = 'group' and created_at > now() - interval '1 day';
  if recent >= 5 then
    raise exception 'You are creating groups too quickly. Please try again tomorrow.' using errcode = 'check_violation';
  end if;
  -- Group members must be your connections, so nobody is pulled into a group by a stranger.
  foreach m in array members loop
    if not exists (
      select 1 from public.connections c
      where c.status = 'accepted'
        and ((c.requester_id = me and c.addressee_id = m) or (c.requester_id = m and c.addressee_id = me))
    ) or private.has_block_between(me, m) then
      raise exception 'You can only add your connections to a group.' using errcode = 'check_violation';
    end if;
  end loop;

  insert into public.conversations (kind, title, created_by) values ('group', btrim(p_title), me) returning id into cid;
  insert into public.conversation_participants (conversation_id, user_id, status, role) values (cid, me, 'active', 'admin');
  insert into public.conversation_participants (conversation_id, user_id, status, role)
    select cid, x, 'active', 'member' from unnest(members) x;
  return cid;
end;
$$;

create function public.add_group_member(p_conversation uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not exists (
    select 1 from public.conversations c
    join public.conversation_participants p on p.conversation_id = c.id and p.user_id = me
    where c.id = p_conversation and c.kind = 'group' and p.status = 'active' and p.role = 'admin'
  ) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if (select count(*) from public.conversation_participants where conversation_id = p_conversation and status = 'active') >= 20 then
    raise exception 'A group can have up to 20 people.' using errcode = 'check_violation';
  end if;
  if not exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.requester_id = me and c.addressee_id = p_user) or (c.requester_id = p_user and c.addressee_id = me))
  ) or private.has_block_between(me, p_user) then
    raise exception 'You can only add your connections to a group.' using errcode = 'check_violation';
  end if;
  insert into public.conversation_participants (conversation_id, user_id, status, role)
  values (p_conversation, p_user, 'active', 'member')
  on conflict (conversation_id, user_id) do update set status = 'active', joined_at = now(), last_read_at = now();
end;
$$;

create function public.leave_conversation(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.conversation_participants set status = 'left'
    where conversation_id = p_conversation and user_id = (select auth.uid()) and status in ('active', 'pending');
  if not found then
    raise exception 'That conversation is no longer available.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mentorship tables
-- ---------------------------------------------------------------------------
create table public.mentor_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  bio text not null,
  -- Self-declared. Never presented as accreditation.
  expertise text not null,
  experience_years smallint not null,
  organization text,
  topics text[] not null,
  languages text[] not null,
  capacity smallint not null default 3,
  session_formats text[] not null,
  accepting boolean not null default true,
  -- The mentor confirmed the listing is self-declared and that mentoring is not clinical supervision.
  acknowledged boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Must match MENTOR_FORMATS in src/features/mentorship/options.ts.
  constraint mentor_profiles_bio_length check (char_length(btrim(bio)) between 20 and 1200),
  constraint mentor_profiles_expertise_length check (char_length(btrim(expertise)) between 3 and 200),
  constraint mentor_profiles_experience_valid check (experience_years between 0 and 60),
  constraint mentor_profiles_organization_length check (organization is null or char_length(organization) <= 120),
  constraint mentor_profiles_topics_valid check (cardinality(topics) between 1 and 10 and char_length(array_to_string(topics, '|')) <= 400),
  constraint mentor_profiles_languages_valid check (cardinality(languages) between 1 and 6 and char_length(array_to_string(languages, '|')) <= 150),
  constraint mentor_profiles_capacity_valid check (capacity between 1 and 10),
  constraint mentor_profiles_formats_valid check (cardinality(session_formats) >= 1 and session_formats <@ array['video', 'phone', 'chat', 'in_person']),
  constraint mentor_profiles_acknowledged check (acknowledged)
);
create index mentor_profiles_topics_idx on public.mentor_profiles using gin (topics);
create index mentor_profiles_accepting_idx on public.mentor_profiles (accepting, created_at desc);
create trigger mentor_profiles_updated before update on public.mentor_profiles
  for each row execute function private.set_updated_at();

-- Weekly windows a mentor says they are usually free. Internal only: no calendar is connected.
create table public.mentor_availability (
  id uuid primary key default gen_random_uuid(),
  mentor_id uuid not null references public.mentor_profiles (user_id) on delete cascade,
  weekday smallint not null,
  start_minute smallint not null,
  end_minute smallint not null,
  timezone text not null,
  constraint mentor_availability_weekday check (weekday between 0 and 6),
  constraint mentor_availability_window check (start_minute between 0 and 1439 and end_minute between 1 and 1440 and end_minute > start_minute),
  constraint mentor_availability_timezone check (char_length(timezone) between 1 and 60)
);
create index mentor_availability_idx on public.mentor_availability (mentor_id, weekday, start_minute);

create function private.limit_availability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.mentor_availability where mentor_id = new.mentor_id) >= 14 then
    raise exception 'You can list up to 14 availability windows.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger mentor_availability_limit before insert on public.mentor_availability
  for each row execute function private.limit_availability();

create table public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  mentee_id uuid not null references public.profiles (id) on delete cascade,
  mentor_id uuid not null references public.mentor_profiles (user_id) on delete cascade,
  goals text not null,
  preferred_format text,
  status text not null default 'pending',
  -- A short, kind reply from the mentor when declining. Shown to the mentee.
  decline_note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint mentorship_requests_status_valid check (status in ('pending', 'accepted', 'declined')),
  constraint mentorship_requests_goals_length check (char_length(btrim(goals)) between 20 and 1500),
  constraint mentorship_requests_format_valid check (preferred_format is null or preferred_format in ('video', 'phone', 'chat', 'in_person')),
  constraint mentorship_requests_note_length check (decline_note is null or char_length(decline_note) <= 500),
  constraint mentorship_requests_not_self check (mentee_id <> mentor_id)
);
create unique index mentorship_requests_one_pending on public.mentorship_requests (mentee_id, mentor_id) where status = 'pending';
create index mentorship_requests_mentor_idx on public.mentorship_requests (mentor_id, status, created_at desc);
create index mentorship_requests_mentee_idx on public.mentorship_requests (mentee_id, created_at desc);

create function private.limit_mentorship_requests()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.mentorship_requests where mentee_id = new.mentee_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'You are sending requests too quickly. Please try again tomorrow.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger mentorship_requests_limit before insert on public.mentorship_requests
  for each row execute function private.limit_mentorship_requests();

create table public.mentorships (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.mentorship_requests (id) on delete set null,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  mentee_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint mentorships_status_valid check (status in ('active', 'paused', 'completed', 'ended')),
  constraint mentorships_not_self check (mentor_id <> mentee_id)
);
create index mentorships_mentor_idx on public.mentorships (mentor_id, status);
create index mentorships_mentee_idx on public.mentorships (mentee_id, status);

create table public.mentorship_feedback (
  id uuid primary key default gen_random_uuid(),
  mentorship_id uuid not null references public.mentorships (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null,
  comment text,
  created_at timestamptz not null default now(),
  constraint mentorship_feedback_rating check (rating between 1 and 5),
  constraint mentorship_feedback_comment_length check (comment is null or char_length(comment) <= 1000),
  constraint mentorship_feedback_one_each unique (mentorship_id, author_id)
);

-- ---------------------------------------------------------------------------
-- Mentorship helpers and functions
-- ---------------------------------------------------------------------------
create function private.can_list_as_mentor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_member() and exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid())
      and me.member_type is distinct from 'undergraduate_student'
      and me.member_type is distinct from 'graduate_student'
      and me.career_stage is distinct from 'student'
  )
$$;

create function private.is_mentorship_party(p_mentorship uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.mentorships m
    where m.id = p_mentorship and (select auth.uid()) in (m.mentor_id, m.mentee_id)
  )
$$;

create function public.decide_mentorship_request(p_request uuid, p_accept boolean, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  r public.mentorship_requests;
  mp public.mentor_profiles;
  key text;
  cid uuid;
  mid uuid;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.mentorship_requests where id = p_request for update;
  if not found or r.mentor_id <> me or r.status <> 'pending' then
    raise exception 'That request is no longer open.' using errcode = 'no_data_found';
  end if;

  if not p_accept then
    update public.mentorship_requests
      set status = 'declined', decided_at = now(), decline_note = left(nullif(btrim(p_note), ''), 500)
      where id = p_request;
    return null;
  end if;

  select * into mp from public.mentor_profiles where user_id = me;
  if not found or (select count(*) from public.mentorships where mentor_id = me and status in ('active', 'paused')) >= mp.capacity then
    raise exception 'You are at your mentoring capacity. Raise it or finish a mentorship first.' using errcode = 'check_violation';
  end if;
  if private.has_block_between(me, r.mentee_id) then
    raise exception 'That request is no longer open.' using errcode = 'no_data_found';
  end if;

  -- Open (or reopen) the direct conversation between the two.
  key := least(me, r.mentee_id)::text || ':' || greatest(me, r.mentee_id)::text;
  select id into cid from public.conversations where direct_key = key;
  if cid is null then
    insert into public.conversations (kind, created_by, direct_key) values ('direct', me, key) returning id into cid;
    insert into public.conversation_participants (conversation_id, user_id, status, role)
      values (cid, me, 'active', 'admin'), (cid, r.mentee_id, 'active', 'member');
  else
    update public.conversation_participants set status = 'active', last_read_at = now()
      where conversation_id = cid and user_id in (me, r.mentee_id);
  end if;

  insert into public.mentorships (request_id, mentor_id, mentee_id, conversation_id)
    values (p_request, me, r.mentee_id, cid) returning id into mid;
  update public.mentorship_requests set status = 'accepted', decided_at = now() where id = p_request;
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (r.mentee_id, me, 'mentorship_event', 'mentorship', mid);
  return mid;
end;
$$;

create function public.set_mentorship_status(p_mentorship uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  m public.mentorships;
  other uuid;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_status not in ('active', 'paused', 'completed', 'ended') then
    raise exception 'Unknown status' using errcode = 'check_violation';
  end if;
  select * into m from public.mentorships where id = p_mentorship for update;
  if not found or me not in (m.mentor_id, m.mentee_id) or m.status in ('completed', 'ended') then
    raise exception 'That mentorship is no longer available.' using errcode = 'no_data_found';
  end if;
  -- Only the mentor pauses or resumes; either person can finish it.
  if p_status in ('active', 'paused') and me <> m.mentor_id then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.mentorships
    set status = p_status, ended_at = case when p_status in ('completed', 'ended') then now() else null end
    where id = p_mentorship;
  other := case when me = m.mentor_id then m.mentee_id else m.mentor_id end;
  if not private.pair_blocked(me, other) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
      values (other, me, 'mentorship_event', 'mentorship', p_mentorship);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports: the same queue, extended to messages and mentor profiles
-- ---------------------------------------------------------------------------
create or replace function public.submit_report(
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
  public_owner uuid;
  snapshot text;
  recent integer;
  report_id uuid;
  located boolean := false;
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  if p_target_type = 'post' then
    select author_id, left(body, 300) into owner_id, snapshot from public.posts
      where id = p_target_id and private.post_visible(id);
    located := found;
    public_owner := owner_id;
  elsif p_target_type = 'comment' then
    select c.author_id, left(c.body, 300) into owner_id, snapshot from public.post_comments c
      where c.id = p_target_id and private.post_visible(c.post_id);
    located := found;
    public_owner := owner_id;
  elsif p_target_type = 'profile' then
    select id, left(coalesce(headline, first_name), 300) into owner_id, snapshot
      from public.profiles where id = p_target_id and onboarding_completed;
    located := found;
    public_owner := owner_id;
  elsif p_target_type in ('question', 'answer', 'reply') then
    if private.forum_content_visible(p_target_type, p_target_id) then
      if p_target_type = 'question' then
        select left(q.title || ': ' || q.body, 300), q.author_id into snapshot, public_owner
          from public.forum_questions q where q.id = p_target_id;
      elsif p_target_type = 'answer' then
        select left(a.body, 300), a.author_id into snapshot, public_owner
          from public.forum_answers a where a.id = p_target_id;
      else
        select left(r.body, 300), r.author_id into snapshot, public_owner
          from public.forum_replies r where r.id = p_target_id;
      end if;
      located := found;
      select i.author_id into owner_id from public.forum_identity i
        where i.content_type = p_target_type and i.content_id = p_target_id;
    end if;
  elsif p_target_type = 'message' then
    -- Only a participant can see a message, so only a participant can report it.
    select m.sender_id, left(m.body, 300) into owner_id, snapshot from public.messages m
      where m.id = p_target_id and private.can_read_conversation(m.conversation_id);
    located := found;
    public_owner := owner_id;
  elsif p_target_type = 'mentor' then
    select user_id, left(bio, 300) into owner_id, snapshot from public.mentor_profiles
      where user_id = p_target_id and not private.has_block_between(user_id, me);
    located := found;
    public_owner := owner_id;
  elsif p_target_type = 'community' then
    select created_by, left(name || ': ' || description, 300) into owner_id, snapshot
      from public.communities where id = p_target_id and archived_at is null;
    located := found;
    public_owner := owner_id;
  else
    raise exception 'Unknown report target' using errcode = 'check_violation';
  end if;

  if not located then
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
  values (me, p_target_type, p_target_id, public_owner, p_reason, nullif(btrim(p_details), ''), snapshot)
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.moderate_report(
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
  target_member uuid;
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

  -- Anonymous forum content has no public writer; the private record answers here and nowhere else.
  target_member := r.target_member_id;
  if target_member is null and r.target_type in ('question', 'answer', 'reply') then
    select i.author_id into target_member from public.forum_identity i
      where i.content_type = r.target_type and i.content_id = r.target_id;
  end if;

  if p_decision = 'suspend' and (
    target_member is null
    or target_member = (select auth.uid())
    or exists (select 1 from public.staff_roles s where s.user_id = target_member)
  ) then
    raise exception 'That member cannot be suspended from here.' using errcode = 'check_violation';
  end if;

  if p_decision = 'remove_content' then
    if r.target_type = 'post' then
      delete from public.posts where id = r.target_id;
    elsif r.target_type = 'comment' then
      delete from public.post_comments where id = r.target_id;
    elsif r.target_type = 'question' then
      delete from public.forum_questions where id = r.target_id;
    elsif r.target_type = 'answer' then
      delete from public.forum_answers where id = r.target_id;
    elsif r.target_type = 'reply' then
      delete from public.forum_replies where id = r.target_id;
    elsif r.target_type = 'community' then
      update public.communities set archived_at = now() where id = r.target_id;
    elsif r.target_type = 'message' then
      delete from public.messages where id = r.target_id;
    elsif r.target_type = 'mentor' then
      delete from public.mentor_profiles where user_id = r.target_id;
    else
      raise exception 'A profile cannot be removed; warn or suspend instead.' using errcode = 'check_violation';
    end if;
  end if;

  if p_decision = 'suspend' then
    insert into public.member_status (user_id, status, reason, updated_at)
    values (target_member, 'suspended', left(member_message, 500), now())
    on conflict (user_id) do update
      set status = 'suspended', reason = excluded.reason, updated_at = now();
  end if;

  if p_decision <> 'dismiss' and target_member is not null then
    kind := case p_decision
      when 'warn' then 'warning'
      when 'remove_content' then 'content_removed'
      else 'suspended'
    end;
    insert into public.member_notices (member_id, kind, message)
    values (target_member, kind, member_message);
  end if;

  update public.reports
    set status = case when p_decision = 'dismiss' then 'dismissed' else 'actioned' end,
        reviewed_by = (select auth.uid()),
        resolved_at = now()
    where id = p_report;

  -- member_id is the report's public member, so an anonymous writer is not tied to a decision here.
  insert into public.moderation_actions (report_id, moderator_id, member_id, action, note)
  values (p_report, (select auth.uid()), r.target_member_id, p_decision, nullif(btrim(p_note), ''));

  perform private.audit(
    'report.' || p_decision, 'report', p_report,
    jsonb_build_object('target_type', r.target_type, 'target_member_id', r.target_member_id)
  );
end;
$$;


-- Mentors are told when someone asks.
create function private.notify_mentorship_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.pair_blocked(new.mentee_id, new.mentor_id)
     and not exists (select 1 from public.member_mutes m where m.muter_id = new.mentor_id and m.muted_id = new.mentee_id) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (new.mentor_id, new.mentee_id, 'mentorship_event', 'mentorship', new.id);
  end if;
  return new;
end;
$$;
create trigger mentorship_requests_notify after insert on public.mentorship_requests
  for each row execute function private.notify_mentorship_request();

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.mentor_profiles enable row level security;
alter table public.mentor_availability enable row level security;
alter table public.mentorship_requests enable row level security;
alter table public.mentorships enable row level security;
alter table public.mentorship_feedback enable row level security;

revoke all on public.conversations, public.conversation_participants, public.messages,
  public.mentor_profiles, public.mentor_availability, public.mentorship_requests,
  public.mentorships, public.mentorship_feedback
  from anon, authenticated;

grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant update (last_read_at) on public.conversation_participants to authenticated;
grant select, delete on public.messages to authenticated;
grant insert (conversation_id, sender_id, body) on public.messages to authenticated;

grant select, delete on public.mentor_profiles to authenticated;
grant insert (user_id, bio, expertise, experience_years, organization, topics, languages, capacity, session_formats, accepting, acknowledged)
  on public.mentor_profiles to authenticated;
grant update (bio, expertise, experience_years, organization, topics, languages, capacity, session_formats, accepting, acknowledged)
  on public.mentor_profiles to authenticated;
grant select, delete on public.mentor_availability to authenticated;
grant insert (mentor_id, weekday, start_minute, end_minute, timezone) on public.mentor_availability to authenticated;
grant select, delete on public.mentorship_requests to authenticated;
grant insert (mentee_id, mentor_id, goals, preferred_format) on public.mentorship_requests to authenticated;
grant select on public.mentorships to authenticated;
grant select on public.mentorship_feedback to authenticated;
grant insert (mentorship_id, author_id, rating, comment) on public.mentorship_feedback to authenticated;

-- conversations: only participants (a pending recipient included) can see them
create policy "conversations: participants can read"
  on public.conversations for select to authenticated
  using ((select private.can_read_conversation(id)));

create policy "conversation_participants: participants can read"
  on public.conversation_participants for select to authenticated
  using (
    user_id = (select auth.uid())
    or (status in ('active', 'pending') and (select private.can_read_conversation(conversation_id)))
  );
create policy "conversation_participants: mark your own read"
  on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid()) and status in ('active', 'pending'))
  with check (user_id = (select auth.uid()) and status in ('active', 'pending'));

create policy "messages: participants can read"
  on public.messages for select to authenticated
  using ((select private.can_read_conversation(conversation_id)));
create policy "messages: send as yourself in a conversation you are active in"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_member())
    and (select private.can_send_in_conversation(conversation_id))
  );
create policy "messages: delete your own"
  on public.messages for delete to authenticated
  using (sender_id = (select auth.uid()));

-- mentors
create policy "mentor_profiles: members can read"
  on public.mentor_profiles for select to authenticated
  using (
    (select private.is_member())
    and (user_id = (select auth.uid()) or not (select private.has_block_between(user_id, (select auth.uid()))))
  );
create policy "mentor_profiles: eligible members can list themselves"
  on public.mentor_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.can_list_as_mentor()));
create policy "mentor_profiles: edit your own"
  on public.mentor_profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (select private.can_list_as_mentor()));
create policy "mentor_profiles: remove your own"
  on public.mentor_profiles for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "mentor_availability: members can read"
  on public.mentor_availability for select to authenticated
  using ((select private.is_member()));
create policy "mentor_availability: add your own"
  on public.mentor_availability for insert to authenticated
  with check (mentor_id = (select auth.uid()));
create policy "mentor_availability: remove your own"
  on public.mentor_availability for delete to authenticated
  using (mentor_id = (select auth.uid()));

create policy "mentorship_requests: the two people can read"
  on public.mentorship_requests for select to authenticated
  using (mentee_id = (select auth.uid()) or mentor_id = (select auth.uid()));
create policy "mentorship_requests: ask a mentor who is accepting"
  on public.mentorship_requests for insert to authenticated
  with check (
    mentee_id = (select auth.uid())
    and (select private.is_member())
    and exists (select 1 from public.mentor_profiles mp where mp.user_id = mentor_id and mp.accepting)
    and not (select private.has_block_between(mentee_id, mentor_id))
  );
create policy "mentorship_requests: withdraw a pending request"
  on public.mentorship_requests for delete to authenticated
  using (mentee_id = (select auth.uid()) and status = 'pending');

create policy "mentorships: the two people can read"
  on public.mentorships for select to authenticated
  using (mentee_id = (select auth.uid()) or mentor_id = (select auth.uid()));

create policy "mentorship_feedback: the two people can read"
  on public.mentorship_feedback for select to authenticated
  using (author_id = (select auth.uid()) or (select private.is_mentorship_party(mentorship_id)));
create policy "mentorship_feedback: leave feedback on a completed mentorship"
  on public.mentorship_feedback for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_member())
    and exists (select 1 from public.mentorships m where m.id = mentorship_id and m.status = 'completed'
                and (select auth.uid()) in (m.mentor_id, m.mentee_id))
  );

-- Realtime: new messages stream to the people who can read them (row level security applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

revoke execute on function public.start_direct_conversation(uuid, text) from public, anon;
revoke execute on function public.respond_to_message_request(uuid, boolean) from public, anon;
revoke execute on function public.create_group_conversation(text, uuid[]) from public, anon;
revoke execute on function public.add_group_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_conversation(uuid) from public, anon;
revoke execute on function public.decide_mentorship_request(uuid, boolean, text) from public, anon;
revoke execute on function public.set_mentorship_status(uuid, text) from public, anon;
grant execute on function public.start_direct_conversation(uuid, text) to authenticated;
grant execute on function public.respond_to_message_request(uuid, boolean) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
grant execute on function public.leave_conversation(uuid) to authenticated;
grant execute on function public.decide_mentorship_request(uuid, boolean, text) to authenticated;
grant execute on function public.set_mentorship_status(uuid, text) to authenticated;

-- The private schema stays closed except for the policy helpers.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;
grant execute on function private.can_see_profile_details(uuid) to authenticated;
grant execute on function private.community_role(uuid) to authenticated;
grant execute on function private.is_community_staff(uuid) to authenticated;
grant execute on function private.is_banned_from_community(uuid) to authenticated;
grant execute on function private.can_read_community(uuid) to authenticated;
grant execute on function private.can_post_in_community(uuid) to authenticated;
grant execute on function private.post_visible(uuid) to authenticated;
grant execute on function private.is_content_author(text, uuid) to authenticated;
grant execute on function private.content_author_blocked(text, uuid) to authenticated;
grant execute on function private.forum_content_visible(text, uuid) to authenticated;
grant execute on function private.conv_status(uuid) to authenticated;
grant execute on function private.can_read_conversation(uuid) to authenticated;
grant execute on function private.can_send_in_conversation(uuid) to authenticated;
grant execute on function private.can_list_as_mentor() to authenticated;
grant execute on function private.is_mentorship_party(uuid) to authenticated;
