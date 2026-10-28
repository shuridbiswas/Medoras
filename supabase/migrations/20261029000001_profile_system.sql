-- Medoras Phase 3: professional profiles (extra profile fields, education, experience, skills).
--
-- Privacy model: every column of public.profiles and every row of the tables below is visible
-- to other signed-in members once the owner has finished onboarding, so only add fields here
-- that are meant to be public. Anything private belongs in a separate owner-only table
-- (see onboarding_preferences) or a future profile_settings table. Email lives only in auth.users.

-- ---------------------------------------------------------------------------
-- Reserved usernames: routes such as /profile/edit must never be shadowed by a member.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_username_not_reserved;
alter table public.profiles add constraint profiles_username_not_reserved
  check (username is null or username not in (
    'admin', 'administrator', 'medoras', 'support', 'help', 'moderator', 'mod',
    'staff', 'team', 'official', 'security', 'root', 'system', 'null', 'undefined',
    'login', 'signup', 'home', 'onboarding', 'settings', 'api', 'auth',
    'edit', 'profile', 'profiles', 'new', 'me', 'about', 'contact', 'privacy', 'terms'
  ));

-- ---------------------------------------------------------------------------
-- New public profile fields
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column cover_path text,
  add column location_label text,
  add column professional_journey text,
  add column career_aspirations text,
  add column looking_for_mentorship boolean not null default false,
  add column open_to_mentor boolean not null default false;

alter table public.profiles
  add constraint profiles_cover_path_length check (cover_path is null or char_length(cover_path) <= 255),
  -- A general place the member chooses to show (for example "Montreal, QC"), never an address.
  add constraint profiles_location_label_length check (location_label is null or char_length(location_label) <= 80),
  add constraint profiles_journey_length check (professional_journey is null or char_length(professional_journey) <= 2000),
  add constraint profiles_aspirations_length check (career_aspirations is null or char_length(career_aspirations) <= 1000);

grant update (
  cover_path, location_label, professional_journey, career_aspirations,
  looking_for_mentorship, open_to_mentor
) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Education
-- ---------------------------------------------------------------------------
create table public.profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  institution text not null,
  qualification text not null,
  field_of_study text,
  start_year smallint,
  end_year smallint,
  currently_studying boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_education_institution_length check (char_length(institution) between 1 and 120),
  constraint profile_education_qualification_length check (char_length(qualification) between 1 and 120),
  constraint profile_education_field_length check (field_of_study is null or char_length(field_of_study) <= 120),
  constraint profile_education_description_length check (description is null or char_length(description) <= 1000),
  constraint profile_education_start_year_range check (start_year is null or start_year between 1940 and 2100),
  constraint profile_education_end_year_range check (end_year is null or end_year between 1940 and 2100),
  constraint profile_education_years_ordered check (start_year is null or end_year is null or end_year >= start_year),
  constraint profile_education_current_has_no_end check (not (currently_studying and end_year is not null))
);

create index profile_education_profile_id_idx on public.profile_education (profile_id);

create trigger profile_education_set_updated_at
  before update on public.profile_education
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Experience
-- ---------------------------------------------------------------------------
create table public.profile_experience (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  organization text not null,
  employment_type text,
  start_date date not null,
  end_date date,
  is_current boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profile_experience_title_length check (char_length(title) between 1 and 120),
  constraint profile_experience_organization_length check (char_length(organization) between 1 and 120),
  constraint profile_experience_type_valid check (
    employment_type is null or employment_type in (
      'full_time', 'part_time', 'contract', 'internship', 'placement',
      'volunteer', 'self_employed', 'other'
    )
  ),
  constraint profile_experience_description_length check (description is null or char_length(description) <= 2000),
  constraint profile_experience_dates_ordered check (end_date is null or end_date >= start_date),
  constraint profile_experience_current_has_no_end check (not (is_current and end_date is not null)),
  constraint profile_experience_start_range check (start_date between date '1940-01-01' and date '2100-12-31')
);

create index profile_experience_profile_id_idx on public.profile_experience (profile_id);

create trigger profile_experience_set_updated_at
  before update on public.profile_experience
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Skills, interests and mentorship areas (self-reported, never verified)
-- ---------------------------------------------------------------------------
create table public.profile_skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  kind text not null,
  created_at timestamptz not null default now(),

  constraint profile_skills_kind_valid check (kind in ('skill', 'interest', 'mentorship_area')),
  constraint profile_skills_name_length check (char_length(name) between 2 and 40),
  constraint profile_skills_name_trimmed check (name = btrim(name)),
  constraint profile_skills_name_no_markup check (name !~ '[<>]')
);

create index profile_skills_profile_id_idx on public.profile_skills (profile_id);
create unique index profile_skills_unique_name on public.profile_skills (profile_id, kind, lower(name));

-- ---------------------------------------------------------------------------
-- Per-profile item limits, so no one can fill the database with rows.
-- ---------------------------------------------------------------------------
create function private.enforce_profile_item_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_count integer;
  current_count integer;
begin
  if tg_table_name = 'profile_education' then
    max_count := 20;
    select count(*) into current_count from public.profile_education where profile_id = new.profile_id;
  elsif tg_table_name = 'profile_experience' then
    max_count := 30;
    select count(*) into current_count from public.profile_experience where profile_id = new.profile_id;
  else
    max_count := case new.kind when 'skill' then 30 when 'interest' then 20 else 10 end;
    select count(*) into current_count from public.profile_skills
      where profile_id = new.profile_id and kind = new.kind;
  end if;

  if current_count >= max_count then
    raise exception 'Limit of % items reached', max_count using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_education_limit before insert on public.profile_education
  for each row execute function private.enforce_profile_item_limit();
create trigger profile_experience_limit before insert on public.profile_experience
  for each row execute function private.enforce_profile_item_limit();
create trigger profile_skills_limit before insert on public.profile_skills
  for each row execute function private.enforce_profile_item_limit();

-- ---------------------------------------------------------------------------
-- Privileges and row level security: owners write, members read completed profiles.
-- ---------------------------------------------------------------------------
alter table public.profile_education enable row level security;
alter table public.profile_experience enable row level security;
alter table public.profile_skills enable row level security;

revoke all on public.profile_education from anon, authenticated;
revoke all on public.profile_experience from anon, authenticated;
revoke all on public.profile_skills from anon, authenticated;

grant select, delete on public.profile_education to authenticated;
grant insert (profile_id, institution, qualification, field_of_study, start_year, end_year, currently_studying, description)
  on public.profile_education to authenticated;
grant update (institution, qualification, field_of_study, start_year, end_year, currently_studying, description)
  on public.profile_education to authenticated;

grant select, delete on public.profile_experience to authenticated;
grant insert (profile_id, title, organization, employment_type, start_date, end_date, is_current, description)
  on public.profile_experience to authenticated;
grant update (title, organization, employment_type, start_date, end_date, is_current, description)
  on public.profile_experience to authenticated;

grant select, delete on public.profile_skills to authenticated;
grant insert (profile_id, name, kind) on public.profile_skills to authenticated;
-- No UPDATE on skills: change a skill by deleting and adding it.

-- profile_education
create policy "profile_education: members can view completed profiles and their own"
  on public.profile_education for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = profile_education.profile_id and p.onboarding_completed
    )
  );
create policy "profile_education: owner can add"
  on public.profile_education for insert
  to authenticated
  with check (profile_id = (select auth.uid()));
create policy "profile_education: owner can update"
  on public.profile_education for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "profile_education: owner can delete"
  on public.profile_education for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- profile_experience
create policy "profile_experience: members can view completed profiles and their own"
  on public.profile_experience for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = profile_experience.profile_id and p.onboarding_completed
    )
  );
create policy "profile_experience: owner can add"
  on public.profile_experience for insert
  to authenticated
  with check (profile_id = (select auth.uid()));
create policy "profile_experience: owner can update"
  on public.profile_experience for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));
create policy "profile_experience: owner can delete"
  on public.profile_experience for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- profile_skills
create policy "profile_skills: members can view completed profiles and their own"
  on public.profile_skills for select
  to authenticated
  using (
    profile_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = profile_skills.profile_id and p.onboarding_completed
    )
  );
create policy "profile_skills: owner can add"
  on public.profile_skills for insert
  to authenticated
  with check (profile_id = (select auth.uid()));
create policy "profile_skills: owner can delete"
  on public.profile_skills for delete
  to authenticated
  using (profile_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Cover images: same rules as avatars (own folder only), larger size limit.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "covers: members can read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'covers');

create policy "covers: members can upload to their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "covers: members can update their own files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "covers: members can delete their own files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
