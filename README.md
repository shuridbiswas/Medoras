# Medoras

**Connect. Learn. Grow. Belong.**

A professional and social network for the healthcare and social services community. See [CLAUDE.md](CLAUDE.md) for the product vision, architecture and roadmap.

**Status:** Phase 1 (welcome page), Phase 2 (authentication and onboarding) and Phase 3 (professional profiles) are implemented. Phases 2 and 3 were verified with automated tests, a database security test and a production build. It has **not** been tested end to end against a real Supabase project; see [What is verified](#what-is-verified).

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
3. **Database.** Apply **all** migrations in `supabase/migrations/` in order (three files; Phase 3 adds `20261029000001_profile_system.sql`). Either:
   - paste each file into the SQL Editor, oldest first, or
   - `npx supabase login`, `npx supabase link --project-ref <ref>`, then `npx supabase db push`.

   They create `profiles`, `onboarding_preferences`, the signup trigger, `profile_education`, `profile_experience`, `profile_skills`, row level security, and the `avatars` and `covers` storage buckets with their policies.
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
Signed-in: `/onboarding`, `/reset-password` (from a recovery link), `/home`, `/profile/[username]`, `/profile/edit`, `/settings`.

## What is verified

Automatically, by `npm test` (175 tests), `npm run lint`, `npm run typecheck` and `npm run build`:

- Registration, existing-email handling, weak passwords, rate limiting, missing configuration
- Login success, invalid credentials, unverified email, session-only option, safe redirects
- Email verification and recovery links (`/auth/callback`), including invalid/expired links and open-redirect attempts
- Password reset (session required, reuse, validation) and sign-out
- Proxy and server-side gates: unauthorized access, unverified email, onboarding redirects
- Onboarding validation, username conflicts, avatar content checks
- Profile creation and updates, owner-only edits, unauthorized-edit attempts, image upload checks, missing or malformed usernames, tab keyboard navigation, empty states, and that no email or verification badges render
- The SQL migrations, run in an in-memory Postgres (PGlite) with stand-ins for Supabase's `auth` and `storage` schemas: constraints, unique usernames, row level security (own-row updates only, no email exposure, anonymous blocked), column grants, education/experience/skills rules and limits, and avatar and cover folder policies

**Not verified (needs your Supabase project):** real email delivery and links, Supabase Auth's actual error codes and rate limits, cookie behaviour across a real browser session, the storage upload path against live `avatars` and `covers` buckets (including the Supabase size and type limits), and the real RLS evaluation by PostgREST. After completing the setup above, walk through: sign up, receive and click the email, finish onboarding, sign out and in, reset the password. Run `npx supabase db advisors` (or the dashboard's Security Advisor) as well.

## Deploying

Vercel-compatible. Set the three env vars from `.env.example` in the project settings, set `NEXT_PUBLIC_SITE_URL` to the production URL, and add that URL's `/auth/callback` to Supabase's Redirect URLs.
