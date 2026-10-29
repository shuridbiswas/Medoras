-- Medoras Phase 4: community feed (posts, likes, comments).
--
-- Authorization model: only signed-in members who finished onboarding can read or write feed
-- content, and every write is tied to auth.uid() by row level security. Authors are never taken
-- from client input; the policies reject a forged author_id / user_id. Content is edited or
-- deleted only by its owner. Counts are computed from the rows, so they cannot drift.

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Set only when the text or category changes, so the UI can say "edited".
  edited_at timestamptz,

  -- Must match POST_CATEGORIES in src/features/feed/options.ts.
  constraint posts_category_valid check (category in (
    'general_discussion', 'academic_life', 'career_journey', 'professional_advice',
    'research_knowledge', 'personal_achievement', 'questions'
  )),
  constraint posts_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 3000)
);

-- Newest-first feed with a stable keyset cursor (created_at, id).
create index posts_feed_idx on public.posts (created_at desc, id desc);
create index posts_category_feed_idx on public.posts (category, created_at desc, id desc);
create index posts_author_feed_idx on public.posts (author_id, created_at desc, id desc);

create trigger posts_set_updated_at before update on public.posts
  for each row execute function private.set_updated_at();

create function private.mark_post_edited()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.body is distinct from old.body or new.category is distinct from old.category then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

create trigger posts_mark_edited before update on public.posts
  for each row execute function private.mark_post_edited();

-- ---------------------------------------------------------------------------
-- Likes: one per member per post (the primary key enforces it)
-- ---------------------------------------------------------------------------
create table public.post_likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index post_likes_user_idx on public.post_likes (user_id, post_id);

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),

  constraint post_comments_body_length check (body ~ '[^[:space:]]' and char_length(body) <= 1000)
);

create index post_comments_post_idx on public.post_comments (post_id, created_at, id);
create index post_comments_author_idx on public.post_comments (author_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Basic abuse limits (per author, rolling hour), enforced in the database so every client
-- path is covered. These are spam guards, not moderation.
-- ---------------------------------------------------------------------------
create function private.enforce_feed_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  recent integer;
begin
  if tg_table_name = 'posts' then
    select count(*) into recent from public.posts
      where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 20 then
      raise exception 'You are posting too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  else
    select count(*) into recent from public.post_comments
      where author_id = new.author_id and created_at > now() - interval '1 hour';
    if recent >= 60 then
      raise exception 'You are commenting too quickly. Please try again later.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger posts_rate_limit before insert on public.posts
  for each row execute function private.enforce_feed_rate_limit();
create trigger post_comments_rate_limit before insert on public.post_comments
  for each row execute function private.enforce_feed_rate_limit();

-- ---------------------------------------------------------------------------
-- Privileges and row level security
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;

revoke all on public.posts from anon, authenticated;
revoke all on public.post_likes from anon, authenticated;
revoke all on public.post_comments from anon, authenticated;

grant select, delete on public.posts to authenticated;
grant insert (author_id, category, body) on public.posts to authenticated;
grant update (category, body) on public.posts to authenticated;

grant select, delete on public.post_likes to authenticated;
grant insert (post_id, user_id) on public.post_likes to authenticated;

grant select, delete on public.post_comments to authenticated;
grant insert (post_id, author_id, body) on public.post_comments to authenticated;
-- Comments are not editable: delete and write a new one.

-- posts
create policy "posts: members can read"
  on public.posts for select
  to authenticated
  using (exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarding_completed
  ));

create policy "posts: members can publish as themselves"
  on public.posts for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
  );

create policy "posts: authors can edit their own"
  on public.posts for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "posts: authors can delete their own"
  on public.posts for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- post_likes
create policy "post_likes: members can read"
  on public.post_likes for select
  to authenticated
  using (exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarding_completed
  ));

create policy "post_likes: members can like as themselves"
  on public.post_likes for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
  );

create policy "post_likes: members can remove their own like"
  on public.post_likes for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- post_comments
create policy "post_comments: members can read"
  on public.post_comments for select
  to authenticated
  using (exists (
    select 1 from public.profiles me
    where me.id = (select auth.uid()) and me.onboarding_completed
  ));

create policy "post_comments: members can comment as themselves"
  on public.post_comments for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.profiles me
      where me.id = (select auth.uid()) and me.onboarding_completed
    )
  );

create policy "post_comments: authors can delete their own"
  on public.post_comments for delete
  to authenticated
  using (author_id = (select auth.uid()));
