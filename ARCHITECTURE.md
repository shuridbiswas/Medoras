# Medyra architecture

Status of this document: written from an audit of the code on the `dev` branch. Statements about external services say whether they were **tested** or only **configured for later**. Where something is unverified, it says so.

## 1. Audit summary (what existed before this infrastructure work)

| Question | Finding |
| --- | --- |
| Next.js / React | Next.js 16.4.3 (App Router, Cache Components, Partial Prefetching, `proxy.ts`), React 19.3, TypeScript strict, Tailwind v4, shadcn/ui (Base UI) |
| Node.js | Developed on Node 24. `engines.node >= 20.19.0` and `.nvmrc` = 22 (Next 16 and the Sentry SDK need 20.19+) |
| Authentication | **Supabase Auth** (email + password, email verification, password reset) through `@supabase/ssr`. Working and tested against the development project. **Auth.js is not installed.** |
| Supabase | Development project `medyra-dev` connected. 9 tables (below), row level security everywhere, 2 storage buckets |
| Schema | `profiles`, `onboarding_preferences`, `profile_education`, `profile_experience`, `profile_skills`, `posts`, `post_likes`, `post_comments`, `notification_preferences`. Migrations in `supabase/migrations/` (5 files) |
| Accounts and profiles | Real. `profiles.id` references `auth.users(id)`; a trigger creates the profile on sign-up |
| Home feed | Real PostgreSQL data (no mock data). Posts, likes, comments, keyset pagination, owner-only edits |
| Deployment config | None existed. Added `netlify.toml`, `.nvmrc`, security headers (`next.config.ts`) |
| Requested services already connected | Supabase only. Netlify, Cloudflare, Resend, ProductBridge, Sentry, Upstash and Pinecone were not |

## 2. Technology decisions

| Concern | Choice | Status |
| --- | --- | --- |
| Frontend | Next.js App Router, TypeScript, Tailwind, shadcn/ui | In place |
| Hosting | Netlify (official OpenNext adapter, zero config) | Config written; **not yet deployed or tested on Netlify** |
| Registrar | Netlify | Needs your check (see DNS_SETUP.md) |
| DNS | Cloudflare | Documented only |
| Authentication | **Supabase Auth (kept).** Auth.js: not adopted, decision below | Blocked on an approval decision |
| Database | Supabase PostgreSQL | In place, tested on the dev project |
| File storage | Supabase Storage (`avatars`, `covers`) | In place, tested on the dev project |
| Email | Resend (SMTP for Supabase Auth mail; SDK for app mail) | App code tested with mocks; **awaiting credentials** |
| Feedback | ProductBridge via documented direct URLs | Implemented; awaiting your organization id |
| Monitoring | Sentry (`@sentry/nextjs` 11) | Implemented; awaiting DSN |
| Rate limiting and cache | Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`) | Implemented; awaiting credentials |
| Vector search | Pinecone | Foundation only, disabled, not wired into any feature |

No requested service was replaced by an alternative.

## 3. System architecture

```
Browser ──HTTPS──> Cloudflare DNS (DNS-only at first) ──> Netlify
                                                           ├─ Static assets / CDN
                                                           ├─ proxy.ts  (session refresh, route guards)
                                                           ├─ Server Components + Server Actions + Route Handlers (Netlify Functions)
                                                           │     ├─ Supabase (Auth, PostgreSQL + RLS, Storage)  <- source of truth
                                                           │     ├─ Upstash Redis   (rate limits, 60 s shared cache)  fail-open
                                                           │     ├─ Resend          (welcome + security email)         fail-soft
                                                           │     ├─ Sentry          (errors, scrubbed)                  optional
                                                           │     └─ Pinecone        (disabled; future)                  optional
                                                           └─ Browser also talks to Supabase Storage (public image URLs) and Sentry (errors)
Supabase Auth ──SMTP──> Resend ──> member inbox      (sign-up confirmation, password reset)
Member ──link──> ProductBridge portal (feedback, roadmap, changelog; no Medyra data sent)
```

Every service except Supabase is optional. `GET /api/health` reports which are configured (presence only, never values).

## 4. Authentication architecture

**Current and recommended: Supabase Auth only.**

- Sessions are Supabase cookies managed by `@supabase/ssr`. `src/proxy.ts` refreshes the session; every private page and Server Action re-checks with `requireMember()` (calls `auth.getUser()`).
- The identity is `auth.users.id`. `profiles.id` is that same UUID (foreign key, cascade delete). Row level security uses `auth.uid()`, so the database itself enforces ownership.
- Email addresses exist only in `auth.users`. Public tables never contain them (a test enforces this).

**Why Auth.js was not switched in (documented decision, needs your approval to change):**

Auth.js and Supabase Auth are separate identity systems. The Auth.js Supabase adapter only stores Auth.js users in a Postgres schema; it does **not** make Supabase treat them as authenticated, so `auth.uid()` would be empty and every RLS policy would deny access. Moving to Auth.js would mean:

1. Choosing one issuer of identity. Running both creates duplicate users and two session systems.
2. Giving Supabase a JWT it trusts for each Auth.js session (a custom token signed with the project's JWT secret, `sub` = the Auth.js user id), or abandoning RLS and enforcing everything in server code. The first needs the Supabase JWT secret on the server; the second removes the database-level protection Medyra relies on today.
3. Re-pointing `profiles.id` (currently `references auth.users`) to the Auth.js user table, re-writing the sign-up trigger, and migrating every existing account (password hashes cannot be moved between the two systems without a forced reset).
4. Rebuilding email verification, password reset and session handling.

None of that is needed for any feature requested so far, and it would add risk. **Recommendation: keep Supabase Auth.** If you still want Auth.js (for example for a provider Supabase lacks), the next step is a written migration plan: dual-run window, user-id mapping table, forced password reset, RLS via signed JWT, rollback. Nothing will be switched without that plan and your sign-off.

## 5. Data ownership

| Data | Owner / system of record | Notes |
| --- | --- | --- |
| Accounts, email, password hashes | Supabase Auth (`auth.users`) | Never copied to public tables, logs, Sentry or Pinecone |
| Profiles, education, experience, skills | PostgreSQL (`public.*`) | Visible to signed-in onboarded members by RLS |
| Posts, likes, comments | PostgreSQL | Owner-only edit/delete by RLS; counts computed from rows |
| Private onboarding answers, notification preferences | PostgreSQL, owner-only RLS | |
| Images | Supabase Storage | Public by unguessable URL; own-folder write policies |
| Rate-limit counters, 60 s cache | Upstash Redis | Ephemeral, always has a TTL, never the only copy of anything, never member-specific cached content |
| Vector embeddings | Pinecone | Derived from structured profile tags only; PostgreSQL stays the truth; deleted with the profile |
| Error reports | Sentry | Scrubbed: no bodies, cookies, auth headers, query strings, email or IP |
| Outbound email content | Resend | Transient; only to the member's own address |
| Product feedback | ProductBridge | Entered by members on ProductBridge; Medyra sends it nothing |

## 6. Environment variables

The full, commented list is in `.env.example`. Summary:

- **Public** (`NEXT_PUBLIC_*`): site URL, app environment label, Supabase URL and publishable key, Sentry DSN, ProductBridge organization id.
- **Server-only secrets**: `RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `PINECONE_API_KEY`, `PINECONE_INDEX`, `PINECONE_EMBEDDING_MODEL`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_TEST_TOKEN`.
- Application-specific variables I introduced: `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID`, `EMAIL_FROM`, `PINECONE_EMBEDDING_MODEL`, `SENTRY_TEST_TOKEN`. The rest use each provider's official names.
- The Supabase secret / service_role key is deliberately **not used anywhere**.

## 7. Deployment architecture

- Git-based: GitHub repo `shuridbiswas/Medyra`. Production branch `main`; every pull request and the `dev` branch get Netlify Deploy Previews.
- Build: `npm run build` on Node 22. Netlify applies its Next.js adapter automatically. No static export.
- **Environment separation:** production uses its own Supabase project (create `medyra-prod`; do not reuse `medyra-dev`), its own Upstash database, Sentry environment `production`, and email confirmation ON. Previews may use the **development** Supabase project only, never production data.
- Security headers (`next.config.ts`): nosniff, frame deny, referrer policy, permissions policy, HSTS. No CSP yet (see risks).
- Details and steps: `DEPLOYMENT.md`, `DNS_SETUP.md`, `EMAIL_SETUP.md`.

## 8. Service integration notes

**Netlify.** Official OpenNext adapter: App Router, Server Components, Server Actions and Route Handlers are supported. Netlify's docs list Next.js 13.5+ and Cache Components; they do not name Next 16 or `proxy.ts`, so the first preview deploy must be checked (DEPLOYMENT.md checklist).

**Resend.** `src/lib/email/`. `sendToMember(member, message, category)` only emails the verified member passed in; it validates the address and payload, rate-limits (5/hour/member), honors `notification_preferences` for activity mail, and never throws. Sent today: welcome (after onboarding) and a password-changed security notice. Comment/connection templates exist but are not sent because those features do not exist. Auth emails come from Supabase via Resend SMTP, so only one system sends them.

**ProductBridge.** `/feedback` links to the documented direct URLs `https://app.productbridge.io/widget/<org id>?tab=feedback|roadmap|changelog`. No script, no identification, no API calls: nothing about the member is sent. Safety reporting is explained separately (reporting tools are not built).

**Sentry.** Server (`instrumentation.ts`, `onRequestError`), browser (`instrumentation-client.ts`), `global-error.tsx`, and explicit reports for failed database writes (`reportError`, operation name and DB error code only). Session Replay and the feedback widget are off on purpose. Sampling: 10% traces in production, 100% elsewhere. `beforeSend` scrubs events. Source maps upload only when `SENTRY_AUTH_TOKEN` is set at build time.

**Upstash Redis.** `src/lib/rate-limit.ts` (sliding window per member id: posts 10/10 min, comments 20/10 min, likes 120/min, search 30/min, load-more 120/min, email 5/h) and `src/lib/cache.ts` (60 s shared cache of public category counts). **Fail-open**: if Redis is missing or down, requests are allowed and the database still enforces hard hourly limits on posts and comments. Not yet rate-limited by IP: sign-in, sign-up and password reset (Supabase applies its own limits); add IP-based limits if abuse appears.

**Pinecone.** `src/lib/pinecone/` (disabled unless `PINECONE_API_KEY` and `PINECONE_INDEX` are set; nothing calls it yet).

- *Embedding model:* `multilingual-e5-large` (Pinecone Inference), 1024 dimensions, cosine metric. Create the index with those settings. Changing the model means re-embedding everything.
- *Namespaces:* `profiles` only for now.
- *What is embedded:* headline, specialty, field labels, career stage and chosen skill/interest/mentorship tags. Not bio, journey, aspirations, posts, comments, messages, names, email, location or anything clinical. Posts are excluded until moderation and a disclosure policy exist.
- *IDs:* `profile:<postgres uuid>`; metadata carries the same id and `visibility: "members"`.
- *Sync plan:* upsert after onboarding completes and after tag edits; delete when a profile is removed. Not wired yet; add via a queue or `after()` hook so a Pinecone outage can never block a save. A nightly reconciliation job should compare PostgreSQL to Pinecone.
- *Permissions at retrieval:* results are IDs only, then re-checked against PostgreSQL under the viewer's RLS (`searchProfileIds`), so a stale vector can never reveal a profile.

## 9. Risks and future considerations

1. **`proxy.ts` on Netlify is unverified.** Netlify documents Middleware; Next 16 renamed it to `proxy.ts`. If it does not run, pages still enforce `requireMember()` server-side (so data stays protected), but session refresh and redirects at the edge would not. Verify on the first preview; fallback is to ask Netlify support or keep a thin `middleware.ts` alias if the adapter requires it.
2. **No Content Security Policy.** Add one in Report-Only mode first (needs Supabase, Sentry and image hosts allowed), then enforce.
3. **Supabase email confirmation is OFF in `medyra-dev`** for testing. It must be ON in production, with Resend SMTP.
4. **Previews must never point at production data.** Use dev Supabase for previews, and block production keys from the preview context in Netlify.
5. **Free-tier limits** (Supabase pausing inactive projects, built-in mailer 2 emails/hour, Resend/Upstash/Sentry quotas) are fine for testing, not for launch.
6. **Moderation is not active.** No identity verification, no AI or human moderation, no reporting/blocking. Safety copy says so; keep it accurate. Do not send posts to any AI or vector service before a disclosure policy exists.
7. **Rate limits fail open.** Good for availability, but a Redis outage reduces abuse protection (database limits remain).
8. **Legal:** privacy policy and terms are placeholders. Healthcare-adjacent data, Canadian privacy law (PIPEDA, Quebec Law 25), data residency (dev project is in Canada Central) and minors need review before launch.
9. **Secrets hygiene:** a Supabase personal access token was shared in chat earlier; revoke it. Never share keys in chat or commit them.
