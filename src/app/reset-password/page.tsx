import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/session";
import { AuthShell, FormSkeleton } from "@/features/auth/components/auth-shell";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Pick something you haven't used before. You'll stay signed in on this device."
    >
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <ResetContent />
      </Suspense>
    </AuthShell>
  );
}

async function ResetContent() {
  // The recovery email link signs the member in. No session means an invalid or expired link.
  const user = await getUser();
  if (!user) redirect("/forgot-password?error=link_invalid");
  return <ResetPasswordForm />;
}
