# Deploying Medyra to Netlify

Nothing here has been deployed yet. Do not point a production domain at the site until you have approved a preview deployment and run the checklist in section 5.

Netlify's official Next.js support (the OpenNext adapter, `@netlify/plugin-nextjs`) is applied automatically, with no plugin entry needed. It supports the App Router, Server Components, Server Actions, Route Handlers and Cache Components. Medyra is **not** a static export and must stay that way. Source: [Netlify Next.js overview](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

## 1. Connect GitHub to Netlify

1. Netlify dashboard > **Add new project** > **Import an existing project** > **GitHub**. Authorize Netlify for the `shuridbiswas/Medyra` repository only.
2. Production branch: `main`. (The `dev` branch and pull requests become previews.)
3. Build settings (Netlify reads them from `netlify.toml`, so just confirm):
   - Build command: `npm run build`
   - Publish directory: leave empty (the adapter manages it)
   - Node version: 22 (from `netlify.toml` / `.nvmrc`)
4. Add environment variables (section 2) **before** the first deploy.
5. **Site configuration > Build & deploy > Branches and deploy contexts**: enable Deploy Previews for pull requests, and branch deploys for `dev`.

## 2. Environment variables

Set these in **Site configuration > Environment variables**, choosing the scope per variable. `.env.example` documents every name. Never put secrets in `netlify.toml`.

| Variable | Production | Deploy previews / `dev` branch |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **production** Supabase project | dev project (`medyra-dev`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | production publishable key | dev publishable key |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.example` | the preview URL, or leave unset |
| `NEXT_PUBLIC_APP_ENV` | set by `netlify.toml` (`production`) | set by `netlify.toml` (`preview`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | production key, verified domain | a separate test key, or leave unset |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | production database | a separate database, or unset |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN | same DSN (environment label separates them) |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | **Builds** scope only | optional |
| `NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID` | ProductBridge organization id | same |
| `PINECONE_*` | leave unset until semantic search ships | unset |
| `SENTRY_TEST_TOKEN` | **unset** (set temporarily for the Sentry test) | optional |

Rules:

- Mark secrets as **secret** values in Netlify; `NEXT_PUBLIC_*` values are visible in the browser bundle by design.
- Previews must **never** receive production Supabase keys. Scope production-only variables to the *Production* context.
- Changing a `NEXT_PUBLIC_*` variable requires a new build (it is compiled in).

## 3. Supabase settings for each environment

In each Supabase project (Authentication > URL Configuration):

- Site URL: that environment's URL.
- Redirect URLs: add `<url>/auth/callback` (and `<url>/**` for previews if you test auth there; Netlify preview URLs vary, so you may use a wildcard such as `https://*--your-site.netlify.app/**`).
- Production only: **Confirm email ON**, minimum password length 10, custom SMTP via Resend (EMAIL_SETUP.md).
- Apply the same migrations (`supabase/migrations/*`) to production before first use. Use `npx supabase db push` against the linked production project, or the SQL editor, in order.

## 4. Preview deployment workflow

1. Push a branch or open a pull request against `main`. Netlify builds a Deploy Preview and comments the URL.
2. Run the checklist (section 5) on the preview.
3. Merge only when lint, type check, tests and the preview all pass.

## 5. First-preview checklist (not yet done)

Run these on the first Netlify preview, because they depend on Netlify behavior I could not test locally:

1. `GET /api/health` returns `{"status":"ok",...}` and the service flags you expect.
2. `/` loads with the Medyra wordmark and the page title "Medyra".
3. Visit `/` signed out: you are **redirected to `/welcome`**, and `/settings` signed out redirects to `/login?next=%2Fsettings`. (This confirms `proxy.ts` runs on Netlify. If you land on an error, an empty page or the member home instead, see Troubleshooting.) Then `/home` should redirect to `/`.
4. Sign up with a test account, finish onboarding, create a post, like and comment from a second account.
5. Reload and sign out/in: the data persists.
6. Check response headers on `/` (browser DevTools > Network): `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
7. Trigger the Sentry test (TESTING.md) and confirm the event appears in Sentry with environment `preview`.

## 6. Production deployment workflow

1. Create the production Supabase project, apply migrations, configure Auth (section 3), and add production env vars scoped to *Production*.
2. Merge to `main`. Netlify builds and publishes automatically.
3. Do **not** attach the production domain until the `*.netlify.app` production URL passes the checklist.
4. Then follow DNS_SETUP.md, wait for HTTPS, and re-run the checklist on the real domain.

Explicit approval step: **I will not deploy to a production domain or connect DNS without your written go-ahead.**

## 7. Rollback

- **Instant rollback:** Netlify > **Deploys** > open a previous successful deploy > **Publish deploy**. This repoints production to that build without rebuilding. Automatic publishing then pauses; click **Start auto publishing** on the newest deploy when ready.
- **Code rollback:** `git revert <commit>` on `main` and push; Netlify builds the revert.
- **Database rollback:** migrations are forward-only. Write a new migration to undo a change. Never edit an applied migration. Take a Supabase backup (or use point-in-time recovery on a paid plan) before risky migrations.

## 8. Custom domain

See DNS_SETUP.md. In short: add the domain in **Domain management**, create the DNS records at Cloudflare in **DNS only** mode, wait for Netlify to issue the HTTPS certificate, then update `NEXT_PUBLIC_SITE_URL`, Supabase URLs and the Resend sender.

## 9. Troubleshooting

| Symptom | Likely cause and fix |
| --- | --- |
| Build fails with "Node version" errors | Node must be 20.19+. Confirm `NODE_VERSION = "22"` in `netlify.toml` and clear cache and retry |
| Build fails on `SENTRY_AUTH_TOKEN` / source maps | The token is optional. Remove it, or fix the org/project slugs. The build should still pass without it |
| `/` or `/settings` shows an error or loads when signed out | `proxy.ts` may not be running on Netlify. Pages still block signed-out users server-side. Check the function logs, then Netlify's OpenNext docs and support for Next 16 `proxy.ts`. Verify the matcher |
| Login loops or "auth not configured" | Missing `NEXT_PUBLIC_SUPABASE_*` variables in that context, or the Site/Redirect URL in Supabase doesn't include this origin |
| Confirmation email links go to localhost | `NEXT_PUBLIC_SITE_URL` or the Supabase Site URL is still `http://localhost:3000` |
| Emails not arriving | See EMAIL_SETUP.md. Check `/api/health` shows `resend: true`, the sender domain is verified, and Supabase SMTP is saved |
| Posts fail with "too quickly" | Database hourly limit (20 posts, 60 comments) or Redis limit. Wait, or use another account |
| Images don't load | Check the Storage bucket exists in that Supabase project and `NEXT_PUBLIC_SUPABASE_URL` points to it |
| Environment variable change has no effect | `NEXT_PUBLIC_*` values are baked at build time. Trigger a new deploy |
| Preview shows production-looking data | Wrong Supabase project in the preview scope. Fix the scoping immediately |

## Phase 4A: security, safety and privacy rollout

Read `PRODUCTION_READINESS.md` first: it lists what was verified live and the exact remaining blockers.

Order matters. Do not deploy the code before the migrations exist.

1. **Revoke** any Supabase personal access token that was ever pasted into chat or a file. Create a new one scoped to the project, or use the SQL editor.
2. **Apply the migrations** `20261102000001_safety_and_moderation.sql` and `20261102000002_account_security_and_privacy.sql` (in that order, after the earlier ones). Run the Supabase Security and Performance advisors afterwards.
3. In the Supabase dashboard enable **Authentication > Multi-Factor > TOTP**. Without it, setup fails with a clear message and, if `MFA_ENFORCEMENT=required`, nobody can pass the setup page. Keep `MFA_ENFORCEMENT=challenge` as the emergency switch.
4. Make the first administrator (after they have an account). Administrators are created only in SQL, never in the app:
   ```sql
   insert into public.staff_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.org';
   ```
   They then open `/admin` directly (there is deliberately no link), and must have set up an authenticator.
5. In Netlify set `MFA_ENFORCEMENT` (see `.env.example`; unset means `required`) and, when a mailbox exists, `PRIVACY_CONTACT_EMAIL`. With `required`, every existing member is sent to authenticator setup on their next visit; they are never locked out of the setup page or of signing out.
6. Deploy, then run the live checklist in `PRODUCTION_READINESS.md` section 2.

Scheduled work that nothing runs yet (see `OBSERVABILITY.md`): `select private.run_retention_purge();` and carrying out due deletion requests from `/admin`.
