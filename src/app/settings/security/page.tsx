import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { mfaMode } from "@/lib/auth/mfa";
import { createClient } from "@/lib/supabase/server";
import { AuthenticatorPanel, type FactorSummary } from "@/features/security/components/authenticator-panel";
import { SessionsPanel } from "@/features/security/components/sessions-panel";

export const metadata: Metadata = {
  title: "Account security",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ setup?: string; recovered?: string }> };

export default function SecurityPage({ searchParams }: Props) {
  return (
    <AppPage label="account security">
      <SecurityContent searchParams={searchParams} />
    </AppPage>
  );
}

const section = "rounded-2xl border border-border bg-surface p-5 sm:p-7";

async function SecurityContent({ searchParams }: Props) {
  // Members without an authenticator may be here (this is where they set one up); members who
  // have one must have passed it.
  const { user, profile } = await requireMember({ mfa: "allow-enrollment" });
  const params = await searchParams;
  const mode = mfaMode();

  const supabase = await createClient();
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const factors: FactorSummary[] = (factorData?.totp ?? []).map((f) => ({
    id: f.id,
    name: f.friendly_name || "Authenticator app",
    createdAt: new Date(f.created_at).toLocaleDateString("en-CA"),
  }));

  const { data: codes } = await supabase
    .from("mfa_recovery_codes")
    .select("used_at")
    .eq("user_id", user.id)
    .overrideTypes<{ used_at: string | null }[], { merge: false }>();
  const remaining = codes && codes.length > 0 ? codes.filter((c) => !c.used_at).length : null;

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <Link href="/settings" className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline">
            Back to settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-maroon-900">Account security</h1>
          <p className="mt-1 text-muted-foreground">Protect your account and control where you are signed in.</p>
        </div>

        {params.recovered ? (
          <div role="status" className="rounded-xl border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-900">
            Your recovery code worked and your old authenticator was removed. Set up a new one now to keep your account protected.
          </div>
        ) : null}
        {factors.length === 0 && (params.setup || mode === "required") ? (
          <div
            role="status"
            className="flex gap-3 rounded-xl border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-900"
          >
            <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-maroon-700" aria-hidden="true" />
            <p>
              <strong>Set up two-step sign-in to continue.</strong> Medyra asks every member for an authenticator
              app code at sign-in to protect a community that shares sensitive professional conversations. It takes
              about two minutes. You can also sign out and come back later.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="mfa" className={section}>
          <h2 id="mfa" className="text-xl font-bold text-maroon-900">
            Two-step sign-in
          </h2>
          <div className="mt-4">
            <AuthenticatorPanel factors={factors} recoveryRemaining={remaining} required={mode === "required"} autoStart={Boolean(params.setup)} />
          </div>
        </section>

        <section aria-labelledby="sessions" className={section}>
          <h2 id="sessions" className="text-xl font-bold text-maroon-900">
            Where you are signed in
          </h2>
          <div className="mt-3">
            <SessionsPanel />
          </div>
        </section>

        <section aria-labelledby="password-link" className={section}>
          <h2 id="password-link" className="text-xl font-bold text-maroon-900">
            Password
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Change your password from{" "}
            <Link href="/settings" className="font-medium text-maroon-700 underline underline-offset-2">
              Settings
            </Link>
            . Changing it signs out your other devices.
          </p>
        </section>
      </main>
    </>
  );
}
