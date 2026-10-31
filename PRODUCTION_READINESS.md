# Production readiness report (Phase 4A)

Date: 2 November 2026. Branch: `dev`. Baseline named in the brief: `66a258d`; the work actually started from `fe579bf` (Phase 4b, already on `dev`).

This report says what was **verified**, how, and what was **not**. Nothing below is claimed as passed unless it was run.

## 1. Audit

| Check | Result |
| --- | --- |
| Git state | `dev` is ahead of `origin/dev` by the Phase 4A commits. `.env*` and `scripts/.seed-output/` are git-ignored. No Supabase personal access token (`sbp_…`) or other secret appears in any tracked file (searched). |
| Existing tests | The 381 tests named in the brief, plus everything added since (Phase 4, 4b, the seed tool) all still pass. See section 5 for current totals. |
| RLS | Reviewed every migration. Every table in `public` has RLS enabled and the `anon` role has no grants. New policies are covered by 148 in-memory Postgres tests. Re-verification against the live project is **pending** (section 4). |
| Placeholder pages | `/privacy` and `/terms` were "coming soon" placeholders and are now full drafts (marked as needing legal review). `/community-guidelines` was updated to describe the real tools. `/settings` gained Security and Privacy sections. |
| `npm audit` | 0 vulnerabilities in production dependencies. 3 low findings remain, all in the `shadcn` CLI (now a devDependency). |
| Search indexes | The `fields` array filter in the directory now has a GIN index. Name and institution search use `ilike '%term%'`, which a normal index cannot serve; at today's size a sequential scan is fine. Before thousands of members, add the `pg_trgm` extension and GIN trigram indexes on `first_name`, `last_name`, `username` and `institution` (not done here: it needs the extension enabled on the project). |
| Logging | There are no `console.*` calls in `src/`. Sentry events go through `scrubEvent` (no cookies, bodies, query strings, secrets; member ids only). Server error reports carry an operation name and database error code only. A test asserts that the data export and the audit log never contain content text or secrets. |

## 2. Live deployment verification (Netlify, `https://medyraapp.netlify.app`)

Checked from this machine with `curl` on 2 November 2026. These are results of real requests, not assumptions.

| Expectation | Observed |
| --- | --- |
| Signed-out `/` goes to `/welcome` | `307` to `/welcome`. **Pass.** `proxy.ts` runs on Netlify. |
| `/welcome` loads | `200`. **Pass.** |
| `/home` goes to `/` | `307` to `/`. **Pass.** |
| Signed-out `/settings` goes to login | `307` to `/login?next=%2Fsettings`. **Pass.** |
| Other private routes | `/network`, `/settings/security`, `/settings/privacy`, and `POST /settings/privacy/export` all `307` to `/login?next=…`. **Pass.** |
| `/api/health` | `200`, `{"status":"ok","environment":"production","services":{"supabase":true,"sentry":false,"upstashRedis":false,"resend":false,"productbridge":false,"pinecone":false}}`. **Pass**: Supabase is configured, every optional service is off, only booleans are returned. |
| `/api/sentry-test` | `404` (no token configured). **Pass.** |
| Security headers | `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` present. **No `Content-Security-Policy`** (a blocker below). |

**The deployed site is running code from before Phase 4A.** `/admin`, `/mfa/verify` and `/suspended` correctly return `404` there because those routes do not exist in that build. Nothing in Phase 4A has been deployed or pushed.

### Tests that need live access and were **not** run

These need a signed-in browser session, a real inbox (email delivery configured), or a project with the new migrations. They are not claimed as passed.

1. Signed-in `/` shows the home feed (needs a real login on the Netlify site).
2. Set `TWO_FACTOR_SECRET` and email delivery; sign in on Netlify, get sent to `/mfa/verify`, receive the 6-digit email, confirm, then sign out and in again and confirm a new code is required.
3. The email arrives in a real inbox (not spam) from the verified sender, and a wrong code five times locks guessing for 15 minutes.
4. `GET /api/health` shows `"twoFactorEmail":true` once configured, and the admin area opens only after the code.
5. Report a post, comment and profile as one account; review, warn, remove, suspend and appeal as a bootstrapped administrator; confirm a suspended account is held at `/suspended`.
6. Download my data and request deletion on a real account.
7. Email delivery of the security notices (needs Resend credentials).
8. Sentry (needs a DSN): trigger `/api/sentry-test` with a token and confirm the event arrives scrubbed.
9. Upstash-backed rate limits (needs credentials; the database limits are active regardless).
10. Re-run the RLS review against the live project with `supabase db advisors` after the migrations are applied.

## 2b. Phase 6 addendum (communities and forums)

Date: 3 November 2026. Added after the Phase 4A review above; **not yet applied to any live database or deployed**.

- New migration `20261103000001_communities_and_forums.sql` (apply after the two Phase 4A migrations; it replaces `submit_report` and `moderate_report`, widens the report, saved-item and notification constraints, and changes the `posts`, `post_comments`, `post_likes` and `saved_items` policies).
- Verified: `npm run lint`, `npm run typecheck`, `npm run build` and `npm test` (the database policy tests run all migrations in PGlite, 43 of them are new: private community permissions, moderator roles and audit, anonymity leakage sweep, blocks, voting, acceptance, reports and moderation of anonymous content, account deletion).
- **Not verified:** nothing in Phase 6 has run against a live Supabase project or in a browser with real accounts. The checklist is TESTING.md section 15. Run `supabase db advisors` after applying the migration (especially the new security definer functions and `private` grants).
- New or changed risks to state to testers: anonymity is from other members, not from Medyra (a private record exists; staff with database access can read it; it may be disclosed under legal process); staff who suspend an anonymous writer can infer who it was from timing in a very small community; comment removal by community moderators has a database function but no screen yet; community owners are not verified or trained, and a community can be closed only by a Medyra administrator through a report; the legal drafts mention communities and anonymous posting but still need counsel's review (minors, retention of the private record, disclosure policy).
- Blockers added: decide the disclosure policy and retention for `forum_identity` with counsel; staff the moderation queue for forum reports (patient-privacy reports are time sensitive); add trigram or full-text language configs (French) before launch in Quebec; consider a "report" path to community moderators in addition to Medyra staff.

## 2c. Phase 7 addendum (messaging and mentorship)

Date: 4 November 2026. **Not yet applied to any live database or deployed.**

- New migration `20261104000001_messaging_and_mentorship.sql` (after the Phase 6 migration; replaces `submit_report` and `moderate_report` again to add message and mentor targets, adds Realtime publication of `messages`).
- Verified: lint, typecheck, build, and 945 tests, including 22 database tests (three accounts, blocks, unauthorized access, requests, groups, capacity, privacy of feedback). A bug found by those tests (a first message counted as read) is fixed.
- **Not verified:** nothing has run against a live Supabase project, Realtime delivery has not been exercised, and no browser walkthrough has been done (TESTING.md section 16).
- Honest limits to tell testers: messages are not end-to-end encrypted and staff with database access could read them; mentor credentials are self-declared and unverified; there is no email or push notification for messages; unread counts are approximate for very long unread backlogs; the mentor's "capacity" is stated, not a live count of free places; there is no message editing, attachments, typing indicators or group-admin removal of members.
- Blockers added: a retention policy for messages and for ended mentorships (counsel), staffing for message reports (harassment and grooming risks are higher in private messages; consider rate limits and keyword-free safeguards before launch), a decision on whether minors may message adults, and message-content limits for students approaching professionals.

## 3. What was built

| Area | What exists |
| --- | --- |
| Account security | **Two-step sign-in by emailed 6-digit code** (replaces the authenticator-app design). After the password, each new sign-in must be confirmed with a code emailed to the member's own address. Codes are never stored: a keyed digest sits in a signed, HttpOnly, 10-minute cookie, and the proof of success is a second signed cookie tied to the member and that sign-in session, so a new login needs a new code. Limits: one code a minute, five an hour, five wrong guesses per 15 minutes (counted in `two_factor_events`, which a member cannot edit or delete). Password re-confirmation before sensitive changes (10-minute window), sign out other devices or everywhere. Enforcement is `MFA_ENFORCEMENT` (default `required`). If the signing secret or email delivery is missing the step is skipped for members (never a lockout; `/api/health` shows `twoFactorEmail:false`) and the admin area stays closed. |
| User safety | Report post, comment or profile (a database function validates the target and keeps a 300-character snapshot); mute and unmute; block and unblock (blocks already existed) now also stop liking and commenting, in both directions, enforced by RLS; blocked and muted members are hidden from the feed and comments; mutes silence notifications; suspended members are blocked by RLS and by the access layer. |
| Moderation | `/admin`, `/admin/reports`, `/admin/users`. Administrators only: everyone else gets a plain `404`, and administrators must pass a second factor whatever `MFA_ENFORCEMENT` says. Report queue with claim, dismiss, warn, remove content, suspend; direct suspend and restore; appeals; deletion requests; retention settings; audit log. Every decision runs inside a security definer function that re-checks the caller and writes an append-only audit entry in the same transaction. Members see a message (never internal notes) and can appeal. No automated or AI moderation exists and none is claimed. |
| Privacy | Profile visibility (all members or connections only), directory listing, self-serve data export (JSON, POST only, recent sign-in, never cached), account deletion request with a 30-day cooling-off period and administrator execution, consent records written at onboarding, retention policies with a purge function, privacy contact configured by `PRIVACY_CONTACT_EMAIL`. |
| Legal drafts | Privacy policy, Terms of use and Community Guidelines rewritten to match the real data flows and tools, each with a visible "draft, not legal advice, needs legal review" notice, and a "for the lawyer" list of open items (Law 25, French-language requirements, minors, data location, provider contracts, incident procedure). |
| Guards | A test lists every HTTP route handler with its protection; another asserts every admin page calls `requireAdmin()`; another asserts every non-auth server action file calls a session gate. |

## 4. Migrations

Two new migrations, **not applied to any live database by this work**:

- `20261102000001_safety_and_moderation.sql`
- `20261102000002_account_security_and_privacy.sql`

(`20261101000001_network.sql` was applied to the dev project earlier.) The exposed personal access token was **not** used for any of this phase, and was not used after the brief asked that it not be reused. It was used earlier in this working session, before that instruction, for dev-project checks (applying and checking the Phase 4b migration and deleting throwaway test accounts). It must still be revoked and replaced (blocker 1).

**Apply them before deploying the code.** The code degrades safely if a table is missing (suspension and mutes read as "none", the feed still loads) but reporting, admin, privacy settings and consent will not work until the migrations exist.

Order of operations for a deploy:

1. Revoke the old token. Create a new, **scoped** token (or use the Supabase SQL editor).
2. Apply the two migrations to the dev project and run `supabase db advisors`.
3. Set `TWO_FACTOR_SECRET` and make email delivery work (Resend). Check `/api/health` shows `twoFactorEmail:true`.
4. Create the first administrator (SQL below), after that person has an account.
5. Set `TWO_FACTOR_SECRET` and (optionally) `PRIVACY_CONTACT_EMAIL` in Netlify. With email codes on, every member is asked for a code at their next sign-in.
6. Deploy. Walk through the live checklist in section 2.

```sql
-- Run once, in the SQL editor, as the project owner. Replace the email.
insert into public.staff_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.org';
```

## 5. Automated verification

Run on 2 November 2026 on this machine:

- `npm run lint`: clean.
- `npm run typecheck`: clean (whole project).
- `npm test`: **784 tests in 50 files pass**: 748 in `src` and `supabase` (of which 148 are database policy tests) plus 36 seed-tool tests. The 381 tests named in the brief are all part of this and still pass.
- `npm run build`: succeeds.
- Database policy tests run the real migrations in PGlite (an in-memory Postgres) with stand-ins for Supabase's `auth` schema (including `auth.mfa_factors` and `auth.jwt()`). They validate our SQL and RLS, not a live project.

## 6. Exact list of remaining production blockers

Must be done before real members, in rough order:

1. **Revoke the exposed Supabase personal access token** and create a replacement scoped to the dev project (and later a separate one for production). Until then, anyone with the old token has account-level access.
2. **Apply the two new migrations** and complete the live checks in section 2 (especially that the email arrives, and the administrator flows).
3. **Set up email delivery and `TWO_FACTOR_SECRET`** (Resend with a verified domain). Until then there is no second step for members, and the admin area is closed. Know the limit: an email code protects an account only as well as the member's email account is protected, which is weaker than an authenticator app. Keep `MFA_ENFORCEMENT=off` as the emergency switch if email delivery fails.
4. **A separate production Supabase project** with email confirmation on, Resend SMTP, the migrations, and its own keys. Previews and the current Netlify site use the dev project.
5. **Qualified legal review** of the Privacy policy, Terms and Guidelines (Law 25, other Canadian obligations, French-language availability, minors, data location, provider contracts), a named person in charge of personal information, and `PRIVACY_CONTACT_EMAIL` set to a real monitored mailbox. The pages say they are drafts; do not remove that until a lawyer approves.
6. **A moderation operating process**: who staffs `/admin`, response times, escalation for safety concerns, region-appropriate crisis resources (the report form only tells people to contact local emergency services), and a confidentiality-incident procedure.
7. **Scheduled jobs**: nothing runs `private.run_retention_purge()` or processes due deletion requests automatically. Schedule the purge (`pg_cron` or an external job) and decide who runs deletions, daily.
8. **Monitoring**: set `SENTRY_DSN` and alert rules, add an uptime monitor on `/api/health`, and enable Upstash. See `OBSERVABILITY.md`.
9. **Content-Security-Policy**: not set. The other security headers are.
10. **Backups**: confirm the Supabase plan's backup and point-in-time recovery, and test a restore.
11. **Invite-only launch controls**: nothing prevents open sign-up. Decide whether to gate registration (allow-list or invite codes) for controlled testing.
12. **Search scale**: add trigram indexes before the member count grows (section 1).
13. **Known limits to state to testers**: no list of a member's devices (Supabase does not expose one; sign-out-others and sign-out-everywhere exist), profile bio visibility is enforced by the app rather than the database, "Following" and "Popular" ranking are minimal, and AI moderation does not exist.
14. **Independent security review** (penetration test) before public launch.
