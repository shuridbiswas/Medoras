import type { Metadata } from "next";
import { DraftNotice } from "@/components/layout/draft-notice";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Community Guidelines (draft)" };

export default function Page() {
  return (
    <PageShell eyebrow="Community" title="Community Guidelines">
      <DraftNotice />
      <p>
        These are the working rules for the Medyra community feed. They are a
        starting point, not a finished policy, and will be expanded before the
        community grows.
      </p>

      <h2>Protect patients and clients</h2>
      <p>
        Never post identifiable patient or client information. That includes
        names, initials, dates of birth, addresses, health card or record
        numbers, photos, and any combination of details (rare condition, small
        town, exact dates, workplace) that could point to one person. Share a
        case only if it is truly de-identified, and when in doubt, leave it out.
      </p>

      <h2>This is member discussion, not medical advice</h2>
      <p>
        Posts and comments are written by members. They are personal views and
        experience. They are not verified medical, psychological, legal or
        professional advice, and they do not replace care from a qualified
        professional. If you or someone else is in danger, contact your local
        emergency number or a crisis line.
      </p>

      <h2>Be respectful</h2>
      <p>
        Harassment, threats, hate speech, bullying and discrimination are not
        welcome. Disagree with ideas, not people. Celebrate others without
        turning it into a contest.
      </p>

      <h2>What is not active yet</h2>
      <ul>
        <li>
          <strong>Identity verification is not active.</strong> Medyra does not
          yet verify that anyone is a licensed professional or student. Profiles
          are self-reported and show no verification badges.
        </li>
        <li>
          <strong>Automated moderation is not active.</strong> Posts are not
          screened by AI or by staff before or after they appear, so harmful
          content may be visible. Do not assume a post has been reviewed.
        </li>
        <li>
          <strong>Review is by people, and not instant.</strong> You can report a post, comment or profile. A person
          on the Medyra team reads each report; nothing is removed because it was reported, and you won&apos;t always
          be told the outcome. Reports are not an emergency channel: if someone is in danger, contact your local
          emergency number.
        </li>
      </ul>

      <h2>Your tools</h2>
      <ul>
        <li><strong>Report</strong> a post, comment or profile from the Report button on it.</li>
        <li><strong>Mute</strong> a member to stop seeing their posts and comments. They aren&apos;t told.</li>
        <li>
          <strong>Block</strong> a member to end any connection, stop them from connecting, following, liking or
          commenting on your posts, and keep their posts out of your feed. They aren&apos;t told.
        </li>
        <li>You can manage both lists in Settings.</li>
      </ul>

      <h2>When we act</h2>
      <p>
        The team can warn a member, remove content, or suspend an account, and writes to the member explaining why. The
        member can appeal and a person reviews the appeal. Every staff action is recorded in an audit log. We may act
        straight away where there is a risk of serious harm.
      </p>

      <h2>Your posts</h2>
      <p>
        You can edit or delete your own posts and comments at any time. Posts
        are visible to other signed-in Medyra members, not to the public
        internet.
      </p>
    </PageShell>
  );
}
