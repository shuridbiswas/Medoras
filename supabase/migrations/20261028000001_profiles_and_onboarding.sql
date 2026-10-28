-- Medoras Phase 2: profiles, onboarding preferences and row level security.
-- Allowed values below mirror src/features/onboarding/options.ts. Keep both in sync.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Shared trigger function: keep updated_at current.
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: fields other signed-in members may see. Contains no email and no
-- authentication data (those stay in auth.users, which the Data API never exposes).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  first_name text not null,
  last_name text not null default '',
  headline text,
  bio text,
  avatar_path text,
  member_type text,
  fields text[] not null default '{}',
  institution text,
  qualification text,
  specialty text,
  career_stage text,
  country text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_username_not_reserved
    check (username is null or username not in (
      'admin', 'administrator', 'medoras', 'support', 'help', 'moderator', 'mod',
      'staff', 'team', 'official', 'security', 'root', 'system', 'null', 'undefined',
      'login', 'signup', 'home', 'onboarding', 'settings', 'api', 'auth'
    )),
  constraint profiles_username_unique unique (username),
  constraint profiles_first_name_length check (char_length(first_name) between 1 and 60),
  constraint profiles_last_name_length check (char_length(last_name) <= 60),
  constraint profiles_headline_length check (headline is null or char_length(headline) <= 120),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 1000),
  constraint profiles_avatar_path_length check (avatar_path is null or char_length(avatar_path) <= 255),
  constraint profiles_institution_length check (institution is null or char_length(institution) <= 120),
  constraint profiles_qualification_length check (qualification is null or char_length(qualification) <= 120),
  constraint profiles_specialty_length check (specialty is null or char_length(specialty) <= 120),
  constraint profiles_member_type_valid check (
    member_type is null or member_type in (
      'undergraduate_student', 'graduate_student', 'recent_graduate',
      'healthcare_professional', 'social_services_professional',
      'educator', 'researcher', 'other'
    )
  ),
  constraint profiles_fields_valid check (
    cardinality(fields) <= 5
    and fields <@ array[
      'nursing', 'medicine', 'psychology', 'social_work', 'pharmacy', 'physiotherapy',
      'occupational_therapy', 'speech_language_pathology', 'audiology', 'public_health', 'other'
    ]::text[]
  ),
  constraint profiles_career_stage_valid check (
    career_stage is null or career_stage in (
      'student', 'new_graduate', 'early_career', 'mid_career', 'senior', 'other'
    )
  ),
  constraint profiles_country_format check (country is null or country ~ '^[A-Z]{2}$'),
  -- A profile can only be marked complete once the essentials exist.
  constraint profiles_completed_requires_essentials check (
    not onboarding_completed
    or (
      username is not null
      and member_type is not null
      and cardinality(fields) >= 1
      and career_stage is not null
      and country is not null
    )
  )
);

comment on table public.profiles is
  'Member profile fields visible to other signed-in members. No email or auth data.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- onboarding_preferences: private to the member (purposes and optional city).
-- ---------------------------------------------------------------------------
create table public.onboarding_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  purposes text[] not null default '{}',
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint onboarding_preferences_purposes_valid check (
    cardinality(purposes) <= 7
    and purposes <@ array[
      'build_network', 'find_mentor', 'become_mentor', 'connect_students',
      'learn_share', 'find_jobs', 'join_communities'
    ]::text[]
  ),
  constraint onboarding_preferences_city_length check (city is null or char_length(city) <= 80)
);

comment on table public.onboarding_preferences is
  'Private onboarding answers. Readable and writable only by the owning member.';

create trigger onboarding_preferences_set_updated_at
  before update on public.onboarding_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Create the empty profile rows when a new auth user is created.
-- SECURITY DEFINER is required to write into public from the auth schema trigger;
-- it lives in the unexposed "private" schema and is not executable by API roles.
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    left(coalesce(nullif(btrim(new.raw_user_meta_data ->> 'first_name'), ''), 'Member'), 60),
    left(coalesce(btrim(new.raw_user_meta_data ->> 'last_name'), ''), 60)
  );

  insert into public.onboarding_preferences (user_id) values (new.id);

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges: nothing for anonymous visitors; column-limited writes for members.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.onboarding_preferences enable row level security;

revoke all on public.profiles from anon, authenticated;
revoke all on public.onboarding_preferences from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (
  username, first_name, last_name, headline, bio, avatar_path, member_type, fields,
  institution, qualification, specialty, career_stage, country, onboarding_completed
) on public.profiles to authenticated;

grant select on public.onboarding_preferences to authenticated;
grant update (purposes, city) on public.onboarding_preferences to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security policies
-- ---------------------------------------------------------------------------

-- Members see their own profile always, and others only once onboarding is complete.
create policy "profiles: members can view completed profiles and their own"
  on public.profiles for select
  to authenticated
  using (onboarding_completed or id = (select auth.uid()));

create policy "profiles: members can update only their own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "onboarding_preferences: owner can view"
  on public.onboarding_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "onboarding_preferences: owner can update"
  on public.onboarding_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- No INSERT or DELETE policies: rows are created by the trigger above and removed
-- by cascade when the auth user is deleted.
