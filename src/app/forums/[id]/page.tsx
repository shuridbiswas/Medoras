import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { chipClass } from "@/components/forms/controls";
import { requireMember } from "@/lib/auth/session";
import { AnswerSection } from "@/features/forums/components/answers";
import { AuthorLine } from "@/features/forums/components/author-line";
import { EducationalNotice } from "@/features/forums/components/forum-notices";
import { QuestionActions } from "@/features/forums/components/question-actions";
import { kindLabel } from "@/features/forums/options";
import { getQuestion, getTopic } from "@/features/forums/queries";
import { idSchema } from "@/features/forums/schemas";

export const metadata: Metadata = {
  title: "Question",
  robots: { index: false },
};

type Props = { params: Promise<{ id: string }> };

export default function QuestionPage({ params }: Props) {
  return (
    <AppPage label="the question">
      <QuestionContent params={params} />
    </AppPage>
  );
}

async function QuestionContent({ params }: Props) {
  const { id } = await params;
  const { user, profile } = await requireMember();
  // A malformed id, a missing question and one hidden by a block all look the same: not found.
  if (!idSchema.safeParse(id).success) notFound();
  const question = await getQuestion(user.id, id);
  if (!question) notFound();
  const topic = await getTopic(question.topic_slug);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/forums" className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to forums
        </Link>

        <article aria-labelledby="question-title" className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {topic ? (
              <Link href={`/forums/topics/${topic.slug}`} className={`${chipClass} hover:bg-maroon-100`}>
                {topic.name}
              </Link>
            ) : null}
            <span className="text-muted-foreground">{kindLabel(question.kind)}</span>
            {question.accepted ? (
              <span className="inline-flex items-center gap-1 font-medium text-maroon-700">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Has an accepted answer
              </span>
            ) : null}
          </div>
          <h1 id="question-title" className="text-2xl font-bold text-maroon-900">
            {question.title}
          </h1>
          <AuthorLine author={question.author} anonymous={question.is_anonymous} createdAt={question.created_at} edited={Boolean(question.edited_at)} />
          <p className="leading-relaxed break-words whitespace-pre-wrap text-maroon-900/90">{question.body}</p>
          {question.isMine && question.is_anonymous ? (
            <p className="rounded-xl bg-sand/70 p-3 text-xs leading-relaxed text-maroon-900">
              You posted this anonymously. Other members see &quot;Anonymous member&quot;. Only you can see that it is yours, and you can
              delete it or accept an answer at any time.
            </p>
          ) : null}
          <div className="border-t border-border pt-2">
            <QuestionActions questionId={question.id} following={question.followedByMe} saved={question.savedByMe} isMine={question.isMine} />
          </div>
        </article>

        <EducationalNotice compact />

        <AnswerSection questionId={question.id} answers={question.answers} canAccept={question.isMine} />
      </main>
    </>
  );
}
