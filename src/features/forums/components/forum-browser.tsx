import Link from "next/link";
import { MessageCircleQuestion, Search } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { controlClass, labelClass } from "@/components/forms/controls";
import { checkRateLimit } from "@/lib/rate-limit";
import { QuestionCard } from "@/features/forums/components/question-card";
import { FORUM_PAGE_SIZE, QUESTION_FILTERS, QUESTION_KINDS } from "@/features/forums/options";
import { listQuestions } from "@/features/forums/queries";
import type { ListParams } from "@/features/forums/schemas";
import type { Topic } from "@/features/forums/types";
import { cn } from "@/lib/utils";

/** Search box, filters and the question list. A plain GET form, so every view is a shareable URL. */
export async function ForumBrowser({
  viewerId,
  params,
  topics,
  basePath,
  lockedTopic,
}: {
  viewerId: string;
  params: ListParams;
  topics: Topic[];
  basePath: string;
  /** Set on a topic page: the topic filter is fixed. */
  lockedTopic?: string;
}) {
  const limited = await checkRateLimit("search", viewerId);
  const result = limited.ok ? await listQuestions(viewerId, params) : { questions: [], total: 0, failed: false };
  const topicMap = new Map(topics.map((t) => [t.slug, t]));

  const hrefFor = (page: number, over: Partial<ListParams> = {}) => {
    const next = { ...params, page, ...over };
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (!value) continue;
      if (key === "page" && value === 1) continue;
      if (key === "filter" && value === "all") continue;
      if (key === "topic" && lockedTopic) continue;
      search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Question lists" className="flex flex-wrap gap-2">
        {QUESTION_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={hrefFor(1, { filter: f.value })}
            aria-current={params.filter === f.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              params.filter === f.value ? "border-maroon-700 bg-maroon-700 text-white" : "border-border bg-surface text-maroon-900/80 hover:bg-maroon-50",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <form role="search" aria-label="Search questions" action={basePath} method="get" className="grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[1fr_auto_auto]">
        {params.filter !== "all" ? <input type="hidden" name="filter" value={params.filter} /> : null}
        {!lockedTopic && params.topic ? <input type="hidden" name="topic" value={params.topic} /> : null}
        <div>
          <label htmlFor="forum-q" className={labelClass}>
            Search questions
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input id="forum-q" name="q" type="search" defaultValue={params.q} maxLength={80} placeholder="Words from a title or question" className={`${controlClass} pl-9`} />
          </div>
        </div>
        <div>
          <label htmlFor="forum-kind" className={labelClass}>
            Kind
          </label>
          <select id="forum-kind" name="kind" defaultValue={params.kind ?? ""} className={controlClass}>
            <option value="">Any kind</option>
            {QUESTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button type="submit" className="h-10 w-full rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
            Search
          </button>
        </div>
      </form>

      {!limited.ok ? (
        <p role="alert" className="text-sm text-destructive">
          {limited.message}
        </p>
      ) : result.failed ? (
        <p role="alert" className="text-sm text-destructive">
          Questions aren&apos;t loading right now. Please try again.
        </p>
      ) : result.questions.length === 0 ? (
        <EmptyState
          icon={MessageCircleQuestion}
          title={params.filter === "mine" ? "You haven't asked a question yet" : params.q ? "No questions match that search" : "No questions here yet"}
          description={
            params.filter === "following"
              ? "Follow a question to be told when it gets an answer."
              : params.q
                ? "Try different words or fewer filters."
                : "Be the first to ask. Medyra shows only real questions from members."
          }
          action={{ href: "/forums/ask", label: "Ask a question" }}
        />
      ) : (
        <section aria-label="Questions" className="space-y-3">
          <p className="text-sm text-muted-foreground" role="status">
            {result.total} {result.total === 1 ? "question" : "questions"}
          </p>
          <ul className="space-y-3">
            {result.questions.map((q) => (
              <li key={q.id}>
                <QuestionCard question={q} topics={topicMap} />
              </li>
            ))}
          </ul>
          <Pagination page={params.page} pageSize={FORUM_PAGE_SIZE} total={result.total} hrefFor={(p) => hrefFor(p)} label="Question pages" />
        </section>
      )}
    </div>
  );
}
