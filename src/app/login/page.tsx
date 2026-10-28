import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  AuthShell,
  authErrorMessages,
  FormSkeleton,
} from "@/features/auth/components/auth-shell";
import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

type SearchParams = Promise<{ next?: string; error?: string }>;

export default function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue to Medoras."
      footer={
        <>
          New to Medoras?{" "}
          <Link
            href="/signup"
            className="font-semibold text-maroon-700 underline-offset-4 hover:underline"
          >
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton rows={2} />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

async function LoginContent({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  const configured = isSupabaseConfigured();
  const notice = !configured
    ? authErrorMessages.not_configured
    : error
      ? authErrorMessages[error]
      : undefined;
  const safeNext = next ? safeNextPath(next, "") : "";

  return (
    <LoginForm
      next={safeNext || undefined}
      notice={notice}
      disabled={!configured}
    />
  );
}
