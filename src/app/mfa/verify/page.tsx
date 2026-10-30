import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMfaState, requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { signOut } from "@/features/auth/actions";
import { AuthShell, FormSkeleton } from "@/features/auth/components/auth-shell";
import { MfaVerifyForm } from "@/features/security/components/code-forms";

export const metadata: Metadata = {
  title: "Confirm it's you",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default function MfaVerifyPage({ searchParams }: Props) {
  return (
    <AuthShell
      title="Enter your code"
      subtitle="Open your authenticator app and enter the 6-digit code for Medyra."
      footer={
        <div className="space-y-2 text-center text-sm">
          <Link href="/mfa/recovery" className="font-medium text-maroon-700 underline-offset-4 hover:underline">
            Lost your phone? Use a recovery code
          </Link>
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground underline-offset-4 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function VerifyContent({ searchParams }: Props) {
  await requireUser({ mfa: "skip" });
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  const state = await getMfaState();
  // Nothing to confirm: not enrolled, or this session already passed the second step.
  if (!state.enrolled) redirect("/settings/security?setup=1");
  if (state.level === "aal2") redirect(next);
  return <MfaVerifyForm next={next} />;
}
