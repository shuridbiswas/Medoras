import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function Page() {
  return (
    <PageShell eyebrow="Community" title="Community Guidelines">
      <p>
        These are the working rules for the Medoras community feed. They are a
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
          <strong>Identity verification is not active.</strong> Medoras does not
          yet verify that anyone is a licensed professional or student. Profiles
          are self-reported and show no verification badges.
        </li>
        <li>
          <strong>Automated moderation is not active.</strong> Posts are not
          screened by AI or by staff before or after they appear, so harmful
          content may be visible. Do not assume a post has been reviewed.
        </li>
        <li>
          <strong>Reporting and blocking tools are not built yet.</strong> They
          are planned. Until then, use the{" "}
          <a href="/contact">contact page</a> to raise a concern.
        </li>
      </ul>

      <h2>Your posts</h2>
      <p>
        You can edit or delete your own posts and comments at any time. Posts
        are visible to other signed-in Medoras members, not to the public
        internet.
      </p>
    </PageShell>
  );
}
