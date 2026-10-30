import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { AuthShell, FormSkeleton } from "@/features/auth/components/auth-shell";
import { ReauthForm } from "@/features/security/components/code-forms";

export const metadata: Metadata = {
  title: "Confirm your password",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default function ReauthPage({ searchParams }: Props) {
  return (
    <AuthShell
      title="Confirm your password"
      subtitle="This change is sensitive, so please enter your password again."
      footer={
        <Link href="/settings/security" className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline">
          Cancel
        </Link>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <ReauthContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ReauthContent({ searchParams }: Props) {
  await requireUser({ mfa: "allow-enrollment" });
  const raw = (await searchParams).next;
  return <ReauthForm next={safeNextPath(Array.isArray(raw) ? raw[0] : raw, "/settings/security")} />;
}
