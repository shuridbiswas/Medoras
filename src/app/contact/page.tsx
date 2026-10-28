import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Contact" };

export default function Page() {
  return (
    <PageShell eyebrow="Contact" title="Contact">
      <p>
        A contact form and support address will be available as Medoras
        approaches launch.
      </p>
      <p>Until then, please check back here for updates.</p>
    </PageShell>
  );
}
