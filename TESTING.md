# Testing Medyra locally (two accounts, real database)

This guide walks through manual testing against the **development** Supabase project (`medyra-dev`). Everything you do writes real rows to that database. Never point this at a production project, and never use real patient information.

## 0. One-time setup

1. `npm install`
2. `.env.local` must contain the development project's values (already created for you on this machine; it is git-ignored):

   ```
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>
   ```

   Only the **publishable** key is ever used by the app. Never put the secret or `service_role` key here.

3. **Dashboard settings (Supabase > your dev project > Authentication).** These are the settings the app needs. They are dashboard-only changes:

   | Where | Setting | Value |
   | --- | --- | --- |
   | URL Configuration | Site URL | `http://localhost:3000` |
   | URL Configuration | Redirect URLs | add `http://localhost:3000/**` |
   | Sign In / Providers > Email | Minimum password length | `10` |
   | Sign In / Providers > Email | **Confirm email** | **OFF for development only** (see below) |
   | Email Templates | Confirm sign up / Reset password | paste `supabase/templates/confirmation.html` and `recovery.html` (needed only when confirmation is on). Not available on the free plan with Supabase's default mailer; configure custom SMTP first. |

The URL, redirect, password-length and confirmation settings above are already applied to `medyra-dev`.

   **Why turn "Confirm email" off in development?** Supabase's built-in mailer allows only 2 emails per hour and only sends to your own team's addresses, so creating two test accounts with confirmation on is slow and unreliable. With it off, signing up logs you in immediately and Medyra continues straight to onboarding. **Turn it back ON before real users sign up** (and set up your own SMTP provider).

   With confirmation ON you can still test: sign up, open the email, and click the link (it goes through `/auth/callback`). Use two real inboxes you control (for example `you+a@gmail.com` and `you+b@gmail.com`).

4. Start the app:

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

Useful URLs: `/signup`, `/login`, `/forgot-password`, `/` (home), `/welcome`, `/onboarding`, `/profile/edit`, `/profile/<username>`, `/settings`, `/search`.

## 0b. Fill the dev project with fictional test data (optional)

Instead of creating accounts by hand, a development-only tool creates 50 fictional Quebec members (French and English) with profiles, images, 250 posts (70 questions), 400 comments, 600 likes, connections and follows. Everything about it (safety rules, commands, what the plan contains) is in [SEEDING.md](SEEDING.md); the personas to log in as are in [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md).

Quick start (needs Node 22.18+, `SEED_ALLOWED_PROJECT_REF` in `.env.local`, email confirmation OFF in the dev project, and a project-scoped `SUPABASE_ACCESS_TOKEN` passed for the command only):

```bash
npm run seed:dev -- --dry-run   # validate and print the plan, writes nothing
npm run seed:dev                # create the data (idempotent)
npm run seed:verify             # counts, permissions, pagination, search
npm run seed:login -- camille_lavoie   # copy a password to the clipboard without printing it
npm run seed:clean              # remove only the seeded accounts and their data
```

## 1. Create Test Account A

1. Go to http://localhost:3000/signup.
2. Use a clearly fictional name (for example "Alex Testa") and an inbox you control, for example `you+a@gmail.com`, with a password of 10+ characters including a letter and a number.
3. Accept the terms and submit.
   - Confirmation OFF: you land on `/onboarding`.
   - Confirmation ON: open the email and click the link, then you land on `/onboarding`.

## 2. Complete onboarding (Account A)

Walk through the five steps (who you are, your field, your stage, why you are here, your photo and username). Pick a username such as `alex_testa`. Finish. You should arrive at `/home`.

Check: reloading `/` keeps you signed in; visiting `/onboarding` again sends you back to `/`.

## 3. Edit Account A's profile

1. Open http://localhost:3000/profile/edit.
2. Upload a profile photo (JPEG, PNG or WebP, up to 2 MB) and a cover image (up to 5 MB). A file renamed to `.jpg` that is not really an image is rejected.
3. Set a headline, a general location ("Montreal, QC"), About text, and mentorship preferences.
4. Add one education entry and one experience entry, and a few skills.
5. Save each card. You should see a success message each time.
6. Open `/profile/<username>`: everything you saved appears, and nothing shows a verification badge.

## 4. Publish a post (Account A)

1. On `/` (home), write a post, choose a category, and click **Post**. It appears at the top immediately.
2. Reload the page: it is still there (it is stored in PostgreSQL).
3. Edit the post (shows "Edited"), then publish a second one.
4. Open your profile and the **Activity** tab: both posts are listed.

## 5. Create Test Account B

1. Open a **private/incognito window** (or another browser) so Account A stays signed in.
2. Sign up as `you+b@gmail.com` (for example "Blake Testb"), complete onboarding with username `blake_testb`.

## 6. Account B views Account A

1. On `/` (home), Account A's posts appear in the feed with A's name, headline and photo.
2. Click A's name. You land on `/profile/alex_testa` with A's real profile, and A's posts under **Activity**.
3. You can also find A through the header search (`/search?q=alex`).

## 7. Like and comment as Account B

1. Like one of A's posts. The count goes to 1; the heart is filled. Unlike it: back to 0. Like it again.
2. Open the comments, write a comment, and submit. The count updates to 1.
3. Write a second comment and delete it. Only your own comments show a Delete button.

## 8. Switch back to Account A

1. In A's window, reload `/`.
2. A's post shows 1 like and 1 comment. Open the comments and read B's comment. A has no Delete button on B's comment.

## 9. Confirm everything persists

- Reload both windows: likes, comments and posts are unchanged.
- Sign out of both and sign in again: same data.
- Restart `npm run dev`: same data (it is in the database, not in memory).

## 10. Inspect the records in Supabase Studio

Dashboard > your dev project > **Table Editor** (or **SQL Editor**):

```sql
select id, username, first_name, onboarding_completed from public.profiles;
select id, author_id, category, left(body, 40) as body, edited_at from public.posts order by created_at desc;
select * from public.post_likes;
select id, post_id, author_id, left(body, 40) from public.post_comments;
```

Authentication > **Users** lists the two accounts. Storage > `avatars` / `covers` hold the images under a folder named with each user's id. Email addresses appear only in Authentication > Users, never in `public.profiles`.

## 11. Confirm Account B cannot change Account A's content

**In the app:** on A's posts, B sees no Edit or Delete controls.

**At the database level** (this is the real protection). In the SQL Editor, replace the ids with real ones from step 10. Everything runs inside a transaction that is rolled back, so nothing changes:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<ACCOUNT B USER ID>', true);

-- Try to edit and delete A's post as B: expect 0 rows each.
update public.posts set body = 'hijacked' where id = '<A POST ID>' returning id;
delete from public.posts where id = '<A POST ID>' returning id;

-- Try to publish a post in A's name: expect "violates row-level security policy".
insert into public.posts (author_id, category, body)
values ('<ACCOUNT A USER ID>', 'questions', 'spoofed');

-- Try to delete A's comment or like: expect 0 rows.
delete from public.post_likes where user_id = '<ACCOUNT A USER ID>' returning post_id;
rollback;
```

## 11b. Network, saved posts and notifications (two accounts)

With Account A and Account B (private windows) signed in:

1. As A, open `/network`, find B (try the filters) and press **Connect**. The card shows "Request sent". Nothing else changes for B except a bell badge.
2. As B: the bell shows 1 and **Network** shows a badge. Open `/notifications` ("A sent you a connection request"; no post text anywhere) and `/network/requests`, then **Accept**. A's bell now shows "B accepted your connection request".
3. Both profiles show 1 connection. Try **Follow** from A: a follow is separate from the connection and appears in the Following count. B's home page "Following" tab shows nothing until B follows someone.
4. Have B comment on A's post: A gets "B commented on your post" and clicking it opens `/post/<id>`. Have A comment later on a post B commented on: B gets "also commented on a post you commented on".
5. Bookmark a post (the ribbon icon). It appears in `/saved`; removing it there takes it off the list. The other account's `/saved` stays empty.
6. In Settings, switch off "Comments and replies on posts", then comment again: no new notification.
7. On B's profile as A press **Block this member** and confirm: the connection and follows disappear, B can no longer send A a request or follow (B just sees "You can't do that with this member"), and B is not told. Unblock in Settings.
8. Try sending a request to the same person twice, or to yourself: it is refused.

## 12. Other things worth trying

- Sign in with a wrong password: you get one generic error (no hint whether the email exists).
- Visit `/` signed out: you land on `/welcome`. Visit `/settings` signed out: redirected to `/login`. Visit the old `/home`: redirected to `/`.
- Click the Medyra logo on any page: signed in goes to `/` (home), signed out goes to `/welcome`.
- Password reset: `/forgot-password` (needs a working email; the same success screen is shown for unknown addresses).
- Post 21 times within an hour: the database refuses ("posting too quickly").
- Try a 3,001-character post, an empty post, or a file that is not an image: all are refused.

## 13. Infrastructure checks (optional services)

Every service below is optional. With none configured, everything above still works.

**Health check.** `GET http://localhost:3000/api/health` returns `{"status":"ok","services":{...}}`. Each flag is `true` only when that service's variables are set. It never shows a value.

**Sentry (deliberate test exception).**
1. Put your DSN in `.env.local` as `NEXT_PUBLIC_SENTRY_DSN`, and a long random string as `SENTRY_TEST_TOKEN`. Restart `npm run dev`.
2. Run (replace the token):
   ```bash
   curl -i -H "x-sentry-test-token: <your SENTRY_TEST_TOKEN>" http://localhost:3000/api/sentry-test
   ```
   Expect HTTP 500. Without the header, or with a wrong one, you get 404 (the route stays invisible).
3. In Sentry > Issues, within a minute, find "Medyra Sentry test: deliberate server exception" with environment `development`. Open it and check the event has **no** cookies, request body, query string, email or IP.
4. For a browser error, open any page, press F12 > Console and run `setTimeout(() => { throw new Error("browser test") })` then look for it in Sentry. (Errors thrown directly in the console are sandboxed and are not captured; the timeout form works.)
5. Remove `SENTRY_TEST_TOKEN` afterwards.

**Redis rate limiting (Upstash).**
1. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`, restart, confirm `/api/health` shows `"upstashRedis": true`.
2. Publish 11 posts quickly with one account. The 11th shows "You're posting quickly. Please wait a few minutes." (limit 10 per 10 minutes). Comments stop at 21 in 10 minutes; searches at 31 per minute.
3. In the Upstash console > Data Browser, keys start with `medyra:development:rl:` and expire on their own.
4. Failure drill: put a wrong token in `.env.local`. Posting still works (rate limiting fails open) and a `rate-limit` error is reported to Sentry if configured.

**Email (Resend).** See EMAIL_SETUP.md section 6. With `RESEND_API_KEY` and `EMAIL_FROM` set, finishing onboarding sends a welcome email, and changing your password in Settings sends a security notice. Settings > Email notifications saves your preference (stored in `notification_preferences`).

**Feedback (ProductBridge).** Set `NEXT_PUBLIC_PRODUCTBRIDGE_ORG_ID`, restart, open the account menu > **Feedback**. The three cards open your ProductBridge portal tabs in a new browser tab. Without the id the page shows a contact fallback.

**Pinecone.** Not used by any feature yet. `npm test -- src/lib/pinecone` runs its unit tests (mocked, no credentials needed).

## Cleaning up

Delete test users in Authentication > Users (their profiles, posts, likes, comments, connections, follows, blocks, saved items, notifications and images' rows cascade). Remove stored images in Storage if you want a clean slate.

## Automated checks

```bash
npm run lint
npm run typecheck
npm test            # includes the Row Level Security tests (supabase/tests/*.test.ts, run in PGlite)
npm run build
```

The RLS tests apply the real migrations to an in-memory Postgres and check cross-user access. They do not need Supabase credentials.
