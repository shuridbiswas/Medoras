import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Eye, EyeOff, LogOut, Mail, ShieldCheck } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { requireMember } from "@/lib/auth/session";
import { signOut } from "@/features/auth/actions";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false },
};

export default function SettingsPage() {
  return (
    <div className="min-h-dvh bg-sand/60 pb-20 md:pb-0">
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-dvh items-center justify-center"
          >
            <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
            <span className="sr-only">Loading settings</span>
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}

const visibleToMembers = [
  "Name, username and headline",
  "Photo and cover image",
  "Field, role, institution and specialty",
  "Country and the location label you choose to show",
  "Bio, journey, aspirations, skills and interests",
  "Education, experience and mentorship preferences",
];

const privateItems = [
  "Your email address",
  "Your password and sign-in sessions",
  "Your city from onboarding and your reasons for joining",
];

async function SettingsContent() {
  const { user, profile } = await requireMember();

  return (
    <>
      <AppHeader member={profile} />
      <main
        id="main"
        className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <div>
          <h1 className="text-3xl font-bold text-maroon-900">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Manage your account and see what others can see.
          </p>
        </div>

        <section
          aria-labelledby="account"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
        >
          <h2 id="account" className="text-xl font-bold text-maroon-900">
            Account
          </h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Mail
                className="mt-0.5 size-4 text-maroon-600"
                aria-hidden="true"
              />
              <div>
                <dt className="font-semibold text-maroon-900">Email address</dt>
                <dd className="break-all text-muted-foreground">
                  {user.email}
                </dd>
                <dd className="mt-0.5 flex items-center gap-1 text-xs text-maroon-700">
                  <ShieldCheck className="size-3.5" aria-hidden="true" />{" "}
                  Verified. Only you can see it.
                </dd>
              </div>
            </div>
            <div>
              <dt className="font-semibold text-maroon-900">Profile</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                <LinkButton
                  href={`/profile/${profile.username}`}
                  variant="outline"
                  className="h-9 px-3.5 text-sm"
                >
                  View profile
                </LinkButton>
                <LinkButton
                  href="/profile/edit"
                  variant="outline"
                  className="h-9 px-3.5 text-sm"
                >
                  Edit profile
                </LinkButton>
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="password"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
        >
          <h2 id="password" className="text-xl font-bold text-maroon-900">
            Change password
          </h2>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            Changing your password signs you out of your other devices. Forgot
            it?{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-maroon-700 underline-offset-4 hover:underline"
            >
              Use the reset link instead.
            </Link>
          </p>
          <ResetPasswordForm />
        </section>

        <section
          aria-labelledby="privacy"
          className="rounded-2xl border border-border bg-surface p-5 sm:p-7"
        >
          <h2 id="privacy" className="text-xl font-bold text-maroon-900">
            Privacy
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Only signed-in Medyra members can see profiles. Per-field privacy
            controls are planned.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-maroon-900">
                <Eye className="size-4 text-maroon-600" aria-hidden="true" />{" "}
                Visible to members
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {visibleToMembers.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-maroon-900">
                <EyeOff className="size-4 text-maroon-600" aria-hidden="true" />{" "}
                Private
              </h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {privateItems.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-10 px-4">
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </Button>
        </form>
      </main>
    </>
  );
}
