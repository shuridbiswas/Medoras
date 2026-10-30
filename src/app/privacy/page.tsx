import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice } from "@/components/layout/draft-notice";
import { PageShell } from "@/components/layout/page-shell";
import { privacyContact } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy policy (draft)" };

export default function Page() {
  const contact = privacyContact();

  return (
    <PageShell eyebrow="Legal" title="Privacy policy">
      <DraftNotice />

      <p>
        This describes what personal information Medyra collects, why, who can see it and what choices you have. It
        reflects how the product actually works at the time of writing. Where something is undecided, it says so.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        Medyra is operated by its founding team (the legal entity and registered address are not final and must be added
        before launch). Questions, corrections and complaints about your personal information go to the privacy
        contact:{" "}
        {contact.email ? (
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
        ) : (
          <strong>not yet set up. Until it is, use the contact page.</strong>
        )}{" "}
        <em>
          (Open item: name the person in charge of the protection of personal information and publish their title and
          contact details.)
        </em>
      </p>

      <h2>2. What we collect and why</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address and a password (held, hashed, by our sign-in provider). At each
          sign-in we email a 6-digit code to your address (when email delivery is set up) and keep a short log of codes
          sent and wrong codes entered, with no code itself, to limit guessing. Used to sign you in and protect your
          account.
        </li>
        <li>
          <strong>Profile:</strong> name, username, headline, photo and cover image, role, fields, institution,
          qualification, specialty, career stage, country, an optional general location label, bio, professional journey,
          aspirations, education, experience, skills and interests, and mentorship preferences. All of it is
          self-reported and unverified. Used to show your profile to other members.
        </li>
        <li>
          <strong>Private onboarding answers:</strong> your reasons for joining and an optional city. Only you can see
          these.
        </li>
        <li>
          <strong>Activity:</strong> posts, comments, likes, saved items, connections, follows, blocks and mutes, and
          notifications about activity involving you. Notifications contain who did what, never the text.
        </li>
        <li>
          <strong>Safety records:</strong> reports you file, reports about you, moderation decisions and notices, appeals,
          and an audit log of staff actions (ids and decisions only).
        </li>
        <li>
          <strong>Records about your privacy choices:</strong> which version of the Terms, Privacy Policy and Community
          Guidelines you accepted and when, and any data export or deletion request.
        </li>
        <li>
          <strong>Technical data:</strong> sign-in session cookies, two short-lived signed cookies for the email-code step, the time of your last sign-in, and, if enabled, error
          reports with message text removed (see section 4).
        </li>
      </ul>
      <p>
        We do not sell personal information, show advertising, or use analytics or advertising trackers. We do not
        collect precise location, government identifiers, financial details or health records about you. Please never
        post identifiable patient or client information.
      </p>

      <h2>3. Who can see what</h2>
      <ul>
        <li>
          Your profile and posts are visible to <strong>signed-in Medyra members</strong>, not the public internet. You
          can limit education, experience, skills and bio to your connections, and unlist yourself from the directory, in{" "}
          <Link href="/settings/privacy">Privacy and your data</Link>. Education, experience and skills are limited by the
          database; your bio is limited by the application only.
        </li>
        <li>Your email address, password, onboarding answers, saved items, notifications, blocks and mutes are private to you.</li>
        <li>
          People on the Medyra team with the administrator role can see reports, moderation records, appeals, deletion
          requests and member status. Administrators need a second sign-in factor, and their actions are logged.
        </li>
      </ul>

      <h2>4. Service providers</h2>
      <p>
        Medyra uses providers to run. Some are built in but <strong>switched off unless configured</strong>; this list
        must be updated whenever one is switched on.
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> (database, sign-in, file storage). Holds all of the information above. The hosting
          region is set in the project and must be confirmed and stated here.
        </li>
        <li>
          <strong>Netlify</strong> (website hosting). Processes requests and keeps standard server logs.
        </li>
        <li>
          <strong>Resend</strong> (email), optional: sends sign-in, security and welcome emails to your address.
        </li>
        <li>
          <strong>Sentry</strong> (error monitoring), optional: receives technical error reports. Medyra removes message
          text, cookies and request bodies first, and does not use session replay.
        </li>
        <li>
          <strong>Upstash</strong> (rate limiting), optional: sees a random member id and a count, to slow down abuse.
        </li>
        <li>
          <strong>Pinecone</strong> (search), planned and not active: would receive structured profile tags only, never
          free text.
        </li>
        <li>
          <strong>ProductBridge</strong> (feedback), optional: opened by link; Medyra sends it no member data.
        </li>
      </ul>
      <p>
        <em>
          (Open item for counsel: where these providers store and process data, whether information leaves Québec or
          Canada, and what assessment and contracts are required before it does.)
        </em>
      </p>

      <h2>5. Cookies</h2>
      <p>
        Medyra sets only the cookies needed to keep you signed in, one that remembers if you chose not to stay signed in,
        and two signed cookies that record that you confirmed a sign-in with an emailed code. There are no advertising or
        analytics cookies.
      </p>

      <h2>6. How long we keep it</h2>
      <p>
        Your profile and content stay until you delete them or your account. Operational records have limits that are
        listed, and shown live, in <Link href="/settings/privacy">Privacy and your data</Link> (for example read
        notifications 90 days, resolved reports one year, audit entries two years). Backups held by our database
        provider may keep deleted data for a short period after deletion. <em>(Open item: confirm the provider&apos;s
        backup window and state it.)</em>
      </p>

      <h2>7. Your choices</h2>
      <ul>
        <li>
          <strong>See and fix:</strong> edit your profile any time. Download a copy of your data from{" "}
          <Link href="/settings/privacy">Privacy and your data</Link>.
        </li>
        <li>
          <strong>Delete:</strong> request account deletion there. It happens after a 30-day waiting period you can cancel.
        </li>
        <li>
          <strong>Control who sees you:</strong> profile visibility, directory listing, blocking and muting.
        </li>
        <li>
          <strong>Notifications:</strong> choose which in-app and email notices you receive in Settings. Security notices
          are always sent.
        </li>
        <li>
          <strong>Complain:</strong> if you think your information is mishandled you can contact the privacy contact above
          and, in Québec, the Commission d&apos;accès à l&apos;information; elsewhere in Canada, the Office of the Privacy
          Commissioner of Canada or your provincial regulator.
        </li>
      </ul>

      <h2>8. Security</h2>
      <p>
        We protect accounts with a 6-digit code emailed at each sign-in (only as safe as your email account), row-level database rules that limit what each member can
        read or change, rate limits, and logging of staff actions. No system is perfectly secure.{" "}
        <em>
          (Open item: a written confidentiality-incident procedure, including how affected people and the regulator are
          told, and a register of incidents.)
        </em>
      </p>

      <h2>9. Age</h2>
      <p>
        Medyra is built for adults and students in healthcare and social services. <em>(Open product decision: the
        minimum age, and how Québec&apos;s rules for consent by people under 14 are handled. Until decided, Medyra should
        not be opened to anyone under 18.)</em>
      </p>

      <h2>10. Changes</h2>
      <p>
        When this changes in a way that matters, the version changes and members are asked to accept it again. Your past
        acceptances are listed in <Link href="/settings/privacy">Privacy and your data</Link>.
      </p>

      <h2>For the lawyer: items not yet addressed</h2>
      <ul>
        <li>Law 25 (Québec): person in charge of personal information, privacy governance policies, consent wording and granularity, privacy impact assessment for transfers outside Québec, confidentiality-incident register, rights of access, rectification, portability and de-indexation, and automated decision-making notices (none are used today).</li>
        <li>French-language availability of the Terms, Privacy Policy and Guidelines and of the product.</li>
        <li>PIPEDA and other provincial rules; health-information rules that may apply if members share health information (members are told not to).</li>
        <li>Minimum age and handling of minors; lawful basis for processing members&apos; self-reported professional information.</li>
        <li>Provider contracts and data-processing terms (Supabase, Netlify, and any optional provider switched on).</li>
      </ul>
    </PageShell>
  );
}
