import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { LinkButton } from "@/components/ui/link-button";
import { requireMember } from "@/lib/auth/session";
import { EducationalNotice } from "@/features/forums/components/forum-notices";
import { ForumBrowser } from "@/features/forums/components/forum-browser";
import { getTopic, listTopics } from "@/features/forums/queries";
import { parseListParams } from "@/features/forums/schemas";

export const metadata: Metadata = {
  title: "Forum topic",
  robots: { index: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function TopicPage({ params, searchParams }: Props) {
  return (
    <AppPage label="the topic">
      <TopicContent params={params} searchParams={searchParams} />
    </AppPage>
  );
}

async function TopicContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const { user, profile } = await requireMember();
  const topic = await getTopic(slug);
  if (!topic) notFound();
  const [topics, query] = await Promise.all([listTopics(), searchParams]);
  const listParams = parseListParams(query, topic.slug);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/forums" className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          All topics
        </Link>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-maroon-900">{topic.name}</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{topic.description}</p>
          </div>
          <LinkButton href={`/forums/ask?topic=${topic.slug}`} className="h-10 px-4">
            <Plus className="size-4" aria-hidden="true" />
            Ask in this topic
          </LinkButton>
        </header>
        <EducationalNotice compact />
        <ForumBrowser viewerId={user.id} params={listParams} topics={topics} basePath={`/forums/topics/${topic.slug}`} lockedTopic={topic.slug} />
      </main>
    </>
  );
}
