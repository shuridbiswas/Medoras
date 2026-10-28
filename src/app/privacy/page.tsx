import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Privacy" };

export default function Page() {
  return (
    <PageShell eyebrow="Legal" title="Privacy">
      <p>
        Medoras has not yet launched and does not currently collect personal
        information through this page.
      </p>
      <p>
        A complete privacy policy, covering how member data, optional location
        sharing and anonymous participation are handled, will be published
        before accounts are available.
      </p>
    </PageShell>
  );
}
