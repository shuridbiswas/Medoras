# Observability: errors, uptime, rate limits and logs

Everything here is optional and fail-soft: a missing variable turns the feature off and never blocks sign-up, reading the feed or posting. `GET /api/health` shows which services are configured (booleans only).

## What is in place today

| Need | State |
| --- | --- |
| Error reporting | Sentry is integrated and **off** until `NEXT_PUBLIC_SENTRY_DSN` is set. Events pass through `scrubEvent`: no cookies, request bodies, query strings, authorization headers or secrets; only an opaque member id; console breadcrumbs dropped. Session Replay and user feedback are off. Server actions report with `reportError(operation, error)` (operation name and database error code only). |
| Rate limits | Upstash-backed sliding windows per verified member id, **off** until `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, and then fail-open. Policies: post, comment, like, network, mfa, report, privacy, search, api, email. The database enforces its own hard hourly limits regardless (20 posts, 60 comments, 30 connection requests, 100 follows, 10 reports, 5 wrong email codes per 15 minutes, 5 codes an hour). |
| Health | `GET /api/health`: `{"status":"ok","environment":…,"services":{…booleans}}`. No secrets, no counts, no member data. |
| Logs | The application writes no `console.*` output. Hosting logs (Netlify) hold request metadata. Do not add logging of request bodies, form values, post or comment text, emails, tokens, email sign-in codes or the signing secret. |
| Audit trail | Staff actions and security events (account deleted, retention changed) go to `audit_logs`: append-only, ids and decisions only. |

## Turn on Sentry (when you have credentials)

1. Create a Sentry project for Next.js. Copy the DSN.
2. In Netlify environment variables (per context) set `NEXT_PUBLIC_SENTRY_DSN`, and for source maps `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. Redeploy.
3. `GET /api/health` should now show `"sentry":true`.
4. Test: set `SENTRY_TEST_TOKEN` in Netlify, then call `GET /api/sentry-test` with header `x-sentry-test-token: <the token>`. It throws a deliberate error. Confirm in Sentry that the event has **no** cookies, body, query string or email, then remove `SENTRY_TEST_TOKEN` (the route returns 404 without it).

### Alerts to create in Sentry

- New issue in production: notify the on-call person immediately.
- Issue regressed (resolved then seen again).
- Error rate above 2% of requests over 10 minutes.
- Any event whose message contains `two_factor` or `reports.` or `moderate` (these are the safety-critical paths).

## Uptime monitoring

Use any external monitor (UptimeRobot, Better Stack, Checkly...). It must not be inside the same provider as the app.

1. Monitor `GET https://<your domain>/api/health` every 1 to 5 minutes. Expect HTTP 200 and the text `"status":"ok"`.
2. Add a second check on `GET /welcome` (public page, expects 200) to catch rendering failures.
3. Alert by email and by phone push to at least two people. Trigger after 2 consecutive failures.
4. Optional keyword check: alert if the body contains `"supabase":false`, which means the database environment variables were lost.

## Database and platform alerts (Supabase dashboard)

- Auth: spikes in failed sign-ins, and in wrong email codes (rows in `two_factor_events` with kind `failure`).
- Database: CPU above 80% for 10 minutes, connections near the plan limit, disk above 80%.
- Advisors: run the Security and Performance advisors after every migration.
- Enable PITR or daily backups (plan-dependent) and rehearse a restore.

## Scheduled maintenance jobs (not scheduled yet)

- `select private.run_retention_purge();` daily (`pg_cron` or an external job connecting as the database owner). It removes read notifications, resolved reports, old audit entries, failed recovery attempts and completed data requests past their retention days.
- Review `/admin` "Deletion requests" daily; carry out those past the 30-day cooling-off period.

## Sensitive-information rules for logs and reports

- Never log or report: passwords, session tokens, email sign-in codes, the `TWO_FACTOR_SECRET`, email addresses, post or comment text, report details, or appeal text.
- Server errors: pass the operation name and the database error **code**, not the message, to `reportError`.
- New Sentry tags or contexts must be ids or enumerated values only.
- If a secret is ever pasted into chat, a ticket or a log, treat it as exposed: revoke it and issue a new one.
