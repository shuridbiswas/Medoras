import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "About Medoras" };

export default function Page() {
  return (
    <PageShell eyebrow="About" title="About Medoras">
      <p>
        Medoras is a professional and social network for the healthcare and
        social services community. It brings together students, graduates,
        professionals, mentors, researchers and employers so that no one has to
        navigate their education, career or personal challenges alone.
      </p>
      <p>
        We are building Medoras in stages, starting with this welcome page.
        Sign-in, profiles, mentorship, forums and careers will follow.
      </p>
    </PageShell>
  );
}
