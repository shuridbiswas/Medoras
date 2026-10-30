import type { Metadata } from "next";
import { Suspense } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { avatarUrl, requireMember } from "@/lib/auth/session";
import { categorySchema } from "@/features/feed/schemas";
import { FeedNav } from "@/features/feed/components/feed-nav";
import { FeedSection } from "@/features/feed/components/feed-section";
import { FeedSkeleton } from "@/features/feed/components/feed-skeleton";
import { PostComposer } from "@/features/feed/components/post-composer";
import { SafetyNotice } from "@/features/feed/components/safety-notice";
import { categoryLabel } from "@/features/feed/options";
import { Greeting } from "@/features/home/components/greeting";
import { LeftSidebar } from "@/features/home/components/left-sidebar";
import {
  RightSidebar,
  RightSidebarSkeleton,
} from "@/features/home/components/right-sidebar";

export const metadata: Metadata = {
  title: "Home",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ category?: string | string[] }> };

export default function HomePage({ searchParams }: Props) {
  return (
    <div className="min-h-dvh bg-sand/60 pb-20 md:pb-0">
      <Suspense fallback={<HomeFallback />}>
        <HomeContent searchParams={searchParams} />
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

async function HomeContent({ searchParams }: Props) {
  // Server-side gate: signed in, verified, and onboarding complete.
  const { user, profile } = await requireMember();
  const params = await searchParams;
  const rawCategory = Array.isArray(params.category)
    ? params.category[0]
    : params.category;
  // An unknown ?category= falls back to the full feed instead of erroring.
  const parsed = categorySchema.safeParse(rawCategory);
  const category = parsed.success ? parsed.data : undefined;

  return (
    <>
      <AppHeader member={profile} wide />
      <main
        id="main"
        className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_19rem]"
      >
        <div className="hidden lg:block">
          <div className="sticky top-22">
            <LeftSidebar profile={profile} current="home" />
          </div>
        </div>

        <div className="min-w-0 space-y-5">
          <div>
            <Greeting firstName={profile.first_name} />
            <p className="mt-1 text-sm text-muted-foreground">
              Posts from Medyra members, newest first. {" "}
              <span className="whitespace-nowrap">Share something, or join a conversation.</span>
            </p>
          </div>

          <PostComposer
            name={profile.first_name}
            avatarSrc={avatarUrl(profile.avatar_path)}
          />

          <FeedNav active={category} />

          <section
            aria-label={category ? `${categoryLabel(category)} posts` : "Latest posts"}
          >
            <Suspense key={category ?? "all"} fallback={<FeedSkeleton />}>
              <FeedSection
                viewerId={user.id}
                category={category}
                retryHref={category ? `/home?category=${category}` : "/home"}
                emptyTitle={
                  category ? "No posts in this category yet" : "No posts yet"
                }
                emptyDescription={
                  category
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
