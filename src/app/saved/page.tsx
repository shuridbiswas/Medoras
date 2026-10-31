import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { Pagination } from "@/components/layout/pagination";
import { requireMember } from "@/lib/auth/session";
import { SavedList } from "@/features/saved/components/saved-list";
import { getSavedPosts, SAVED_PAGE_SIZE } from "@/features/saved/queries";
import { SavedForum } from "@/features/forums/components/saved-forum";
import { getSavedForum, listTopics } from "@/features/forums/queries";

export const metadata: Metadata = {
  title: "Saved",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export default function SavedPage({ searchParams }: Props) {
  return (
    <AppPage label="your saved posts">
      <SavedContent searchParams={searchParams} />
    </AppPage>
  );
}

async function SavedContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const raw = (await searchParams).page;
  const parsed = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? "1", 10);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 1;

  const [saved, forum, topics] = await Promise.all([
    getSavedPosts(user.id, page),
    // Saved questions and answers are shown on the first page only, newest first.
    page === 1 ? getSavedForum(user.id, 1, 10) : Promise.resolve(null),
    page === 1 ? listTopics() : Promise.resolve([]),
  ]);
  // Keyed so a new page (or a changed list) starts from fresh server data.
  const key = `${page}:${saved.posts.map((p) => p.id).join(",")}`;

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Saved</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posts, questions and answers you bookmarked, newest save first. Only you can see this list.
            Research and jobs can be saved here once they exist.
          </p>
        </div>

        {saved.failed ? (
          <p role="alert" className="text-sm text-destructive">
            We couldn&apos;t load your saved posts. Please refresh.
          </p>
        ) : (
          <>
            <SavedList key={key} posts={saved.posts} />
            <Pagination
              page={page}
              pageSize={SAVED_PAGE_SIZE}
              total={saved.total}
              hrefFor={(p) => (p === 1 ? "/saved" : `/saved?page=${p}`)}
              label="Saved pages"
            />
            {forum && !forum.failed ? (
              <SavedForum questions={forum.questions} answers={forum.answers} topics={topics} />
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
