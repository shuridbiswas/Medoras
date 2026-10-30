import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { AuthShell, FormSkeleton } from "@/features/auth/components/auth-shell";
import { RecoveryForm } from "@/features/security/components/code-forms";

export const metadata: Metadata = {
  title: "Use a recovery code",
  robots: { index: false },
};

export default function MfaRecoveryPage() {
  return (
    <AuthShell
      title="Use a recovery code"
      subtitle="A recovery code removes your current authenticator so you can set up a new one. Each code works once."
      footer={
        <Link href="/mfa/verify" className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline">
          Back to the 6-digit code
        </Link>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <RecoveryContent />
      </Suspense>
    </AuthShell>
  );
}

async function RecoveryContent() {
  await requireUser({ mfa: "skip" });
  return (
    <div className="space-y-4">
      <RecoveryForm />
      <p className="text-xs leading-relaxed text-muted-foreground">
        No recovery codes either? Medyra cannot reset your authenticator for you by email alone. Use the{" "}
        <Link href="/contact" className="underline underline-offset-2">
          contact page
        </Link>{" "}
        and expect to be asked to prove who you are.
      </p>
    </div>
  );
}
