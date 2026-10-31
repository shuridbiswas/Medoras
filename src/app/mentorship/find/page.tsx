import type { Metadata } from "next";
import Link from "next/link";
import { Search, UsersRound } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { controlClass, labelClass } from "@/components/forms/controls";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { FIELDS } from "@/features/onboarding/options";
import { MentorCard, MentorshipLimits, MentorshipTabs } from "@/features/mentorship/components/shared";
import { EXPERIENCE_FILTERS, MENTOR_FORMATS, MENTOR_PAGE_SIZE } from "@/features/mentorship/options";
import { listMentors } from "@/features/mentorship/queries";
import { parseMentorFilters } from "@/features/mentorship/schemas";

export const metadata: Metadata = {
  title: "Find a mentor",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function FindMentorPage({ searchParams }: Props) {
  return (
    <AppPage label="mentors">
      <FindContent searchParams={searchParams} />
    </AppPage>
  );
}

async function FindContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const filters = parseMentorFilters(await searchParams);
  const limited = await checkRateLimit("search", user.id);
  const result = limited.ok ? await listMentors(user.id, filters) : { mentors: [], total: 0, failed: false };

  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page })) {
      if (value && !(key === "page" && value === 1)) params.set(key === "minYears" ? "years" : key, String(value));
    }
    const query = params.toString();
    return query ? `/mentorship/find?${query}` : "/mentorship/find";
  };

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-maroon-900">Find a mentor</h1>
        <MentorshipTabs current="find" />
        <MentorshipLimits compact />

        <form role="search" aria-label="Find mentors" action="/mentorship/find" method="get" className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          <div>
            <label htmlFor="mentor-q" className={labelClass}>
              Search expertise, background or organisation
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="mentor-q" name="q" type="search" defaultValue={filters.q} maxLength={60} className={`${controlClass} pl-9`} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="mentor-field" className={labelClass}>Profession</label>
              <select id="mentor-field" name="field" defaultValue={filters.field ?? ""} className={controlClass}>
                <option value="">Any profession</option>
                {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mentor-topic" className={labelClass}>Topic (exact word)</label>
              <input id="mentor-topic" name="topic" defaultValue={filters.topic} maxLength={40} placeholder="for example placements" className={controlClass} />
            </div>
            <div>
              <label htmlFor="mentor-language" className={labelClass}>Language</label>
              <input id="mentor-language" name="language" defaultValue={filters.language} maxLength={30} placeholder="for example french" className={controlClass} />
            </div>
            <div>
              <label htmlFor="mentor-years" className={labelClass}>Experience</label>
              <select id="mentor-years" name="years" defaultValue={filters.minYears ? String(filters.minYears) : ""} className={controlClass}>
                <option value="">Any</option>
                {EXPERIENCE_FILTERS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="mentor-format" className={labelClass}>Session format</label>
              <select id="mentor-format" name="format" defaultValue={filters.format ?? ""} className={controlClass}>
                <option value="">Any format</option>
                {MENTOR_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">Search</button>
              <Link href="/mentorship/find" className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-maroon-900">Clear</Link>
            </div>
          </div>
        </form>

        {!limited.ok ? (
          <p role="alert" className="text-sm text-destructive">{limited.message}</p>
        ) : result.failed ? (
          <p role="alert" className="text-sm text-destructive">Mentors aren&apos;t loading right now. Please try again.</p>
        ) : result.mentors.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No mentors found"
            description="Try fewer filters. Only real members who chose to list themselves appear here, and listings are paused while a mentor is full."
            action={{ href: "/mentorship/become-a-mentor", label: "Become a mentor" }}
          />
        ) : (
          <section aria-label="Mentors" className="space-y-3">
            <p className="text-sm text-muted-foreground" role="status">
              {result.total} {result.total === 1 ? "mentor" : "mentors"} accepting requests
            </p>
            <ul className="space-y-3">
              {result.mentors.map((m) => (
                <li key={m.user_id}>
                  <MentorCard mentor={m} />
                </li>
              ))}
            </ul>
            <Pagination page={filters.page} pageSize={MENTOR_PAGE_SIZE} total={result.total} hrefFor={hrefFor} label="Mentor pages" />
          </section>
        )}
      </main>
    </>
  );
}
