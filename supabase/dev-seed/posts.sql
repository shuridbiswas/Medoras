-- DEVELOPMENT ONLY. Never run this against a production project.
--
-- Adds a few clearly labelled sample posts so you can see the feed while building. It does
-- not create people: every post is attributed to a member who ALREADY exists and has finished
-- onboarding (the oldest one), and every post body starts with "[Development sample]" so it can
-- never be mistaken for real community activity. It adds no likes or comments, so no engagement
-- numbers are invented.
--
-- Run it in the Supabase SQL editor of a development project, or:
--   psql "$DEV_DATABASE_URL" -f supabase/dev-seed/posts.sql
--
-- Remove the samples again with:
--   delete from public.posts where body like '[Development sample]%';

do $$
declare
  author uuid;
begin
  select id into author
  from public.profiles
  where onboarding_completed
  order by created_at
  limit 1;

  if author is null then
    raise exception 'No onboarded member exists yet. Sign up and finish onboarding first.';
  end if;

  insert into public.posts (author_id, category, body, created_at) values
    (author, 'general_discussion',
     '[Development sample] Testing how a short general post looks in the feed.',
     now() - interval '5 hours'),
    (author, 'academic_life',
     E'[Development sample] A longer post with line breaks.\n\nSecond paragraph, to check spacing and wrapping on small screens.',
     now() - interval '1 day'),
    (author, 'questions',
     '[Development sample] A question-style post. (Real members must never include patient details.)',
     now() - interval '2 days'),
    (author, 'research_knowledge',
     '[Development sample] Placeholder for a research or knowledge-sharing post.',
     now() - interval '9 days');
end;
$$;
