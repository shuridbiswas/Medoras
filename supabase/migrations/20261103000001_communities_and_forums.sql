-- Medyra Phase 6: communities, forums ("Ask, Answer, Discover") and educational second opinions.
--
-- What this adds
--   * communities, community_members, community_requests, community_bans, community_announcements,
--     community_audit_logs   (public or private groups with owner / moderator / member roles)
--   * posts.community_id     community posts reuse the existing post system, comments and likes
--   * forum_topics, forum_questions, forum_answers, forum_replies, forum_votes, forum_follows
--   * forum_identity         the PRIVATE record of who wrote each question, answer and reply
--   * reports / moderation   extended to forum content and communities (same queue, same audit log)
--   * saved_items / notifications  extended to forum questions and answers
--
-- Anonymity model (read this before changing anything below)
--   A question, answer or reply can be published anonymously. The content row then has
--   author_id = NULL, so no query, embed, search result, notification or API response over the
--   content tables can reveal the writer. The writer is recorded ONLY in forum_identity, whose
--   policy lets a member read just their own rows and which has no insert/update/delete grant:
--   rows are created by the ask_question / post_answer / post_reply functions. Authorization
--   (edit, delete, accept an answer) and abuse response (reports, warnings, suspension) resolve the
--   writer inside security definer functions; staff are never shown who an anonymous writer is.
--   This is pseudonymity from other members, not anonymity from the platform.
--
-- Community model
--   Public communities: any member can read and join. Private communities: name, description and
--   rules are visible in the directory, but posts, comments, announcements and the member list
--   are readable only by members; joining needs a moderator's approval. Everything a moderator
--   does goes through a security definer function that checks the role and writes
--   community_audit_logs (append-only) in the same transaction.

-- ---------------------------------------------------------------------------
-- Widen existing constraints
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint reports_target_valid;
alter table public.reports add constraint reports_target_valid check (
  target_type in ('post', 'comment', 'profile', 'question', 'answer', 'reply', 'community')
);

alter table public.saved_items drop constraint saved_items_type_valid;
alter table public.saved_items add constraint saved_items_type_valid check (
  item_type in ('post', 'forum_question', 'forum_answer')
);

alter table public.notifications drop constraint notifications_type_valid;
alter table public.notifications add constraint notifications_type_valid check (type in (
  'connection_request', 'connection_accepted', 'post_comment', 'comment_reply', 'mention',
  'community_event', 'mentorship_event',
  'community_join_request', 'community_request_approved', 'community_post_removed',
  'forum_answer', 'forum_reply', 'forum_answer_accepted'
));
alter table public.notifications drop constraint notifications_entity_valid;
alter table public.notifications add constraint notifications_entity_valid check (
  entity_type is null or entity_type in ('post', 'connection', 'community', 'mentorship', 'forum_question')
);

-- ---------------------------------------------------------------------------
-- Communities
-- ---------------------------------------------------------------------------
create table public.communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  description text not null,
  kind text not null,
  visibility text not null default 'public',
  rules text,
  institution text,
  -- Coarse and optional, like profiles.location_label. Never coordinates.
  region_label text,
  country text,
  -- Kept (as null) if the creator later deletes their account; moderators remain.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set only by staff action (a report decision), never by a client.
  archived_at timestamptz,

  -- Must match COMMUNITY_KINDS in src/features/communities/options.ts.
  constraint communities_kind_valid check (kind in ('profession', 'institution', 'research', 'regional', 'interest')),
  constraint communities_visibility_valid check (visibility in ('public', 'private')),
  constraint communities_slug_valid check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 48 and slug not in ('create')
  ),
  constraint communities_name_length check (char_length(btrim(name)) between 3 and 80),
  constraint communities_description_length check (char_length(btrim(description)) between 10 and 600),
  constraint communities_rules_length check (rules is null or char_length(rules) <= 3000),
  constraint communities_institution_length check (institution is null or char_length(institution) <= 120),
  constraint communities_region_length check (region_label is null or char_length(region_label) <= 80),
  constraint communities_country_valid check (country is null or country ~ '^[A-Z]{2}$')
);
create unique index communities_slug_key on public.communities (slug);
create index communities_directory_idx on public.communities (created_at desc, id desc) where archived_at is null;
create index communities_kind_idx on public.communities (kind, created_at desc) where archived_at is null;

create trigger communities_set_updated_at before update on public.communities
  for each row execute function private.set_updated_at();

create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_members_role_valid check (role in ('owner', 'moderator', 'member'))
);
create unique index community_one_owner on public.community_members (community_id) where role = 'owner';
create index community_members_user_idx on public.community_members (user_id, joined_at desc);

-- Join requests for private communities.
create table public.community_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text,
  status text not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint community_requests_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint community_requests_message_length check (message is null or char_length(message) <= 500)
);
create unique index community_requests_one_pending
  on public.community_requests (community_id, user_id) where status = 'pending';
create index community_requests_queue_idx on public.community_requests (community_id, status, created_at);
create index community_requests_user_idx on public.community_requests (user_id, created_at desc);

-- A removed member who may not rejoin. Only moderators ever see these rows.
create table public.community_bans (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  banned_by uuid references public.profiles (id) on delete set null,
  reason text not null default 'other',
  created_at timestamptz not null default now(),
  primary key (community_id, user_id),
  constraint community_bans_reason_valid check (reason in ('rules', 'spam', 'harassment', 'privacy', 'off_topic', 'other'))
);

create table public.community_announcements (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint community_announcements_title_length check (char_length(btrim(title)) between 3 and 120),
  constraint community_announcements_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 2000)
);
create index community_announcements_idx on public.community_announcements (community_id, created_at desc, id desc);
create trigger community_announcements_set_updated_at before update on public.community_announcements
  for each row execute function private.set_updated_at();

-- Append-only record of moderator actions. Ids and decisions only, never content.
create table public.community_audit_logs (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index community_audit_logs_idx on public.community_audit_logs (community_id, created_at desc, id desc);

-- Append-only, with two exceptions that keep account and community deletion working: the actor
-- may be nulled when their account is deleted, and rows go when their community is deleted
-- (a cascade runs one trigger level deeper than a direct delete).
create function private.protect_community_audit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.actor_id is null and old.actor_id is not null
     and (new.id, new.community_id, new.action, new.target_type, new.target_id, new.metadata, new.created_at)
         is not distinct from
         (old.id, old.community_id, old.action, old.target_type, old.target_id, old.metadata, old.created_at) then
    return new;
  end if;
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'community_audit_logs is append-only' using errcode = 'insufficient_privilege';
end;
$$;

create trigger community_audit_logs_append_only before update or delete on public.community_audit_logs
  for each row execute function private.protect_community_audit();

-- Community posts reuse the existing posts table.
alter table public.posts add column community_id uuid references public.communities (id) on delete cascade;
create index posts_community_feed_idx on public.posts (community_id, created_at desc, id desc)
  where community_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can ask about membership without recursion).
-- Each one answers only about the caller.
-- ---------------------------------------------------------------------------
create function private.community_role(p_community uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.community_members m
  where m.community_id = p_community and m.user_id = (select auth.uid())
$$;

create function private.is_community_staff(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.community_role(p_community) in ('owner', 'moderator'), false)
$$;

create function private.is_banned_from_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_bans b
    where b.community_id = p_community and b.user_id = (select auth.uid())
  )
$$;

-- Readable: a live public community, or any community the caller belongs to.
create function private.can_read_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.communities c
    where c.id = p_community
      and c.archived_at is null
      and (c.visibility = 'public' or private.community_role(c.id) is not null)
  )
$$;

create function private.can_post_in_community(p_community uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.community_role(p_community) is not null and exists (
    select 1 from public.communities c where c.id = p_community and c.archived_at is null
  )
$$;

-- True for a post that is not in a community, or whose community the caller may read.
create function private.post_visible(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    where p.id = p_post and (p.community_id is null or private.can_read_community(p.community_id))
  )
$$;

create function private.community_audit(
  p_community uuid, p_action text, p_target_type text, p_target_id uuid, p_metadata jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.community_audit_logs (community_id, actor_id, action, target_type, target_id, metadata)
  values (p_community, (select auth.uid()), p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'));
$$;

-- The creator becomes the owner.
create function private.add_community_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.community_members (community_id, user_id, role) values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;
create trigger communities_add_owner after insert on public.communities
  for each row execute function private.add_community_owner();

-- Spam guards: 3 new communities a day, 10 join requests a day, 30 joins an hour.
create function private.enforce_community_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_table_name = 'communities' then
    select count(*) into recent from public.communities
      where created_by = new.created_by and created_at > now() - interval '1 day';
    if recent >= 3 then
      raise exception 'You are creating communities too quickly. Please try again tomorrow.'
        using errcode = 'check_violation';
    end if;
  elsif tg_table_name = 'community_requests' then
    select count(*) into recent from public.community_requests
      where user_id = new.user_id and created_at > now() - interval '1 day';
    if recent >= 10 then
      raise exception 'You are sending requests too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  else
    select count(*) into recent from public.community_members
      where user_id = new.user_id and joined_at > now() - interval '1 hour';
    if recent >= 30 then
      raise exception 'You are joining too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger communities_rate_limit before insert on public.communities
  for each row execute function private.enforce_community_rate_limit();
create trigger community_requests_rate_limit before insert on public.community_requests
  for each row execute function private.enforce_community_rate_limit();
create trigger community_members_rate_limit before insert on public.community_members
  for each row execute function private.enforce_community_rate_limit();

-- Moderators are told when someone asks to join.
create function private.notify_join_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
  select m.user_id, new.user_id, 'community_join_request', 'community', new.community_id
  from public.community_members m
  where m.community_id = new.community_id
    and m.role in ('owner', 'moderator')
    and m.user_id <> new.user_id
    and not private.pair_blocked(new.user_id, m.user_id);
  return new;
end;
$$;
create trigger community_requests_notify after insert on public.community_requests
  for each row execute function private.notify_join_request();

-- Announcements are audited when published or removed.
create function private.audit_announcement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.community_audit(new.community_id, 'announcement.create', 'announcement', new.id, '{}');
    return new;
  end if;
  -- When the whole community is being deleted there is nobody left to audit it against.
  if exists (select 1 from public.communities c where c.id = old.community_id) then
    perform private.community_audit(old.community_id, 'announcement.delete', 'announcement', old.id, '{}');
  end if;
  return old;
end;
$$;
create trigger community_announcements_audit after insert or delete on public.community_announcements
  for each row execute function private.audit_announcement();

-- ---------------------------------------------------------------------------
-- Community RPCs (moderators and owners). Each checks the role, acts, and audits.
-- ---------------------------------------------------------------------------
create function public.decide_join_request(p_request uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.community_requests;
begin
  if (select auth.uid()) is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into r from public.community_requests where id = p_request for update;
  if not found or r.status <> 'pending' then
    raise exception 'That request is no longer open.' using errcode = 'no_data_found';
  end if;
  if not private.is_community_staff(r.community_id) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  if p_approve then
    if exists (select 1 from public.community_bans b where b.community_id = r.community_id and b.user_id = r.user_id) then
      raise exception 'That member cannot join this community.' using errcode = 'check_violation';
    end if;
    insert into public.community_members (community_id, user_id, role)
    values (r.community_id, r.user_id, 'member')
    on conflict do nothing;
  end if;

  update public.community_requests
    set status = case when p_approve then 'approved' else 'rejected' end,
        decided_by = (select auth.uid()), decided_at = now()
    where id = p_request;

  -- The request needs nobody's attention any more.
  update public.notifications set read_at = coalesce(read_at, now())
    where type = 'community_join_request' and entity_id = r.community_id and actor_id = r.user_id;

  if p_approve then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (r.user_id, null, 'community_request_approved', 'community', r.community_id);
  end if;

  perform private.community_audit(
    r.community_id, case when p_approve then 'request.approve' else 'request.reject' end,
    'member', r.user_id, '{}'
  );
end;
$$;

create function public.set_community_role(p_community uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.is_member() or private.community_role(p_community) is distinct from 'owner' then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_role not in ('moderator', 'member') then
    raise exception 'Unknown role' using errcode = 'check_violation';
  end if;
  update public.community_members set role = p_role
    where community_id = p_community and user_id = p_user and role <> 'owner';
  if not found then
    raise exception 'That member cannot be changed.' using errcode = 'no_data_found';
  end if;
  perform private.community_audit(p_community, 'role.' || p_role, 'member', p_user, '{}');
end;
$$;

create function public.community_set_ban(p_community uuid, p_user uuid, p_banned boolean, p_reason text default 'other')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  mine text := private.community_role(p_community);
  theirs text;
begin
  if me is null or not private.is_member() or mine is null or mine not in ('owner', 'moderator') then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_user = me then
    raise exception 'You cannot remove yourself this way.' using errcode = 'check_violation';
  end if;
  select role into theirs from public.community_members where community_id = p_community and user_id = p_user;
  if theirs = 'owner' or (theirs = 'moderator' and mine <> 'owner') then
    raise exception 'That member cannot be removed.' using errcode = 'check_violation';
  end if;

  if p_banned then
    insert into public.community_bans (community_id, user_id, banned_by, reason)
    values (p_community, p_user, me, coalesce(p_reason, 'other'))
    on conflict (community_id, user_id) do nothing;
    delete from public.community_members where community_id = p_community and user_id = p_user;
    delete from public.community_requests where community_id = p_community and user_id = p_user and status = 'pending';
  else
    delete from public.community_bans where community_id = p_community and user_id = p_user;
  end if;
  perform private.community_audit(
    p_community, case when p_banned then 'member.remove' else 'member.restore' end, 'member', p_user,
    jsonb_build_object('reason', coalesce(p_reason, 'other'))
  );
end;
$$;

create function public.community_remove_post(p_post uuid, p_reason text default 'rules')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
  author uuid;
begin
  if (select auth.uid()) is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select community_id, author_id into cid, author from public.posts where id = p_post;
  if cid is null then
    raise exception 'That post is not in a community.' using errcode = 'no_data_found';
  end if;
  if not private.is_community_staff(cid) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_reason not in ('rules', 'spam', 'harassment', 'privacy', 'off_topic', 'other') then
    raise exception 'Unknown reason' using errcode = 'check_violation';
  end if;

  delete from public.posts where id = p_post;
  if author is not null and author <> (select auth.uid()) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (author, null, 'community_post_removed', 'community', cid);
  end if;
  perform private.community_audit(cid, 'post.remove', 'post', p_post, jsonb_build_object('reason', p_reason));
end;
$$;

create function public.community_remove_comment(p_comment uuid, p_reason text default 'rules')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cid uuid;
begin
  if (select auth.uid()) is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select p.community_id into cid
    from public.post_comments c join public.posts p on p.id = c.post_id where c.id = p_comment;
  if cid is null then
    raise exception 'That comment is not in a community.' using errcode = 'no_data_found';
  end if;
  if not private.is_community_staff(cid) then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_reason not in ('rules', 'spam', 'harassment', 'privacy', 'off_topic', 'other') then
    raise exception 'Unknown reason' using errcode = 'check_violation';
  end if;
  delete from public.post_comments where id = p_comment;
  perform private.community_audit(cid, 'comment.remove', 'comment', p_comment, jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- Forums
-- ---------------------------------------------------------------------------
create table public.forum_topics (
  slug text primary key,
  name text not null,
  description text not null,
  sort_order integer not null default 0,
  constraint forum_topics_slug_valid check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

insert into public.forum_topics (slug, name, description, sort_order) values
  ('study-and-exams', 'Study and exams', 'Study methods, licensing and board exam preparation, and how to learn difficult material.', 10),
  ('clinical-education', 'Clinical education', 'Placements, supervision, competencies and getting the most from practical training.', 20),
  ('evidence-and-research', 'Evidence and research', 'Reading, appraising and discussing published evidence, study design and statistics.', 30),
  ('techniques-and-methods', 'Techniques and methods', 'How professionals approach assessments, interventions and methods, in general terms.', 40),
  ('professional-practice', 'Professional practice', 'Practice questions discussed through non-identifiable scenarios, for learning only.', 50),
  ('ethics-and-boundaries', 'Ethics and boundaries', 'Professional ethics, boundaries, consent and dilemmas, discussed in general terms.', 60),
  ('career-and-transitions', 'Career and transitions', 'Choosing a path, changing direction, interviews, internships and first jobs.', 70),
  ('wellbeing-and-burnout', 'Wellbeing and burnout', 'Peer perspectives on workload, stress and staying well. Not therapy or crisis support.', 80),
  ('public-health-and-policy', 'Public health and policy', 'Population health, systems, policy and community work.', 90),
  ('tools-and-technology', 'Tools and technology', 'Software, devices, documentation tools and digital practice.', 100),
  ('teaching-and-mentoring', 'Teaching and mentoring', 'Educators, supervisors and mentors sharing approaches and resources.', 110),
  ('other', 'Something else', 'Questions that do not fit another topic.', 999);

-- Who wrote what. The only place an anonymous author exists.
create table public.forum_identity (
  content_type text not null,
  content_id uuid not null,
  author_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (content_type, content_id),
  constraint forum_identity_type_valid check (content_type in ('question', 'answer', 'reply'))
);
create index forum_identity_author_idx on public.forum_identity (author_id, content_type, created_at desc);

create table public.forum_questions (
  id uuid primary key default gen_random_uuid(),
  topic_slug text not null references public.forum_topics (slug),
  kind text not null,
  title text not null,
  body text not null,
  -- NULL when the question is anonymous. The writer is in forum_identity.
  author_id uuid references public.profiles (id) on delete cascade,
  is_anonymous boolean not null default false,
  accepted_answer_id uuid,
  -- The asker confirmed the question contains no identifiable patient or client information.
  confirmed_deidentified boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  search tsvector generated always as (to_tsvector('simple', title || ' ' || body)) stored,

  -- Must match QUESTION_KINDS in src/features/forums/options.ts.
  constraint forum_questions_kind_valid check (kind in ('academic', 'technique', 'evidence', 'scenario', 'career', 'other')),
  constraint forum_questions_title_length check (title ~ '[^[:space:]]' and char_length(title) between 10 and 150),
  constraint forum_questions_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 5000),
  constraint forum_questions_anonymity check (
    (is_anonymous and author_id is null) or (not is_anonymous and author_id is not null)
  ),
  constraint forum_questions_confirmed check (confirmed_deidentified)
);
create index forum_questions_feed_idx on public.forum_questions (created_at desc, id desc);
create index forum_questions_topic_idx on public.forum_questions (topic_slug, created_at desc, id desc);
create index forum_questions_kind_idx on public.forum_questions (kind, created_at desc);
create index forum_questions_search_idx on public.forum_questions using gin (search);
create index forum_questions_author_idx on public.forum_questions (author_id) where author_id is not null;

create table public.forum_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  author_id uuid references public.profiles (id) on delete cascade,
  is_anonymous boolean not null default false,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  constraint forum_answers_question_fkey foreign key (question_id)
    references public.forum_questions (id) on delete cascade,
  constraint forum_answers_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 5000),
  constraint forum_answers_anonymity check (
    (is_anonymous and author_id is null) or (not is_anonymous and author_id is not null)
  )
);
create index forum_answers_question_idx on public.forum_answers (question_id, created_at, id);
create index forum_answers_author_idx on public.forum_answers (author_id) where author_id is not null;

alter table public.forum_questions add constraint forum_questions_accepted_fkey
  foreign key (accepted_answer_id) references public.forum_answers (id) on delete set null;

create table public.forum_replies (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null,
  author_id uuid references public.profiles (id) on delete cascade,
  is_anonymous boolean not null default false,
  body text not null,
  created_at timestamptz not null default now(),
  constraint forum_replies_answer_fkey foreign key (answer_id)
    references public.forum_answers (id) on delete cascade,
  constraint forum_replies_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 1000),
  constraint forum_replies_anonymity check (
    (is_anonymous and author_id is null) or (not is_anonymous and author_id is not null)
  )
);
create index forum_replies_answer_idx on public.forum_replies (answer_id, created_at, id);

-- "Helpful" votes: one per member per answer.
create table public.forum_votes (
  answer_id uuid not null references public.forum_answers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);
create index forum_votes_user_idx on public.forum_votes (user_id, answer_id);

-- Followers of a question. Private to the follower.
create table public.forum_follows (
  question_id uuid not null references public.forum_questions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);
create index forum_follows_user_idx on public.forum_follows (user_id, created_at desc);

create function private.mark_forum_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  -- Only questions have a title and topic.
  if tg_table_name = 'forum_questions' then
    if new.title is distinct from old.title or new.topic_slug is distinct from old.topic_slug then
      new.edited_at := now();
    end if;
  end if;
  return new;
end;
$$;
create trigger forum_questions_updated before update on public.forum_questions
  for each row execute function private.set_updated_at();
create trigger forum_questions_edited before update on public.forum_questions
  for each row execute function private.mark_forum_edited();
create trigger forum_answers_updated before update on public.forum_answers
  for each row execute function private.set_updated_at();
create trigger forum_answers_edited before update on public.forum_answers
  for each row execute function private.mark_forum_edited();

-- ---------------------------------------------------------------------------
-- Forum helpers
-- ---------------------------------------------------------------------------
create function private.is_content_author(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.forum_identity i
    where i.content_type = p_type and i.content_id = p_id and i.author_id = (select auth.uid())
  )
$$;

-- True when the caller and the writer (public OR anonymous) have a block between them. Used to
-- hide content silently: an anonymous writer is never confirmed by an error message.
create function private.content_author_blocked(p_type text, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.forum_identity i
    where i.content_type = p_type and i.content_id = p_id
      and private.has_block_between(i.author_id, (select auth.uid()))
  )
$$;

create function private.forum_content_visible(p_type text, p_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  qid uuid;
  aid uuid;
begin
  if p_type = 'question' then
    qid := p_id;
  elsif p_type = 'answer' then
    select question_id into qid from public.forum_answers where id = p_id;
    aid := p_id;
  elsif p_type = 'reply' then
    select answer_id into aid from public.forum_replies where id = p_id;
    select question_id into qid from public.forum_answers where id = aid;
  else
    return false;
  end if;
  if qid is null or not exists (select 1 from public.forum_questions where id = qid) then
    return false;
  end if;
  if p_type = 'reply' and private.content_author_blocked('reply', p_id) then
    return false;
  end if;
  if aid is not null and private.content_author_blocked('answer', aid) then
    return false;
  end if;
  return not private.content_author_blocked('question', qid);
end;
$$;

-- Notifications for forum activity. They run when the identity row is written, because that is the
-- first moment the real writer is known. An anonymous writer is never named as the actor.
create function private.notify_forum_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  qid uuid;
  aid_holder uuid;
  anon boolean;
  actor uuid;
begin
  if new.content_type = 'answer' then
    select a.question_id, a.is_anonymous into qid, anon from public.forum_answers a where a.id = new.content_id;
    if qid is null then return new; end if;
    actor := case when anon then null else new.author_id end;
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    select r.uid, actor, 'forum_answer', 'forum_question', qid
    from (
      select i.author_id as uid from public.forum_identity i
        where i.content_type = 'question' and i.content_id = qid
      union
      select f.user_id from public.forum_follows f where f.question_id = qid
    ) r
    where r.uid <> new.author_id
      and coalesce((select inapp_comments from public.notification_preferences where user_id = r.uid), true)
      and not private.pair_blocked(new.author_id, r.uid)
      and not exists (select 1 from public.member_mutes m where m.muter_id = r.uid and m.muted_id = new.author_id)
    limit 200;
  elsif new.content_type = 'reply' then
    select a.question_id, a.id, p.is_anonymous into qid, aid_holder, anon
      from public.forum_replies p join public.forum_answers a on a.id = p.answer_id
      where p.id = new.content_id;
    if qid is null then return new; end if;
    actor := case when anon then null else new.author_id end;
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    select i.author_id, actor, 'forum_reply', 'forum_question', qid
    from public.forum_identity i
    where i.content_type = 'answer' and i.content_id = aid_holder
      and i.author_id <> new.author_id
      and coalesce((select inapp_comments from public.notification_preferences where user_id = i.author_id), true)
      and not private.pair_blocked(new.author_id, i.author_id)
      and not exists (select 1 from public.member_mutes m where m.muter_id = i.author_id and m.muted_id = new.author_id);
  end if;
  return new;
end;
$$;

create trigger forum_identity_notify after insert on public.forum_identity
  for each row execute function private.notify_forum_activity();

-- The asker choosing an answer tells that answer's writer (never naming the asker).
create function private.notify_answer_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.accepted_answer_id is not null and new.accepted_answer_id is distinct from old.accepted_answer_id then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    select a.author_id, null, 'forum_answer_accepted', 'forum_question', new.id
    from public.forum_identity a
    where a.content_type = 'answer' and a.content_id = new.accepted_answer_id
      and not exists (
        select 1 from public.forum_identity q
        where q.content_type = 'question' and q.content_id = new.id and q.author_id = a.author_id
      )
      and coalesce((select inapp_comments from public.notification_preferences where user_id = a.author_id), true);
  end if;
  return new;
end;
$$;
create trigger forum_questions_accepted after update of accepted_answer_id on public.forum_questions
  for each row execute function private.notify_answer_accepted();

-- Deleting forum content removes saves, notifications and the private identity row. Deleting an
-- identity row (an account was deleted) removes the content, so nothing is left without an owner.
create function private.clear_forum_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'forum_questions' then
    delete from public.saved_items where item_type = 'forum_question' and item_id = old.id;
    delete from public.notifications where entity_type = 'forum_question' and entity_id = old.id;
    delete from public.forum_identity where content_type = 'question' and content_id = old.id;
  elsif tg_table_name = 'forum_answers' then
    delete from public.saved_items where item_type = 'forum_answer' and item_id = old.id;
    delete from public.forum_identity where content_type = 'answer' and content_id = old.id;
  else
    delete from public.forum_identity where content_type = 'reply' and content_id = old.id;
  end if;
  return old;
end;
$$;
create trigger forum_questions_clear after delete on public.forum_questions
  for each row execute function private.clear_forum_references();
create trigger forum_answers_clear after delete on public.forum_answers
  for each row execute function private.clear_forum_references();
create trigger forum_replies_clear after delete on public.forum_replies
  for each row execute function private.clear_forum_references();

create function private.delete_content_with_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.content_type = 'question' then
    delete from public.forum_questions where id = old.content_id;
  elsif old.content_type = 'answer' then
    delete from public.forum_answers where id = old.content_id;
  else
    delete from public.forum_replies where id = old.content_id;
  end if;
  return old;
end;
$$;
create trigger forum_identity_cascade after delete on public.forum_identity
  for each row execute function private.delete_content_with_identity();

-- ---------------------------------------------------------------------------
-- Forum RPCs. Content and its private identity row are written together, in one transaction.
-- ---------------------------------------------------------------------------
create function public.ask_question(
  p_topic text, p_kind text, p_title text, p_body text, p_anonymous boolean, p_confirmed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  recent integer;
  qid uuid;
  anon boolean := coalesce(p_anonymous, false);
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not coalesce(p_confirmed, false) then
    raise exception 'Please confirm the question contains no identifiable patient or client information.'
      using errcode = 'check_violation';
  end if;
  select count(*) into recent from public.forum_identity
    where author_id = me and content_type = 'question' and created_at > now() - interval '1 hour';
  if recent >= 5 then
    raise exception 'You are asking questions too quickly. Please try again later.' using errcode = 'check_violation';
  end if;

  insert into public.forum_questions (topic_slug, kind, title, body, author_id, is_anonymous, confirmed_deidentified)
  values (p_topic, p_kind, btrim(p_title), btrim(p_body), case when anon then null else me end, anon, true)
  returning id into qid;
  insert into public.forum_identity (content_type, content_id, author_id) values ('question', qid, me);
  return qid;
end;
$$;

create function public.post_answer(p_question uuid, p_body text, p_anonymous boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  recent integer;
  aid uuid;
  anon boolean := coalesce(p_anonymous, false);
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not private.forum_content_visible('question', p_question) then
    raise exception 'That question is no longer available.' using errcode = 'no_data_found';
  end if;
  select count(*) into recent from public.forum_identity
    where author_id = me and content_type = 'answer' and created_at > now() - interval '1 hour';
  if recent >= 30 then
    raise exception 'You are answering too quickly. Please try again later.' using errcode = 'check_violation';
  end if;

  insert into public.forum_answers (question_id, author_id, is_anonymous, body)
  values (p_question, case when anon then null else me end, anon, btrim(p_body))
  returning id into aid;
  insert into public.forum_identity (content_type, content_id, author_id) values ('answer', aid, me);
  return aid;
end;
$$;

create function public.post_reply(p_answer uuid, p_body text, p_anonymous boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  recent integer;
  rid uuid;
  anon boolean := coalesce(p_anonymous, false);
begin
  if me is null or not private.is_member() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if not private.forum_content_visible('answer', p_answer) then
    raise exception 'That answer is no longer available.' using errcode = 'no_data_found';
  end if;
  select count(*) into recent from public.forum_identity
    where author_id = me and content_type = 'reply' and created_at > now() - interval '1 hour';
  if recent >= 60 then
    raise exception 'You are replying too quickly. Please try again later.' using errcode = 'check_violation';
  end if;

  insert into public.forum_replies (answer_id, author_id, is_anonymous, body)
  values (p_answer, case when anon then null else me end, anon, btrim(p_body))
  returning id into rid;
  insert into public.forum_identity (content_type, content_id, author_id) values ('reply', rid, me);
  return rid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports: the same queue, extended to forum content and communities.
-- For anonymous content target_member_id stays NULL, so neither the reporter nor the staff
-- queue ever sees the writer. Staff decisions resolve the writer inside moderate_report.
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

-- ---------------------------------------------------------------------------
-- Existing post tables learn about communities
-- ---------------------------------------------------------------------------
drop policy "posts: members can read" on public.posts;
create policy "posts: members can read"
  on public.posts for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
    and (community_id is null or (select private.can_read_community(community_id)))
  );

drop policy "posts: members can publish as themselves" on public.posts;
create policy "posts: members can publish as themselves"
  on public.posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_member())
    and (community_id is null or (select private.can_post_in_community(community_id)))
  );
grant insert (community_id) on public.posts to authenticated;

drop policy "post_comments: members can read" on public.post_comments;
create policy "post_comments: members can read"
  on public.post_comments for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
    and (select private.post_visible(post_id))
  );

drop policy "post_comments: members can comment as themselves" on public.post_comments;
create policy "post_comments: members can comment as themselves"
  on public.post_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_member())
    and (select private.post_visible(post_id))
    and not coalesce((
      select private.has_block_between(author_id, (select p.author_id from public.posts p where p.id = post_id))
    ), false)
  );

drop policy "post_likes: members can read" on public.post_likes;
create policy "post_likes: members can read"
  on public.post_likes for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
    and (select private.post_visible(post_id))
  );

drop policy "post_likes: members can like as themselves" on public.post_likes;
create policy "post_likes: members can like as themselves"
  on public.post_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (select private.post_visible(post_id))
    and not coalesce((
      select private.has_block_between(user_id, (select p.author_id from public.posts p where p.id = post_id))
    ), false)
  );

drop policy "saved_items: members can save as themselves" on public.saved_items;
create policy "saved_items: members can save as themselves"
  on public.saved_items for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (
      (item_type = 'post' and exists (select 1 from public.posts p where p.id = item_id))
      or (item_type = 'forum_question' and exists (select 1 from public.forum_questions q where q.id = item_id))
      or (item_type = 'forum_answer' and exists (select 1 from public.forum_answers a where a.id = item_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_requests enable row level security;
alter table public.community_bans enable row level security;
alter table public.community_announcements enable row level security;
alter table public.community_audit_logs enable row level security;
alter table public.forum_topics enable row level security;
alter table public.forum_identity enable row level security;
alter table public.forum_questions enable row level security;
alter table public.forum_answers enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_votes enable row level security;
alter table public.forum_follows enable row level security;

revoke all on public.communities, public.community_members, public.community_requests,
  public.community_bans, public.community_announcements, public.community_audit_logs,
  public.forum_topics, public.forum_identity, public.forum_questions, public.forum_answers,
  public.forum_replies, public.forum_votes, public.forum_follows
  from anon, authenticated;

grant select on public.communities to authenticated;
grant insert (slug, name, description, kind, visibility, rules, institution, region_label, country, created_by)
  on public.communities to authenticated;
grant update (name, description, visibility, rules, institution, region_label, country) on public.communities to authenticated;

grant select, delete on public.community_members to authenticated;
grant insert (community_id, user_id) on public.community_members to authenticated;

grant select, delete on public.community_requests to authenticated;
grant insert (community_id, user_id, message) on public.community_requests to authenticated;

grant select on public.community_bans to authenticated;

grant select, delete on public.community_announcements to authenticated;
grant insert (community_id, author_id, title, body) on public.community_announcements to authenticated;
grant update (title, body) on public.community_announcements to authenticated;

grant select on public.community_audit_logs to authenticated;

grant select on public.forum_topics to authenticated;
grant select on public.forum_identity to authenticated;

-- Content is created only by ask_question / post_answer / post_reply (no insert grant).
grant select, delete on public.forum_questions to authenticated;
grant update (topic_slug, kind, title, body, accepted_answer_id) on public.forum_questions to authenticated;
grant select, delete on public.forum_answers to authenticated;
grant update (body) on public.forum_answers to authenticated;
grant select, delete on public.forum_replies to authenticated;

grant select, delete on public.forum_votes to authenticated;
grant insert (answer_id, user_id) on public.forum_votes to authenticated;
grant select, delete on public.forum_follows to authenticated;
grant insert (question_id, user_id) on public.forum_follows to authenticated;

-- communities
create policy "communities: members can read live communities"
  on public.communities for select to authenticated
  using (
    (select private.is_member())
    and (archived_at is null or created_by = (select auth.uid()) or (select private.is_admin()))
  );
create policy "communities: members can create their own"
  on public.communities for insert to authenticated
  with check (created_by = (select auth.uid()) and (select private.is_member()));
create policy "communities: the owner can edit"
  on public.communities for update to authenticated
  using ((select private.community_role(id)) = 'owner')
  with check ((select private.community_role(id)) = 'owner');

-- community_members
create policy "community_members: readable where the community is"
  on public.community_members for select to authenticated
  using (
    (select private.is_member())
    and (user_id = (select auth.uid()) or (select private.can_read_community(community_id)))
  );
create policy "community_members: join a public community"
  on public.community_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and not (select private.is_banned_from_community(community_id))
    and exists (
      select 1 from public.communities c
      where c.id = community_id and c.visibility = 'public' and c.archived_at is null
    )
  );
create policy "community_members: leave (the owner cannot)"
  on public.community_members for delete to authenticated
  using (user_id = (select auth.uid()) and role <> 'owner');

-- community_requests
create policy "community_requests: requester and moderators can read"
  on public.community_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_community_staff(community_id)));
create policy "community_requests: ask to join a private community"
  on public.community_requests for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (select private.community_role(community_id)) is null
    and not (select private.is_banned_from_community(community_id))
    and exists (
      select 1 from public.communities c
      where c.id = community_id and c.visibility = 'private' and c.archived_at is null
    )
  );
create policy "community_requests: withdraw a pending request"
  on public.community_requests for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'pending');

-- community_bans (moderators only)
create policy "community_bans: moderators can read"
  on public.community_bans for select to authenticated
  using ((select private.is_community_staff(community_id)));

-- community_announcements
create policy "community_announcements: readable where the community is"
  on public.community_announcements for select to authenticated
  using ((select private.is_member()) and (select private.can_read_community(community_id)));
create policy "community_announcements: moderators can publish"
  on public.community_announcements for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select private.is_member())
    and (select private.is_community_staff(community_id))
  );
create policy "community_announcements: moderators can edit"
  on public.community_announcements for update to authenticated
  using ((select private.is_community_staff(community_id)))
  with check ((select private.is_community_staff(community_id)));
create policy "community_announcements: moderators can remove"
  on public.community_announcements for delete to authenticated
  using ((select private.is_community_staff(community_id)));

-- community_audit_logs
create policy "community_audit_logs: moderators and staff can read"
  on public.community_audit_logs for select to authenticated
  using ((select private.is_community_staff(community_id)) or (select private.is_admin()));

-- forum_topics
create policy "forum_topics: members can read"
  on public.forum_topics for select to authenticated
  using ((select private.is_member()));

-- forum_identity: each member sees only their own rows. Nobody, staff included, can list others.
create policy "forum_identity: a member can read their own"
  on public.forum_identity for select to authenticated
  using (author_id = (select auth.uid()));

-- forum_questions
create policy "forum_questions: members can read"
  on public.forum_questions for select to authenticated
  using ((select private.is_member()) and not (select private.content_author_blocked('question', id)));
create policy "forum_questions: the asker can edit or accept"
  on public.forum_questions for update to authenticated
  using ((select private.is_member()) and (select private.is_content_author('question', id)))
  with check (
    (select private.is_content_author('question', id))
    and (
      accepted_answer_id is null
      or exists (
        select 1 from public.forum_answers a
        where a.id = accepted_answer_id and a.question_id = forum_questions.id
      )
    )
  );
create policy "forum_questions: the asker can delete"
  on public.forum_questions for delete to authenticated
  using ((select private.is_content_author('question', id)));

-- forum_answers
create policy "forum_answers: members can read"
  on public.forum_answers for select to authenticated
  using (
    (select private.is_member())
    and not (select private.content_author_blocked('answer', id))
    and not (select private.content_author_blocked('question', question_id))
  );
create policy "forum_answers: the writer can edit"
  on public.forum_answers for update to authenticated
  using ((select private.is_member()) and (select private.is_content_author('answer', id)))
  with check ((select private.is_content_author('answer', id)));
create policy "forum_answers: the writer can delete"
  on public.forum_answers for delete to authenticated
  using ((select private.is_content_author('answer', id)));

-- forum_replies
create policy "forum_replies: members can read"
  on public.forum_replies for select to authenticated
  using (
    (select private.is_member())
    and not (select private.content_author_blocked('reply', id))
    and (select private.forum_content_visible('answer', answer_id))
  );
create policy "forum_replies: the writer can delete"
  on public.forum_replies for delete to authenticated
  using ((select private.is_content_author('reply', id)));

-- forum_votes: "helpful" on an answer you can see, never on your own
create policy "forum_votes: members can read"
  on public.forum_votes for select to authenticated
  using ((select private.is_member()) and (select private.forum_content_visible('answer', answer_id)));
create policy "forum_votes: vote as yourself on someone else's answer"
  on public.forum_votes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (select private.forum_content_visible('answer', answer_id))
    and not (select private.is_content_author('answer', answer_id))
  );
create policy "forum_votes: remove your own vote"
  on public.forum_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- forum_follows (private to the follower)
create policy "forum_follows: a member can read their own"
  on public.forum_follows for select to authenticated
  using (user_id = (select auth.uid()));
create policy "forum_follows: follow a question you can see"
  on public.forum_follows for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (select private.forum_content_visible('question', question_id))
  );
create policy "forum_follows: unfollow"
  on public.forum_follows for delete to authenticated
  using (user_id = (select auth.uid()));

-- Functions callable by signed-in members; each re-checks who is calling.
revoke execute on function public.decide_join_request(uuid, boolean) from public, anon;
revoke execute on function public.set_community_role(uuid, uuid, text) from public, anon;
revoke execute on function public.community_set_ban(uuid, uuid, boolean, text) from public, anon;
revoke execute on function public.community_remove_post(uuid, text) from public, anon;
revoke execute on function public.community_remove_comment(uuid, text) from public, anon;
revoke execute on function public.ask_question(text, text, text, text, boolean, boolean) from public, anon;
revoke execute on function public.post_answer(uuid, text, boolean) from public, anon;
revoke execute on function public.post_reply(uuid, text, boolean) from public, anon;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
grant execute on function public.set_community_role(uuid, uuid, text) to authenticated;
grant execute on function public.community_set_ban(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.community_remove_post(uuid, text) to authenticated;
grant execute on function public.community_remove_comment(uuid, text) to authenticated;
grant execute on function public.ask_question(text, text, text, text, boolean, boolean) to authenticated;
grant execute on function public.post_answer(uuid, text, boolean) to authenticated;
grant execute on function public.post_reply(uuid, text, boolean) to authenticated;

-- The private schema stays closed except for the policy helpers.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;
grant execute on function private.community_role(uuid) to authenticated;
grant execute on function private.is_community_staff(uuid) to authenticated;
grant execute on function private.is_banned_from_community(uuid) to authenticated;
grant execute on function private.can_read_community(uuid) to authenticated;
grant execute on function private.can_post_in_community(uuid) to authenticated;
grant execute on function private.post_visible(uuid) to authenticated;
grant execute on function private.is_content_author(text, uuid) to authenticated;
grant execute on function private.content_author_blocked(text, uuid) to authenticated;
grant execute on function private.forum_content_visible(text, uuid) to authenticated;
grant execute on function private.can_see_profile_details(uuid) to authenticated;
