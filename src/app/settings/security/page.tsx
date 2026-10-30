import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { CODE_TTL_MINUTES, maskEmail, mfaMode } from "@/lib/auth/mfa";
import { isTwoFactorConfigured } from "@/lib/auth/two-factor";
import { SessionsPanel } from "@/features/security/components/sessions-panel";

export const metadata: Metadata = {
  title: "Account security",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ admin_2fa?: string }> };

export default function SecurityPage({ searchParams }: Props) {
  return (
    <AppPage label="account security">
      <SecurityContent searchParams={searchParams} />
    </AppPage>
  );
}

const section = "rounded-2xl border border-border bg-surface p-5 sm:p-7";

async function SecurityContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const params = await searchParams;
  const active = mfaMode() !== "off" && isTwoFactorConfigured();

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

        {params.admin_2fa === "unavailable" ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            The admin area needs email codes to be set up on this server (a signing secret and email delivery) and
            they are not. Ask whoever runs the deployment to set <code>TWO_FACTOR_SECRET</code>, <code>RESEND_API_KEY</code> and{" "}
            <code>EMAIL_FROM</code>.
          </div>
        ) : null}

        <section aria-labelledby="two-step" className={section}>
          <h2 id="two-step" className="flex items-center gap-2 text-xl font-bold text-maroon-900">
            <Mail className="size-5 text-maroon-600" aria-hidden="true" />
            Two-step sign-in by email
          </h2>
          <p className="mt-3 text-sm text-maroon-900/85">
            {active
              ? `Every time you sign in, we email a 6-digit code to ${maskEmail(user.email)} and you enter it to continue. The code works once and for ${CODE_TTL_MINUTES} minutes. This is on for every member and can't be turned off.`
              : "Two-step sign-in by email is not switched on for this server yet. When it is, every sign-in will ask for a 6-digit code sent to your email address."}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Never share the code. Medyra will never ask you for it.</li>
            <li>If you get a code you didn&apos;t ask for, someone may know your password: reset it right away.</li>
            <li>It protects your account only as well as your email account is protected. Use a strong password and two-step sign-in there too.</li>
            <li>Lost access to your email? Use the <Link href="/contact" className="underline underline-offset-2">contact page</Link>; you will be asked to prove who you are.</li>
          </ul>
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
