import Link from "next/link";
import { QuestionCard } from "@/features/forums/components/question-card";
import type { QuestionSummary, Topic } from "@/features/forums/types";

/** Saved questions, and saved answers shown with the question they belong to. Private to the viewer. */
export function SavedForum({
  questions,
  answers,
  topics,
}: {
  questions: QuestionSummary[];
  answers: { id: string; body: string; question: QuestionSummary }[];
  topics: Topic[];
}) {
  if (questions.length === 0 && answers.length === 0) return null;
  const topicMap = new Map(topics.map((t) => [t.slug, t]));
  return (
    <section aria-labelledby="saved-forum-heading" className="space-y-3">
      <h2 id="saved-forum-heading" className="text-lg font-semibold text-maroon-900">
        Saved from the forums
      </h2>
      <ul className="space-y-3">
        {questions.map((q) => (
          <li key={q.id}>
            <QuestionCard question={q} topics={topicMap} />
          </li>
        ))}
        {answers.map((a) => (
          <li key={a.id} className="rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5">
            <p className="text-xs font-semibold tracking-wide text-maroon-700 uppercase">Saved answer</p>
            <p className="mt-1 line-clamp-4 text-sm leading-relaxed whitespace-pre-wrap text-maroon-900/90">{a.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              On{" "}
              <Link href={`/forums/${a.question.id}#answer-${a.id}`} className="font-medium text-maroon-700 underline underline-offset-2">
                {a.question.title}
              </Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
