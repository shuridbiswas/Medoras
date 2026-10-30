import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTwoFactorState, requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { mfaMode } from "@/lib/auth/mfa";
import { signOut } from "@/features/auth/actions";
import { AuthShell, FormSkeleton } from "@/features/auth/components/auth-shell";
import { EmailCodeForm } from "@/features/security/components/code-forms";

export const metadata: Metadata = {
  title: "Confirm it's you",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default function MfaVerifyPage({ searchParams }: Props) {
  return (
    <AuthShell
      title="Check your email"
      subtitle="To keep Medyra safe, enter the 6-digit code we send to your email each time you sign in."
      footer={
        <form action={signOut} className="text-center">
          <button type="submit" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function VerifyContent({ searchParams }: Props) {
  const user = await requireUser({ mfa: "skip" });
  const raw = (await searchParams).next;
  const next = safeNextPath(Array.isArray(raw) ? raw[0] : raw);
  // Nothing to confirm: the step is off or unavailable, or this sign-in was already confirmed.
  if (mfaMode() === "off") redirect(next);
  const state = await getTwoFactorState(user.id);
  if (!state.configured || state.verified) redirect(next);
  return <EmailCodeForm next={next} />;
}
