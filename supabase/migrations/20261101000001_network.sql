-- Medyra Phase 4b: professional network (connections, follows, blocks), saved items, notifications.
--
-- Authorization model, same as the feed: only signed-in members who finished onboarding can use
-- any of this, and every write is tied to auth.uid() by row level security.
--   * connections: a request is a pending row; the addressee accepts it (the only update allowed).
--     Decline, withdraw and remove are all deletes by either party. One row per pair, in either
--     direction, so duplicates and crossed requests are impossible. Pending rows are private to
--     the two people; accepted connections are visible to members (counts and lists on profiles).
--   * follows: one-way, separate from connections, visible to members.
--   * blocks: private to the blocker. Policies call private.has_block_between(), which only ever
--     answers for a pair that includes the caller, so the blocked member cannot probe for blocks.
--   * saved_items: private bookmarks. item_type is open-ended on purpose: forum questions,
--     research and jobs are added later by extending the check constraint.
--   * notifications: written only by database triggers (nobody can forge one), never contain
--     post or comment text, and are read or deleted only by their recipient.

-- ---------------------------------------------------------------------------
-- Helpers used by policies
-- ---------------------------------------------------------------------------
-- Policies run as the calling role, so it needs to reach these two functions (and nothing else
-- in the private schema: execute is revoked from everything else below).
grant usage on schema private to authenticated;

create function private.is_member()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarding_completed
  )
$$;

create table public.member_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint member_blocks_not_self check (blocker_id <> blocked_id)
);

create index member_blocks_blocked_idx on public.member_blocks (blocked_id, blocker_id);

-- True when either of the two has blocked the other. Only answers for pairs that include the
-- caller; for anyone else it says false.
create function private.has_block_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ((select auth.uid()) in (a, b)) and exists (
    select 1 from public.member_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- ---------------------------------------------------------------------------
-- Connections
-- ---------------------------------------------------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,

  constraint connections_status_valid check (status in ('pending', 'accepted')),
  constraint connections_not_self check (requester_id <> addressee_id)
);

-- One row per pair, whichever direction the request went.
create unique index connections_pair_key
  on public.connections (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index connections_addressee_idx on public.connections (addressee_id, status, created_at desc);
create index connections_requester_idx on public.connections (requester_id, status, created_at desc);

create function private.mark_connection_accepted()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    new.accepted_at := now();
  end if;
  return new;
end;
$$;

create trigger connections_mark_accepted before update on public.connections
  for each row execute function private.mark_connection_accepted();

-- ---------------------------------------------------------------------------
-- Follows (one-way, independent of connections)
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);

create index follows_followee_idx on public.follows (followee_id, created_at desc);
create index follows_follower_idx on public.follows (follower_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Saved items
-- ---------------------------------------------------------------------------
create table public.saved_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_type text not null,
  item_id uuid not null,
  created_at timestamptz not null default now(),

  -- Extend this list (and the insert policy) when questions, research or jobs can be saved.
  constraint saved_items_type_valid check (item_type in ('post')),
  constraint saved_items_unique unique (user_id, item_type, item_id)
);

create index saved_items_user_idx on public.saved_items (user_id, created_at desc, id desc);
create index saved_items_item_idx on public.saved_items (item_type, item_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type text not null,
  -- What it is about, so the UI can link to it. No text from the content is ever stored.
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,

  constraint notifications_type_valid check (type in (
    'connection_request', 'connection_accepted', 'post_comment', 'comment_reply', 'mention',
    'community_event', 'mentorship_event'
  )),
  constraint notifications_entity_valid check (
    entity_type is null or entity_type in ('post', 'connection', 'community', 'mentorship')
  )
);

create index notifications_inbox_idx on public.notifications (recipient_id, created_at desc, id desc);
create index notifications_unread_idx on public.notifications (recipient_id) where read_at is null;
create index notifications_entity_idx on public.notifications (entity_type, entity_id);

-- In-app preferences live next to the existing email preference (same owner-only table).
alter table public.notification_preferences
  add column inapp_connections boolean not null default true,
  add column inapp_comments boolean not null default true;

grant insert (inapp_connections, inapp_comments) on public.notification_preferences to authenticated;
grant update (inapp_connections, inapp_comments) on public.notification_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Notification triggers. They run with the table owner's rights so a member can never insert a
-- notification directly, and they skip self-notifications, blocked pairs and muted types.
-- ---------------------------------------------------------------------------
create function private.pair_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.member_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create function private.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select inapp_connections from public.notification_preferences where user_id = new.addressee_id), true)
     and not private.pair_blocked(new.requester_id, new.addressee_id) then
    insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
    values (new.addressee_id, new.requester_id, 'connection_request', 'connection', new.id);
  end if;
  return new;
end;
$$;

create trigger connections_notify_request after insert on public.connections
  for each row execute function private.notify_connection_request();

create function private.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    -- The request is answered: it no longer needs the addressee's attention.
    update public.notifications set read_at = coalesce(read_at, now())
      where recipient_id = new.addressee_id and type = 'connection_request' and entity_id = new.id;
    if coalesce((select inapp_connections from public.notification_preferences where user_id = new.requester_id), true)
       and not private.pair_blocked(new.requester_id, new.addressee_id) then
      insert into public.notifications (recipient_id, actor_id, type, entity_type, entity_id)
      values (new.requester_id, new.addressee_id, 'connection_accepted', 'connection', new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger connections_notify_accepted after update on public.connections
  for each row execute function private.notify_connection_accepted();

-- A withdrawn or declined request takes its notification with it.
create function private.clear_connection_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notifications
    where type = 'connection_request' and entity_type = 'connection' and entity_id = old.id;
  return old;
end;
$$;

create trigger connections_clear_notifications after delete on public.connections
  for each row execute function private.clear_connection_notifications();

-- A comment notifies the post's author, and (as a reply) other members who commented earlier.
create function private.notify_post_comment()
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
     and not private.pair_blocked(new.author_id, post_author) then
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
    and not private.pair_blocked(new.author_id, prior.author_id);

  return new;
end;
$$;

create trigger post_comments_notify after insert on public.post_comments
  for each row execute function private.notify_post_comment();

-- Deleting a post removes saves and notifications that point at it.
create function private.clear_post_references()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.saved_items where item_type = 'post' and item_id = old.id;
  delete from public.notifications where entity_type = 'post' and entity_id = old.id;
  return old;
end;
$$;

create trigger posts_clear_references after delete on public.posts
  for each row execute function private.clear_post_references();

-- Blocking someone removes any connection or follow between the two and clears related
-- notifications, in both directions.
create function private.apply_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.connections
    where (requester_id = new.blocker_id and addressee_id = new.blocked_id)
       or (requester_id = new.blocked_id and addressee_id = new.blocker_id);
  delete from public.follows
    where (follower_id = new.blocker_id and followee_id = new.blocked_id)
       or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.notifications
    where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
       or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return new;
end;
$$;

create trigger member_blocks_apply after insert on public.member_blocks
  for each row execute function private.apply_block();

-- ---------------------------------------------------------------------------
-- Abuse limits (rolling hour, per member). Spam guards, not moderation.
-- ---------------------------------------------------------------------------
create function private.enforce_network_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_table_name = 'connections' then
    select count(*) into recent from public.connections
      where requester_id = new.requester_id and created_at > now() - interval '1 hour';
    if recent >= 30 then
      raise exception 'You are sending requests too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  else
    select count(*) into recent from public.follows
      where follower_id = new.follower_id and created_at > now() - interval '1 hour';
    if recent >= 100 then
      raise exception 'You are following too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger connections_rate_limit before insert on public.connections
  for each row execute function private.enforce_network_rate_limit();
create trigger follows_rate_limit before insert on public.follows
  for each row execute function private.enforce_network_rate_limit();

-- ---------------------------------------------------------------------------
-- Privileges: everything in private is off-limits except the two policy helpers.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_member() to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;

alter table public.member_blocks enable row level security;
alter table public.connections enable row level security;
alter table public.follows enable row level security;
alter table public.saved_items enable row level security;
alter table public.notifications enable row level security;

revoke all on public.member_blocks from anon, authenticated;
revoke all on public.connections from anon, authenticated;
revoke all on public.follows from anon, authenticated;
revoke all on public.saved_items from anon, authenticated;
revoke all on public.notifications from anon, authenticated;

grant select, delete on public.member_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.member_blocks to authenticated;

grant select, delete on public.connections to authenticated;
grant insert (requester_id, addressee_id) on public.connections to authenticated;
grant update (status) on public.connections to authenticated;

grant select, delete on public.follows to authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;

grant select, delete on public.saved_items to authenticated;
grant insert (user_id, item_type, item_id) on public.saved_items to authenticated;

-- No insert grant: only the triggers above create notifications.
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- member_blocks (private to the blocker)
create policy "member_blocks: blocker can read"
  on public.member_blocks for select
  to authenticated
  using (blocker_id = (select auth.uid()));

create policy "member_blocks: members can block as themselves"
  on public.member_blocks for insert
  to authenticated
  with check (blocker_id = (select auth.uid()) and (select private.is_member()));

create policy "member_blocks: blocker can unblock"
  on public.member_blocks for delete
  to authenticated
  using (blocker_id = (select auth.uid()));

-- connections
create policy "connections: parties see theirs, members see accepted"
  on public.connections for select
  to authenticated
  using (
    (select private.is_member())
    and (
      requester_id = (select auth.uid())
      or addressee_id = (select auth.uid())
      or status = 'accepted'
    )
  );

create policy "connections: members can send requests as themselves"
  on public.connections for insert
  to authenticated
  with check (
    requester_id = (select auth.uid())
    and status = 'pending'
    and (select private.is_member())
    and exists (
      select 1 from public.profiles target
      where target.id = addressee_id and target.onboarding_completed
    )
    and not (select private.has_block_between(requester_id, addressee_id))
  );

create policy "connections: addressee can accept"
  on public.connections for update
  to authenticated
  using (addressee_id = (select auth.uid()) and status = 'pending')
  with check (
    addressee_id = (select auth.uid())
    and status = 'accepted'
    and not (select private.has_block_between(requester_id, addressee_id))
  );

create policy "connections: either party can decline, withdraw or remove"
  on public.connections for delete
  to authenticated
  using (requester_id = (select auth.uid()) or addressee_id = (select auth.uid()));

-- follows
create policy "follows: members can read"
  on public.follows for select
  to authenticated
  using ((select private.is_member()));

create policy "follows: members can follow as themselves"
  on public.follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and (select private.is_member())
    and exists (
      select 1 from public.profiles target
      where target.id = followee_id and target.onboarding_completed
    )
    and not (select private.has_block_between(follower_id, followee_id))
  );

create policy "follows: followers can unfollow"
  on public.follows for delete
  to authenticated
  using (follower_id = (select auth.uid()));

-- saved_items (private bookmarks)
create policy "saved_items: owner can read"
  on public.saved_items for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "saved_items: members can save as themselves"
  on public.saved_items for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and (
      item_type <> 'post'
      or exists (select 1 from public.posts p where p.id = item_id)
    )
  );

create policy "saved_items: owner can remove"
  on public.saved_items for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- notifications
create policy "notifications: recipient can read"
  on public.notifications for select
  to authenticated
  using (recipient_id = (select auth.uid()));

create policy "notifications: recipient can mark read"
  on public.notifications for update
  to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create policy "notifications: recipient can delete"
  on public.notifications for delete
  to authenticated
  using (recipient_id = (select auth.uid()));
