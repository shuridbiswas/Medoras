import {
  Bookmark,
  HeartHandshake,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { Container, SectionHeading } from "@/components/layout/section";

const topics = [
  "Nursing",
  "Social Work",
  "Placements",
  "Research",
  "Peer Support",
];

export function CommunityPreview() {
  return (
    <section
      id="preview"
      aria-labelledby="preview-heading"
      className="py-20 sm:py-28"
    >
      <Container>
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeading
            id="preview-heading"
            eyebrow="Community preview"
            title="A feed shaped around your journey."
          >
            A glimpse of the kind of home feed we are designing: stories,
            questions, opportunities and support in one calm place.
          </SectionHeading>
          <p className="w-fit rounded-full border border-clay/40 bg-clay/10 px-3.5 py-1.5 text-xs font-medium text-maroon-900">
            Illustrative preview. Not live activity.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-[15rem_1fr]">
          <aside
            aria-label="Example communities"
            className="hidden rounded-2xl border border-border bg-surface p-5 lg:block"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-maroon-700">
              Your communities
            </p>
            <ul className="mt-4 space-y-1">
              {topics.map((t, i) => (
                <li
                  key={t}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    i === 0
                      ? "bg-maroon-50 font-medium text-maroon-900"
                      : "text-muted-foreground"
                  }`}
                >
                  {t}
                </li>
              ))}
            </ul>
          </aside>

          <div className="space-y-4">
            <article className="rounded-2xl border border-border bg-surface p-6 shadow-[0_14px_40px_-26px_rgba(110,16,38,0.4)]">
              <PostMeta
                avatarClass="bg-maroon-100 text-maroon-800"
                initials="S"
                who="A third-year nursing student"
                kind="Story"
              />
              <h3 className="mt-4 text-xl font-semibold text-maroon-900">
                My first clinical placement, and what I wish I had known
              </h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-muted-foreground">
                I was convinced I was the only one who felt out of place. Here
                is what helped me in week one, and what I would tell the next
                student walking in.
              </p>
              <PostActions />
            </article>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-2xl border border-border bg-surface p-6">
                <PostMeta
                  avatarClass="bg-sand text-maroon-900"
                  initials="Q"
                  who="Anonymous member"
                  kind="Question"
                />
                <h3 className="mt-4 text-lg font-bold leading-snug text-maroon-900">
                  How did you prepare for your licensing exam while working?
                </h3>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Sparkles
                    className="size-4 text-maroon-600"
                    aria-hidden="true"
                  />
                  Answered by a verified professional
                </p>
              </article>

              <article className="rounded-2xl border border-maroon-200 bg-maroon-50 p-6">
                <PostMeta
                  avatarClass="bg-maroon-800 text-white"
                  initials="M"
                  who="A community mentor"
                  kind="Mentorship"
                />
                <h3 className="mt-4 text-lg font-bold leading-snug text-maroon-900">
                  Open to mentoring two students this term
                </h3>
                <p className="mt-3 flex items-center gap-2 text-sm text-maroon-900/75">
                  <HeartHandshake
                    className="size-4 text-maroon-700"
                    aria-hidden="true"
                  />
                  Social work, community and clinical settings
                </p>
              </article>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function PostMeta({
  avatarClass,
  initials,
  who,
  kind,
}: {
  avatarClass: string;
  initials: string;
  who: string;
  kind: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold ${avatarClass}`}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-maroon-900">{who}</p>
        <p className="text-xs text-muted-foreground">{kind}</p>
      </div>
    </div>
  );
}

function PostActions() {
  return (
    <div className="mt-5 flex items-center gap-5 border-t border-border pt-4 text-sm text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <HeartHandshake className="size-4" aria-hidden="true" /> Support
      </span>
      <span className="inline-flex items-center gap-1.5">
        <MessageCircle className="size-4" aria-hidden="true" /> Reply
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5">
        <Bookmark className="size-4" aria-hidden="true" /> Save
      </span>
    </div>
  );
}
