# Email setup (Resend)

There are two kinds of email in Medyra, and **each is sent by exactly one system**:

| Kind | Sent by | Examples |
| --- | --- | --- |
| Authentication email | **Supabase Auth**, through Resend SMTP | Sign-up confirmation, password reset |
| Application email | **Medyra server code**, through the Resend API | Welcome email, password-changed security notice (and future comment/connection notices) |

Do not also send authentication email from the app. Auth emails use the templates in `supabase/templates/` (confirmation.html, recovery.html).

Status: the application code is tested with mocks. **Nothing has been sent through Resend** because no Resend account, key or verified domain exists yet.

## 1. Create the Resend account and verify your domain

1. Sign up at resend.com.
2. **Domains > Add domain**. Use a subdomain such as `mail.your-domain.example` (keeps sending reputation separate from the main domain).
3. Resend shows DNS records generated for your account (SPF, DKIM, and a return-path/bounce MX). Add them to Cloudflare **exactly as shown**, proxy status **DNS only** (see DNS_SETUP.md). Do not invent or reuse values.
4. Click **Verify** in Resend. Wait until the domain shows **Verified**.

## 2. SPF, DKIM, DMARC

- **SPF** and **DKIM** are the records Resend generates in step 1. They prove Resend may send for your domain and that messages are untampered.
- **DMARC** you create yourself, once SPF and DKIM pass. Start in monitor mode:

  | Type | Name | Value |
  | --- | --- | --- |
  | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@your-domain.example` |

  Use a mailbox you actually read for `rua`. After a few weeks of clean reports, tighten to `p=quarantine`, then `p=reject`. (Use `_dmarc.mail` only if you sign from the `mail` subdomain and want a separate policy.)
- Check results with the headers of a received message ("SPF: pass, DKIM: pass, DMARC: pass") or a tool such as mail-tester.com.

## 3. API key and application settings

1. Resend > **API Keys** > create a key with **Sending access**, limited to your domain.
2. Set in Netlify (production scope) and `.env.local` for local tests:

   ```
   RESEND_API_KEY=<the key>
   EMAIL_FROM=Medyra <hello@mail.your-domain.example>
   ```

   The address must be on the verified domain. Never commit the key. It is server-only.
3. Confirm: `GET /api/health` shows `"resend": true`.

## 4. Supabase Auth through Resend SMTP

Per [Resend's Supabase guide](https://resend.com/docs/send-with-supabase-smtp). In the Supabase dashboard of the **production** project (and dev if you want real emails there): Authentication > Notifications > Email > **SMTP Settings**:

| Field | Value |
| --- | --- |
| Sender email | `hello@mail.your-domain.example` (verified domain) |
| Sender name | `Medyra` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | a Resend API key (create a separate key for this) |

Then:

- Authentication > **Providers > Email**: Confirm email **ON**, minimum password length 10.
- Authentication > **Email Templates**: paste `supabase/templates/confirmation.html` into "Confirm sign up" and `recovery.html` into "Reset password". They link to `/auth/callback?token_hash=...`. (Supabase's free plan with the default mailer does not allow template edits; custom SMTP removes that limit.)
- Authentication > **URL Configuration**: Site URL and Redirect URLs (DNS_SETUP.md section 6).

## 5. What the app sends, and the rules

- `src/lib/email/send.ts` is server-only. The browser never sees the key.
- The only public entry point, `sendToMember(member, message, category)`, emails **only the verified signed-in member's own address**. There is no endpoint that accepts a recipient.
- Each send validates the address and payload, is rate limited (5 per hour per member through Upstash when configured), and never throws; failures are reported to Sentry (without content) and the user flow continues.
- Categories: `transactional` and `security` always send; `activity` respects Settings > Email notifications (`notification_preferences.notify_activity`, default on).
- Every email has an HTML and a plain-text version, all member-supplied text is HTML-escaped, and every email says Medyra is not a substitute for professional care.
- Templates: `src/lib/email/templates.ts` (welcome, password-changed security notice, comment notification, connection notification). The last two are ready but not sent, because comments and connections don't notify yet.

## 6. Testing safely

1. Use the **development** Supabase project and a **test** Resend API key. Do not run these tests with production keys.
2. Local test of app mail: put the key and `EMAIL_FROM` in `.env.local`, restart `npm run dev`, then sign up a test account and finish onboarding. Expect the welcome email at the test account's inbox. Change that account's password in Settings and expect the security notice.
3. Until your domain is verified, Resend lets you test with their shared sender and delivery-test recipient addresses (see Resend's "Send test emails" documentation for the current addresses). Use only addresses you control or Resend's documented test addresses.
4. Check in Resend > **Emails** that the message shows Delivered, then check the inbox's raw headers for SPF/DKIM/DMARC pass.
5. Failure drill: set a wrong `EMAIL_FROM` domain and confirm onboarding still completes (email is best effort) and the failure appears in Sentry as `email.send`.
6. Unit tests (no network): `npm test -- src/lib/email`.
