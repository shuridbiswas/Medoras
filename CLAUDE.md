# Medyra

**Connect. Learn. Grow. Belong.** | _More than a career. A community that cares._

Medyra is a professional and social network exclusively for the healthcare and social services ecosystem: students, recent graduates, professionals, educators, researchers, mentors, employers and organizations. This is a long-term startup product, not a demo.

## Product vision

Combines LinkedIn-style professional identity, Reddit-style communities and forums, student-to-professional mentorship, research and knowledge sharing, careers and internships, personal stories, local communities, and peer emotional support. Core belief: no one should navigate their education, career or personal challenges alone.

Audience: nursing, medicine, psychology, social work, pharmacy, physiotherapy, occupational therapy, speech-language pathology, audiology, public health and related disciplines, at every career stage.

### Product principles

- Trust first: verified professionals and employers, clear moderation, zero tolerance for harassment.
- Privacy by design: anonymous options, optional and coarse location, patient-confidentiality rules (de-identified cases only).
- Honest limits: community advice does not replace professional care; peer support is not therapy or crisis intervention; AI moderation is not guaranteed to catch everything. Say so in the UI.
- Success should inspire, not breed competition.

### Brand and design

Credible, modern, welcoming and elegant; professional without being cold. White and rose-tinted neutrals with a maroon primary (`maroon-50..900` tokens). Plus Jakarta Sans (headings) + Inter (body). Product-style UI cards (profile, strength ring, goals) in the manner of the reference mock. Avoid generic SaaS-landing aesthetics, heavy gradients, glassmorphism, large emojis, stock medical imagery, and copying any existing network's look. Illustrative UI must be labelled as illustrative, never presented as live activity.

## Stack

Next.js (App Router) 16, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui (base-nova style, Base UI primitives), Lucide icons, Supabase (auth, Postgres, storage) via @supabase/ssr, zod, Vitest + Testing Library + PGlite, ESLint. Vercel-compatible.

Note: this Next.js version has breaking changes. `AGENTS.md` points at the bundled docs in `node_modules/next/dist/docs/`; read the relevant guide before using an unfamiliar API. Known gotchas: `new Date()` in a prerendered component fails the build; `searchParams` is a Promise; use the global `LayoutProps<"/">` helper types.

## Architecture

```
src/
  app/                 Routes only: layouts, pages, metadata, SEO files
  components/
    ui/                shadcn primitives (do not hand-edit casually)
    layout/            Header, footer, mobile nav, page shell, section primitives
    brand/             Logo and wordmark
  features/<name>/     Feature-oriented code (landing now; auth, profiles, mentorship, etc. later)
  lib/
    site.ts            Site config, navigation and footer links
    supabase/          Browser, server and proxy Supabase clients, env, session-cookie policy
    auth/              Data access layer (requireUser...) and safe redirects
    utils.ts           cn()
```

Conventions:

- Server Components by default; add `"use client"` only for interaction (e.g. `mobile-nav.tsx`).
- Design tokens live in `src/app/globals.css` (`--ink`, `--canvas`, `--surface`, `--sand`, `--clay`, `--maroon-50..900`, mapped to shadcn variables). Use token classes (`text-maroon-900`, `bg-sand`), not raw hex, in components.
- shadcn components here use Base UI: compose links with `render={<Link href="..." />}`, not `asChild`.
- Keep copy and structured content in `features/<name>/content.ts`, not buried in JSX.
- Accessibility is a requirement: semantic landmarks, labelled sections, visible focus, 4.5:1 contrast, reduced-motion support.

## Coding standards

- TypeScript strict; no `any`. Prefer small readable components over speculative abstractions.
- Never invent credentials. Secrets only via `.env.local` (see `.env.example`); never commit real values.
- Before finishing work: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Current scope: Phases 1 to 4 (done)

Phase 1: public welcome page at `/` and informative placeholders (`/about`, `/community-guidelines`, `/privacy`, `/terms`, `/contact`; the legal pages are placeholders, not real policies).

Phase 2: Supabase email/password auth and onboarding. Routes `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/onboarding`, and the protected `/home` (the community feed, Phase 4).

Auth architecture (see README for setup and verification status):

- `src/proxy.ts` (Next 16's replacement for middleware) refreshes the session and redirects; it is not the only gate. Every private page/action calls `requireUser` / `requireMember` / `requireOnboardingPending` from `src/lib/auth/session.ts`.
- `src/lib/supabase/{client,server,proxy}.ts` are the only places that create Supabase clients. Only the publishable key is ever used; never add the secret/service_role key to the app.
- Server actions in `src/features/*/actions.ts` validate all input with zod (`schemas.ts`) before touching Supabase. Redirect targets go through `safeNextPath`.
- Pages that read cookies or `searchParams` render their dynamic part inside `<Suspense>` (Cache Components requirement).
- Database: `supabase/migrations/`. `profiles` holds only member-visible fields; private answers live in `onboarding_preferences`; email never leaves `auth.users`. Option lists in `src/features/onboarding/options.ts` must match the SQL CHECK constraints. `supabase/tests/rls.test.ts` runs the migrations in PGlite; update it when policies change.
- Keep the test mocks in `src/test/mocks.ts` in sync when changing Supabase calls. Untested against a live project until the README setup is done.

Phase 3: professional profiles. Routes `/profile/[username]` (tabs: Overview, Education, Experience, Skills & interests, Activity placeholder), `/profile/edit` (owner only), `/settings` (account, change password, privacy summary). `/home` and every signed-in page use `AppHeader`.

Profile architecture:

- Code lives in `src/features/profile/`: `schemas.ts` (zod), `actions.ts` (server actions), `queries.ts` (read), `visibility.ts`, `format.ts`, `components/` (view) and `components/edit/` (forms).
- **Public vs private:** every `profiles` column and every row of `profile_education`, `profile_experience` and `profile_skills` is readable by any signed-in member once the owner finishes onboarding. Private data goes in owner-only tables (`onboarding_preferences`, a future `profile_settings`), never `profiles`. Email exists only in `auth.users`; `/settings` reads it from the session.
- `toPublicProfile()` in `visibility.ts` is the whitelist that shapes what reaches the UI. A new `profiles` column stays hidden until added there, and future per-field privacy settings plug in at that one spot.
- Location: `profiles.location_label` is a free-text general place the member chooses (city or region, max 80, optional); the UI shows it plus the country. No coordinates or addresses are ever stored. The onboarding `city` stays private.
- Skills, interests and mentorship areas share `profile_skills` (`kind`). Mentorship flags are self-reported; the UI says so. Do not add verification badges or credentials claims until a real verification process exists.
- Every profile action starts with `requireMember()`, scopes writes to the verified user id (never an id from the form) and relies on RLS as the second layer. Images are checked by real file bytes and size (photo 2 MB, cover 5 MB) and stored under `<user id>/<uuid>.<ext>` in the `avatars` / `covers` buckets.
- Reserved usernames (`edit`, `profile`, `settings`, ...) are enforced in the DB constraint and `RESERVED_USERNAMES`; keep both in sync when adding top-level routes.
- Tests: `supabase/tests/rls.test.ts` (migrations in PGlite), `src/features/profile/*.test.*`, `src/test/{mocks,db-mock}.ts` (recording Supabase doubles).

Phase 4: member home and community feed. `/home` is a three-column app page (left: profile card + navigation; center: greeting, composer, category filters, feed; right: new members, fields to explore, active categories, self-reported mentors, planned features). Also `/search` (member search by name/username, field, or open-to-mentor) and informational placeholders `/communities`, `/mentorship`, `/careers`, `/saved`. The profile Activity tab lists the member's real posts.

Feed architecture:

- Code lives in `src/features/feed/`: `options.ts` (7 categories, limits), `schemas.ts` (zod, cursor pattern), `queries.ts` (reads), `actions.ts` (server actions), `types.ts`, `components/`. Home rails and nav config are in `src/features/home/`. Shared pieces: `components/layout/{app-header,user-menu,mobile-tab-bar}.tsx`, `components/member-avatar.tsx`, `components/relative-time.tsx`.
- Tables: `posts`, `post_likes` (primary key post+user), `post_comments` (migration `20261030000001`). Categories and length limits are CHECK constraints; keep `POST_CATEGORIES` in sync with `posts_category_valid`.
- **Ownership:** every action starts with `requireMember()`. Author ids come only from the verified session, never from a form or argument, and edits/deletes add `.eq("author_id", user.id)`. RLS enforces it again (insert needs `author_id = auth.uid()`; update/delete only own rows; no UPDATE grant on comments or likes; column grants stop changing author or timestamps). Zero affected rows is reported as an error, never as success.
- **Counts** are computed from rows (`post_likes(count)` embeds), never stored, so they cannot drift. Like/unlike is idempotent; the client updates optimistically and rolls back on failure, then shows the server's count.
- **Pagination** is keyset (`created_at desc, id desc`) with an opaque cursor `"<created_at>|<id>"`, validated by `CURSOR_PATTERN` before it is put in a PostgREST filter. The server renders page one; `FeedList` (client) loads older pages through `loadMorePosts`. `FeedSection` re-keys the list whenever page one changes so extra pages never go stale.
- Forms that can fail (composer, post edit) use **controlled** fields because React 19 resets uncontrolled forms after every submit, which would discard a member's text on error.
- DB abuse guards: 20 posts and 60 comments per author per rolling hour (trigger `private.enforce_feed_rate_limit`). These are spam limits, not moderation.
- Safety copy lives in `SafetyNotice` and `/community-guidelines`: no identifiable patient information, member posts are not medical advice, and verification and automated moderation are NOT active. Keep these statements true and update them when that changes. Reporting and blocking are not built.
- Right-rail data is real or empty: no fabricated members or engagement. Development test data comes only from `scripts/seed/` (`npm run seed:dev|seed:clean|seed:verify`): fictional members created through the Auth API, locked to the project in `SEED_ALLOWED_PROJECT_REF`, never run against production, passwords only in git-ignored `scripts/.seed-output/accounts.json`. Change `scripts/seed/plan.ts` / `content.ts` and keep `validatePlan` in sync with the database constraints.
- Tests: `supabase/tests/feed.test.ts` (policies in PGlite), `src/features/feed/{actions,queries,feed}.test.*`, `components/feed-components.test.tsx`, `src/components/layout/layout.test.tsx`.

Development environment: the repo is wired to a Supabase development project (`medyra-dev`) through git-ignored `.env.local`. Migrations were applied through the Management API and recorded in `supabase_migrations.schema_migrations`, so `supabase db push` will not re-run them. New migrations go in `supabase/migrations/` with a later timestamp; never edit an applied migration. Manual test procedure: `TESTING.md`. Email confirmation is OFF in the dev project only (dev convenience); `signUp` handles both cases (a returned session continues to `/onboarding`). Never put a secret or service_role key in the app or in chat.

The product was renamed from Medoras to Medyra. The wordmark, copy, cookie (`medyra-session-only`) and package name use Medyra; `medoras` stays a reserved username so nobody can impersonate the old name.

Out of scope until later phases: connections, communities, mentorship matching, forums, messaging, jobs, reporting/blocking/moderation tooling, saved posts, post media, AI features, per-field privacy settings, username changes.

## Infrastructure (Netlify, Sentry, Upstash, Resend, ProductBridge, Pinecone)

Read ARCHITECTURE.md for decisions and risks. Conventions:

- **Auth stays Supabase Auth.** Do not add Auth.js or a second session system without the documented migration plan and the owner's approval (ARCHITECTURE.md section 4).
- **Every external service is optional and fail-soft.** Missing variables turn the feature off; a service outage must never block sign-up, onboarding, reading the feed, or saving a post. `src/lib/services.ts` + `GET /api/health` report presence (booleans only).
- **Secrets:** server-only variables are never `NEXT_PUBLIC_`; never log or return them; `.env.example` is the one list of names. Never add the Supabase secret/service_role key.
- **Rate limits** (`src/lib/rate-limit.ts`, Upstash, per verified member id, fail-open) back the database's hard hourly limits. Add a policy there and call `checkRateLimit` at the top of any new write action.
- **Cache** (`src/lib/cache.ts`) is only for public, member-independent aggregates with a short TTL. Never cache per-member data, content or tokens.
- **Errors:** report unexpected server failures with `reportError(operation, error)` (operation name and DB error code only, never member content). Sentry events pass through `scrubEvent`; Session Replay stays off.
- **Email:** `sendToMember` (src/lib/email/send.ts) emails only the verified signed-in member. Auth emails belong to Supabase (via Resend SMTP); do not send them from app code.
- **ProductBridge** gets no member data (links only). **Pinecone** embeds structured profile tags only, never free text; always re-check results against PostgreSQL RLS (`searchProfileIds`).
- **Netlify:** `netlify.toml` + the official adapter; no static export. `NEXT_PUBLIC_APP_ENV` labels the deploy context. Previews use the dev Supabase project, never production.
- Supabase client creation calls `connection()` so Cache Components never prerenders time-dependent auth work.

## Roadmap

1. **Phase 2 (done):** Supabase auth, onboarding, profile basics, RLS from day one.
2. **Phase 3 (done):** Professional profiles.
3. **Phase 4 (done):** Member home page and community feed (posts, likes, comments, categories, search).
4. **Phase 4b:** Connections, communities, reporting and blocking, saved posts.
5. **Phase 5:** Mentorship matching, forums (anonymous option), verification badges.
6. **Phase 6:** Careers and employer profiles, articles/research, stories.
7. **Phase 7:** Nearby communities and events, mental-health and peer-support space with human + AI-assisted moderation, reporting/blocking/muting.

Open product questions: professional verification method, anonymity vs. safety design, launch regions (privacy law and crisis resources), handling of minors, MVP cut line.
