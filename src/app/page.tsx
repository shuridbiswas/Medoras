import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppFrame } from "@/components/layout/app-frame";
import { AppHeader } from "@/components/layout/app-header";
import { avatarUrl, getUser, requireMember } from "@/lib/auth/session";
import { categorySchema } from "@/features/feed/schemas";
import { FeedNav, type FeedScope } from "@/features/feed/components/feed-nav";
import { FeedSection } from "@/features/feed/components/feed-section";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PostComposer } from "@/features/feed/components/post-composer";
import { SafetyNotice } from "@/features/feed/components/safety-notice";
import { categoryLabel } from "@/features/feed/options";
import { HeroBanner } from "@/features/home/components/hero-banner";
import {
  RightSidebar,
  RightSidebarSkeleton,
} from "@/features/home/components/right-sidebar";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<{
    category?: string | string[];
    feed?: string | string[];
  }>;
};

export default function HomePage({ searchParams }: Props) {
  return (
    <AppFrame>
      <Suspense fallback={<HomeFallback />}>
        <HomeContent searchParams={searchParams} />
      </Suspense>
    </AppFrame>
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

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function HomeContent({ searchParams }: Props) {
  // The default page: members see their home feed, everyone else the public welcome page.
  // (proxy.ts redirects first; this is the server-side backstop.)
  if (!(await getUser())) redirect("/welcome");
  // Signed in, verified, and onboarding complete (otherwise sent to /login or /onboarding).
  const { user, profile } = await requireMember();
  const params = await searchParams;
  // An unknown ?category= or ?feed= falls back to the full feed instead of erroring.
  const parsed = categorySchema.safeParse(first(params.category));
  const category = parsed.success ? parsed.data : undefined;
  const scope: FeedScope | undefined =
    first(params.feed) === "following" ? "following" : undefined;

  const view = scope ? "following" : "latest";
  const retryParams = new URLSearchParams();
  if (scope) retryParams.set("feed", scope);
  if (category) retryParams.set("category", category);
  const retryHref = retryParams.size > 0 ? `/?${retryParams}` : "/";

  return (
    <>
      <AppHeader member={profile} />
      <main
        id="main"
        className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <div className="min-w-0 space-y-5">
          <HeroBanner firstName={profile.first_name} />

          <PostComposer
            name={profile.first_name}
            avatarSrc={avatarUrl(profile.avatar_path)}
          />

          <FeedNav active={category} scope={scope} />

          <section
            aria-label={
              category
                ? `${categoryLabel(category)} posts`
                : scope
                  ? "Posts from members you follow"
                  : "Latest posts"
            }
          >
            <Suspense key={`${view}:${category ?? "all"}`} fallback={<FeedSkeleton />}>
              <FeedSection
                viewerId={user.id}
                category={category}
                scope={scope}
                retryHref={retryHref}
                emptyTitle={
                  scope
                    ? "Nothing from the people you follow"
                    : category
                      ? "No posts in this category yet"
                      : "No posts yet"
                }
                emptyDescription={
                  scope
                    ? "Follow members from the Network page and their posts will appear here."
                    : category
                      ? "Be the first to start a conversation here."
                      : "Nothing has been shared yet. Start the first conversation using the box above."
                }
              />
            </Suspense>
          </section>

          <SafetyNotice className="rounded-xl border border-border bg-surface p-3" />
        </div>

        <div className="hidden xl:block">
          <div className="sticky top-22">
            <Suspense fallback={<RightSidebarSkeleton />}>
              <RightSidebar profile={profile} />
            </Suspense>
          </div>
        </div>
      </main>
    </>
  );
}
