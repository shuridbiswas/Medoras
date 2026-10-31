import Link from "next/link";
import { CheckCircle2, EyeOff } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { chipClass } from "@/components/forms/controls";
import { ANONYMOUS_AUTHOR } from "@/features/forums/content";
import { kindLabel } from "@/features/forums/options";
import type { QuestionSummary, Topic } from "@/features/forums/types";
import { cn } from "@/lib/utils";

/**
 * One row in a question list. The answers tile on the left is the main signal (answered, accepted
 * or open); it is a count of real answers, never a score.
 */
export function QuestionCard({ question, topics }: { question: QuestionSummary; topics: Map<string, Topic> }) {
  const topic = topics.get(question.topic_slug);
  const writer = question.author
    ? [question.author.first_name, question.author.last_name].filter(Boolean).join(" ")
    : ANONYMOUS_AUTHOR;
  return (
    <article aria-label={question.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div
        className={cn(
          "flex size-14 shrink-0 flex-col items-center justify-center rounded-xl text-center",
          question.accepted ? "bg-maroon-700 text-white" : question.answerCount > 0 ? "bg-maroon-50 text-maroon-800" : "bg-sand text-muted-foreground",
        )}
      >
        <span className="text-lg leading-none font-bold">{question.answerCount}</span>
        <span className="mt-0.5 text-[0.65rem] leading-none">{question.answerCount === 1 ? "answer" : "answers"}</span>
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-maroon-900">
          <Link href={`/forums/${question.id}`} className="hover:underline">
            {question.title}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-maroon-900/80">{question.body}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          {topic ? (
            <Link href={`/forums/topics/${topic.slug}`} className={cn(chipClass, "hover:bg-maroon-100")}>
              {topic.name}
            </Link>
          ) : null}
          <span>{kindLabel(question.kind)}</span>
          {question.accepted ? (
            <span className="inline-flex items-center gap-1 font-medium text-maroon-700">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Accepted answer
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            {question.is_anonymous ? <EyeOff className="size-3.5" aria-hidden="true" /> : null}
            {writer}
          </span>
          <RelativeTime iso={question.created_at} />
        </div>
      </div>
    </article>
  );
}
