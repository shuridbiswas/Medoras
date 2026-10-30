import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Terms" };

export default function Page() {
  return (
    <PageShell eyebrow="Legal" title="Terms">
      <p>
        Medyra has not yet launched. Terms of use will be published before
        accounts are available.
      </p>
    </PageShell>
  );
}
