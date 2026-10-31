import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { AskForm } from "@/features/forums/components/ask-form";
import { EducationalNotice } from "@/features/forums/components/forum-notices";
import { listTopics } from "@/features/forums/queries";

export const metadata: Metadata = {
  title: "Ask a question",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function AskPage({ searchParams }: Props) {
  return (
    <AppPage label="the form">
      <AskContent searchParams={searchParams} />
    </AppPage>
  );
}

async function AskContent({ searchParams }: Props) {
  const { profile } = await requireMember();
  const raw = (await searchParams).topic;
  const topic = Array.isArray(raw) ? raw[0] : raw;
  const topics = await listTopics();

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/forums" className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to forums
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Ask a question</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ask in general terms. You can post under your name or anonymously.</p>
        </div>
        <EducationalNotice />
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <AskForm topics={topics} defaultTopic={topics.some((t) => t.slug === topic) ? topic : undefined} />
        </section>
      </main>
    </>
  );
}
