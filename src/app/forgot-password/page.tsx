import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  AuthShell,
  authErrorMessages,
  FormSkeleton,
} from "@/features/auth/components/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

type SearchParams = Promise<{ error?: string }>;

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
      footer={
        <Link
          href="/login"
          className="font-semibold text-maroon-700 underline-offset-4 hover:underline"
        >
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={<FormSkeleton rows={1} />}>
        <ForgotContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function ForgotContent({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const configured = isSupabaseConfigured();
  const notice = !configured
    ? authErrorMessages.not_configured
    : error
      ? authErrorMessages[error]
      : undefined;
  return <ForgotPasswordForm notice={notice} disabled={!configured} />;
}
