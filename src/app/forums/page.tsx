import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { LinkButton } from "@/components/ui/link-button";
import { requireMember } from "@/lib/auth/session";
import { FORUM_INTRO, FORUM_TAGLINE, HOW_IT_WORKS } from "@/features/forums/content";
import { EducationalNotice } from "@/features/forums/components/forum-notices";
import { ForumBrowser } from "@/features/forums/components/forum-browser";
import { listTopics } from "@/features/forums/queries";
import { parseListParams } from "@/features/forums/schemas";

export const metadata: Metadata = {
  title: "Forums",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function ForumsPage({ searchParams }: Props) {
  return (
    <AppPage label="the forums">
      <ForumsContent searchParams={searchParams} />
    </AppPage>
  );
}

async function ForumsContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const params = parseListParams(await searchParams);
  const topics = await listTopics();

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold tracking-wide text-maroon-700 uppercase">{FORUM_TAGLINE}</p>
            <h1 className="mt-1 text-2xl font-bold text-maroon-900">Forums</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{FORUM_INTRO}</p>
          </div>
          <LinkButton href="/forums/ask" className="h-10 px-4">
            <Plus className="size-4" aria-hidden="true" />
            Ask a question
          </LinkButton>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="min-w-0 space-y-4">
            <nav aria-label="Topics" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {topics.map((t) => (
                <Link
                  key={t.slug}
                  href={`/forums/topics/${t.slug}`}
                  className="inline-flex h-9 shrink-0 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-maroon-900/80 hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {t.name}
                </Link>
              ))}
            </nav>
            <ForumBrowser viewerId={user.id} params={params} topics={topics} basePath="/forums" />
          </div>

          <aside aria-label="About the forums" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="text-sm font-semibold text-maroon-900">How it works</h2>
              <ol className="mt-3 space-y-3">
                {HOW_IT_WORKS.map((s, i) => (
                  <li key={s.title} className="flex gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-maroon-100 text-xs font-bold text-maroon-700">{i + 1}</span>
                    <span className="text-sm">
                      <span className="font-semibold text-maroon-900">{s.title}.</span>{" "}
                      <span className="text-muted-foreground">{s.text}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
            <EducationalNotice />
          </aside>
        </div>
      </main>
    </>
  );
}
