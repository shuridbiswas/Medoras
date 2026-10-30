import type { Metadata } from "next";
import Link from "next/link";
import { DraftNotice } from "@/components/layout/draft-notice";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Terms of use (draft)" };

export default function Page() {
  return (
    <PageShell eyebrow="Legal" title="Terms of use">
      <DraftNotice />

      <p>
        These are the rules for using Medyra, written in plain language to match how the product works today. They are a
        draft and will change before launch.
      </p>

      <h2>1. Who can use Medyra</h2>
      <p>
        Medyra is for students, educators, researchers and professionals in healthcare and social services. You must give
        accurate information about yourself. Profiles are self-reported: Medyra does not verify that anyone is a student
        or a licensed professional, and nothing on Medyra is an endorsement of anyone&apos;s credentials.{" "}
        <em>(Open: minimum age and any region limits.)</em>
      </p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for what happens on your account. Medyra requires an authenticator app for sign-in; keep your
        recovery codes private and tell us if you think your account was accessed by someone else. Do not share your
        account.
      </p>

      <h2>3. Your content</h2>
      <p>
        You keep ownership of what you post. By posting you allow Medyra to store it and show it to other signed-in members
        as the product works, until you delete it or your account. Only post what you have the right to share.{" "}
        <em>(Open: the exact licence wording and what happens to copies and quotes by others.)</em>
      </p>

      <h2>4. What you must not do</h2>
      <ul>
        <li>Share identifiable patient or client information.</li>
        <li>Harass, threaten, discriminate against or impersonate anyone.</li>
        <li>Post spam, scams, or content that is unlawful or unsafe.</li>
        <li>Try to get around security, rate limits, blocks or moderation, or scrape the service.</li>
      </ul>
      <p>
        See the <Link href="/community-guidelines">Community Guidelines</Link> for detail.
      </p>

      <h2>5. Not medical advice, not a crisis service</h2>
      <p>
        What members write is personal opinion and experience, not professional advice. Medyra is not therapy, not a crisis
        service and cannot respond in real time. If someone is in danger, contact local emergency services.
      </p>

      <h2>6. Moderation and your account</h2>
      <p>
        Members can report content. People on the Medyra team review reports and can warn a member, remove content or
        suspend an account. There is no automated or AI moderation. If a decision affects you, you will be told and can
        appeal; a person reviews appeals. Medyra may act without notice where there is a risk of serious harm.
      </p>

      <h2>7. Ending your account</h2>
      <p>
        You can delete your account from <Link href="/settings/privacy">Privacy and your data</Link> (after a 30-day
        waiting period you can cancel). Medyra can suspend or end accounts that break these rules.
      </p>

      <h2>8. Changes, availability and liability</h2>
      <p>
        Medyra is early-stage software and may change, be unavailable, or lose data despite our care.{" "}
        <em>
          (Open for counsel: disclaimers, limits of liability, indemnities, governing law and forum, dispute resolution,
          consumer-protection rules, and how changes to these terms are notified and accepted.)
        </em>
      </p>

      <h2>9. Contact</h2>
      <p>
        Use the <Link href="/contact">contact page</Link>. See the <Link href="/privacy">Privacy policy</Link> for the
        privacy contact.
      </p>
    </PageShell>
  );
}
