import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import { LinkButton } from "@/components/ui/link-button";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const { intent } = await searchParams;
  const joining = intent === "join";

  return (
    <PageShell
      eyebrow={joining ? "Join Medoras" : "Sign in"}
      title={joining ? "Membership opens soon." : "Sign-in is on its way."}
    >
      <p>
        Accounts, profiles and sign-in are coming in the next phase of Medoras.
        There is nothing to enter here yet, and no accounts exist.
      </p>
      <p>Thank you for your interest in the community we are building.</p>
      <LinkButton href="/" variant="outline" className="h-11 px-5">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to Medoras
      </LinkButton>
    </PageShell>
  );
}
