import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Community Guidelines" };

export default function Page() {
  return (
    <PageShell eyebrow="Community" title="Community Guidelines">
      <p>
        Medoras is being designed as a respectful, compassionate community with
        zero tolerance for harassment, threats, hate speech and bullying.
      </p>
      <p>
        Full community guidelines, reporting tools and moderation policies will
        be published before the community opens. Peer-support spaces will never
        replace therapy, emergency services or individualized professional care.
      </p>
    </PageShell>
  );
}
