# Medoras

**Connect. Learn. Grow. Belong.** | _More than a career. A community that cares._

Medoras is a professional and social network exclusively for the healthcare and social services ecosystem: students, recent graduates, professionals, educators, researchers, mentors, employers and organizations. This is a long-term startup product, not a demo.

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

## Current scope: Phases 1 to 3 (done)

Phase 1: public welcome page at `/` and informative placeholders (`/about`, `/community-guidelines`, `/privacy`, `/terms`, `/contact`; the legal pages are placeholders, not real policies).

Phase 2: Supabase email/password auth and onboarding. Routes `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/onboarding`, and a minimal protected `/home` (no feed yet).

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

Out of scope until later phases: feed (the Activity tab is a placeholder), connections, communities, mentorship matching, forums, messaging, jobs, AI features, per-field privacy settings, username changes.

## Roadmap

1. **Phase 2 (done):** Supabase auth, onboarding, profile basics, RLS from day one.
2. **Phase 3 (done):** Professional profiles.
3. **Phase 3b:** Connections, communities, home feed.
4. **Phase 4:** Mentorship matching, forums (anonymous option), verification badges.
5. **Phase 5:** Careers and employer profiles, articles/research, stories.
6. **Phase 6:** Nearby communities and events, mental-health and peer-support space with human + AI-assisted moderation, reporting/blocking/muting.

Open product questions: professional verification method, anonymity vs. safety design, launch regions (privacy law and crisis resources), handling of minors, MVP cut line.
