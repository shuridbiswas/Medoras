import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  AuthShell,
  authErrorMessages,
  FormSkeleton,
} from "@/features/auth/components/auth-shell";
import { FormAlert } from "@/components/forms/fields";
import { SignupForm } from "@/features/auth/components/signup-form";

export const metadata: Metadata = {
  title: "Create your account",
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Join Medoras"
      subtitle="Create your account to connect, learn and grow with your community."
      footer={
        <>
          Already a member?{" "}
          <Link
            href="/login"
            className="font-semibold text-maroon-700 underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton rows={5} />}>
        <SignupContent />
      </Suspense>
    </AuthShell>
  );
}

async function SignupContent() {
  const configured = isSupabaseConfigured();
  return (
    <div className="space-y-5">
      {!configured ? (
        <FormAlert tone="info">{authErrorMessages.not_configured}</FormAlert>
      ) : null}
      <SignupForm disabled={!configured} />
    </div>
  );
}
