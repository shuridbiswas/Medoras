import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { LinkButton } from "@/components/ui/link-button";
import { avatarUrl, requireMember } from "@/lib/auth/session";
import { FIELDS, MEMBER_TYPES } from "@/features/onboarding/options";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-sand/60">
      <Suspense fallback={<HomeFallback />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

function HomeFallback() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
      <span className="sr-only">Loading your home</span>
    </div>
  );
}

async function HomeContent() {
  // Server-side gate: signed in, verified, and onboarding complete.
  const { profile } = await requireMember();
  const photo = avatarUrl(profile.avatar_path);
  const role = MEMBER_TYPES.find((m) => m.value === profile.member_type)?.label;
  const fields = profile.fields
    .map((f) => FIELDS.find((o) => o.value === f)?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <AppHeader username={profile.username} />
      <main id="main" className="mx-auto max-w-4xl px-5 py-10">
        <section
          aria-labelledby="welcome"
          className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:p-8"
        >
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-2xl font-bold text-maroon-700">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              profile.first_name.slice(0, 1).toUpperCase()
            )}
          </span>
          <div className="min-w-0">
            <h1 id="welcome" className="text-2xl font-bold text-maroon-900">
              Welcome, {profile.first_name}
            </h1>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.headline ? (
              <p className="mt-1 text-maroon-900/85">{profile.headline}</p>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">
              {[role, fields].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton
                href={`/profile/${profile.username}`}
                className="h-9 px-3.5 text-sm"
              >
                View my profile
              </LinkButton>
              <LinkButton
                href="/profile/edit"
                variant="outline"
                className="h-9 px-3.5 text-sm"
              >
                Edit profile
              </LinkButton>
            </div>
          </div>
        </section>
        <p className="mt-6 rounded-2xl border border-dashed border-maroon-200 bg-maroon-50 p-6 text-maroon-900">
          Your account is ready. The Medoras home feed, communities and
          mentorship are being built next.
        </p>
      </main>
    </>
  );
}
