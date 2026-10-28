import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { requireOnboardingPending } from "@/lib/auth/session";
import { FormSkeleton } from "@/features/auth/components/auth-shell";
import { OnboardingWizard } from "@/features/onboarding/components/onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false },
};

export default function OnboardingPage() {
  return (
    <div className="min-h-dvh bg-sand/60">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-5">
          <Logo />
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_24px_60px_-40px_rgba(110,16,38,0.4)] sm:p-10">
          <Suspense fallback={<FormSkeleton rows={4} />}>
            <OnboardingContent />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function OnboardingContent() {
  // Server-side gate: signed in, email verified, onboarding not yet complete.
  const { profile, preferences } = await requireOnboardingPending();

  return (
    <OnboardingWizard
      initial={{
        firstName: profile?.first_name ?? "",
        memberType: profile?.member_type ?? "",
        fields: profile?.fields ?? [],
        institution: profile?.institution ?? "",
        qualification: profile?.qualification ?? "",
        specialty: profile?.specialty ?? "",
        careerStage: profile?.career_stage ?? "",
        country: profile?.country ?? "",
        city: preferences?.city ?? "",
        purposes: preferences?.purposes ?? [],
        username: profile?.username ?? "",
        headline: profile?.headline ?? "",
        bio: profile?.bio ?? "",
      }}
    />
  );
}
