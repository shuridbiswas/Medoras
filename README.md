# Medoras

**Connect. Learn. Grow. Belong.**

A professional and social network for the healthcare and social services community. See [CLAUDE.md](CLAUDE.md) for the product vision, architecture and roadmap.

**Status:** Phase 1 (welcome page), Phase 2 (authentication and onboarding) and Phase 3 (professional profiles) and Phase 4 (member home and community feed) are implemented. Phases 2 to 4 were verified with automated tests, a database security test and a production build. It has **not** been tested end to end against a real Supabase project; see [What is verified](#what-is-verified).

## Requirements

- Node.js 20.19+ (24 LTS recommended) and npm
- A [Supabase](https://supabase.com) project (free tier is fine) for sign-up, sign-in and onboarding

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values (next section)
npm run dev
```

Open http://localhost:3000. Without Supabase values the welcome page works, and the auth pages clearly say authentication isn't configured instead of failing silently.

## Supabase setup (required for sign-up and sign-in)

1. **Create a project** at supabase.com.
2. **Env vars.** In Project Settings > API Keys copy the project URL and the **publishable** key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Never use the secret or service_role key in this app.
3. **Database.** Apply **all** migrations in `supabase/migrations/` in order (four files; Phase 3 adds `20261029000001_profile_system.sql`, Phase 4 adds `20261030000001_posts_and_interactions.sql`). Either:
   - paste each file into the SQL Editor, oldest first, or
   - `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

   They create `profiles`, `onboarding_preferences`, the signup trigger, `profile_education`, `profile_experience`, `profile_skills`, `posts`, `post_likes`, `post_comments`, row level security, and the `avatars` and `covers` storage buckets with their policies.
4. **Authentication > URL Configuration.** Set Site URL to your site (`http://localhost:3000` locally) and add `http://localhost:3000/auth/callback` (and your production URL's `/auth/callback`) to Redirect URLs.
5. **Authentication > Sign In / Providers > Email.** Keep **Confirm email** enabled and set **minimum password length to 10 or less** (the app requires 10 characters, a letter and a number).
6. **Authentication > Email Templates.** Replace the **Confirm sign up** and **Reset password** templates with the HTML in `supabase/templates/confirmation.html` and `recovery.html`. They link to `/auth/callback?token_hash=…`, which lets verification work from any device. (The default templates also work, but only in the same browser that requested the email.)
7. **Email delivery.** Supabase's built-in sender is heavily rate limited. Configure your own SMTP provider before real users sign up.
8. **Restart** `npm run dev` after editing `.env.local`.

## How authentication works

```
Visitor -> /signup -> verification email -> /auth/callback -> /onboarding -> /home
Member  -> /login ------------------------------------------> /home
Signed in, onboarding unfinished: any private route -> /onboarding
```

- **Sessions** are Supabase cookies managed by `@supabase/ssr` (`src/lib/supabase`). "Keep me signed in" keeps the persistent cookie; unticked, the session ends when the browser closes.
- **Protection happens on the server twice.** `src/proxy.ts` refreshes and verifies the session (`getClaims`) and redirects; every private page and action then re-checks through `src/lib/auth/session.ts` (`requireUser`, `requireMember`, `requireOnboardingPending`), which asks the Auth server (`getUser`) and requires a verified email.
- **Open redirects** are blocked: `?next=` values pass through `safeNextPath`, which only allows internal paths under `/home`, `/onboarding` and `/reset-password`.
- **No account enumeration:** sign-up for an existing email and password reset for unknown emails show the same screen as success; login uses one message for bad email or password.
- **Data:** `profiles` holds only fields other members may see (no email, no credentials; those live in Supabase's `auth.users`, which is never exposed). Private answers (purposes, city) live in `onboarding_preferences`, readable only by their owner. Row level security, column-level grants and CHECK constraints are in `supabase/migrations/`.

## Profiles (Phase 3)

- `/profile/<username>` shows a member's profile to other signed-in members: header with cover and photo, About, Education, Experience, Skills & interests, Mentorship preferences, and an Activity tab that will list posts once the feed exists.
- `/profile/edit` lets the owner edit everything (photos, details, About, mentorship, skills, education, experience) with validation, save/cancel and success or error messages.
- `/settings` shows the account email (private), changes the password, and summarizes what is visible to members.
- Profile photos (2 MB) and cover images (5 MB) must be real JPEG, PNG or WebP files; the server checks the file's bytes, not just its name.
- Only signed-in, onboarded members can view profiles, and only the owner can change one. Email addresses are never part of a profile. Location is optional and only a general place the member types (for example "Montreal, QC") is shown, with their country.
- Mentorship preferences, skills and interests are **self-reported**; Medoras does not verify credentials and shows no verification badges.
- Storage buckets are public-by-URL (unguessable per-upload file names); uploads and deletes are limited to the member's own folder.

## Home feed (Phase 4)

- `/home` is the signed-in landing page: greeting, post composer, category filters (Latest plus seven categories), a newest-first feed, and side rails. On phones the navigation moves to a bottom tab bar with a one-tap Post shortcut and a More menu.
- Members can post text in one of seven categories (General Discussion, Academic Life, Career Journey, Professional Advice, Research and Knowledge, Personal Achievement, Questions), edit or delete their own posts, like and unlike, and comment (and delete their own comments). Authors link to their real profiles, and each profile's Activity tab lists that member's posts.
- Counts come from the database rows. The feed loads 15 posts at a time ("Load more posts").
- `/search` finds members by name or username (also by field, or "open to mentoring", which is self-reported). It does not search posts, jobs or topics.
- The right rail shows only real data: newest members, fields to explore, categories with posts in the last 7 days, members who say they can mentor, and a list of planned features marked "not available yet". `/communities`, `/mentorship`, `/careers` and `/saved` are informational pages for features that are not built.
- Safety: the composer and feed remind members not to share identifiable patient information. The [community guidelines](/community-guidelines) say posts are member views, not verified medical advice, and that **identity verification and automated moderation are not active** and **reporting and blocking are not built yet**.
- Spam guard: at most 20 posts and 60 comments per member per hour (database trigger).
- **Development seed (optional):** `supabase/dev-seed/posts.sql` adds four posts labelled "[Development sample]" under an existing onboarded member. For development projects only; it creates no people, likes or comments. Remove them with `delete from public.posts where body like '[Development sample]%';`.

## Scripts

| Command             | Purpose                                      |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Start the dev server                         |
| `npm run build`     | Production build                             |
| `npm run start`     | Serve the production build                   |
| `npm run lint`      | ESLint                                       |
| `npm run typecheck` | TypeScript (strict) check                    |
| `npm test`          | Vitest: unit, component and database tests   |

## Routes

Public: `/`, `/login`, `/signup`, `/forgot-password`, `/about`, `/community-guidelines`, `/privacy`, `/terms`, `/contact`, `/auth/callback` (email links).
Signed-in: `/onboarding`, `/reset-password` (from a recovery link), `/home`, `/search`, `/profile/[username]`, `/profile/edit`, `/settings`, plus informational pages `/communities`, `/mentorship`, `/careers`, `/saved`.

## What is verified

Automatically, by `npm test` (293 tests), `npm run lint`, `npm run typecheck` and `npm run build`:

- Registration, existing-email handling, weak passwords, rate limiting, missing configuration
- Login success, invalid credentials, unverified email, session-only option, safe redirects
- Email verification and recovery links (`/auth/callback`), including invalid/expired links and open-redirect attempts
- Password reset (session required, reuse, validation) and sign-out
- Proxy and server-side gates: unauthorized access, unverified email, onboarding redirects
- Onboarding validation, username conflicts, avatar content checks
- Profile creation and updates, owner-only edits, unauthorized-edit attempts, image upload checks, missing or malformed usernames, tab keyboard navigation, empty states, and that no email or verification badges render
- The feed: creating, editing and deleting posts, unauthorized edit and delete attempts (zero rows matched), forged author ids, likes (duplicate and unlike), comments (own-only delete), keyset pagination and cursor validation, optimistic like rollback, "Load more", failed saves keeping the member's text, the mobile tab bar and More menu, the account menu, profile links from posts, and protected routes
- The SQL migrations, run in an in-memory Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas: constraints, unique usernames, row level security (own-row updates only, no email exposure, anonymous blocked), column grants, education/experience/skills rules and limits, and avatar and cover folder policies

**Not verified (needs your Supabase project):** real email delivery and links, Supabase Auth's actual error codes and rate limits, cookie behaviour across a real browser session, posting, liking and commenting against a live project (PostgREST embedded counts and author embeds, real RLS evaluation), the storage upload path against live `avatars` and `covers` buckets (including the Supabase size and type limits), and the real RLS evaluation by PostgREST. After completing the setup above, walk through: sign up, receive and click the email, finish onboarding, sign out and in, reset the password. Run `npx supabase db advisors` (or the dashboard's Security Advisor) as well.

## Deploying

Vercel-compatible. Set the three env vars from `.env.example` in the project settings, set `NEXT_PUBLIC_SITE_URL` to the production URL, and add that URL's `/auth/callback` to Supabase's Redirect URLs.
