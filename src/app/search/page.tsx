import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/layout/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { requireMember } from "@/lib/auth/session";
import { avatarUrl } from "@/lib/storage-url";
import { FIELDS } from "@/features/onboarding/options";
import { cleanTerms, searchMembers, validField } from "@/features/home/search";

export const metadata: Metadata = {
  title: "Search members",
  robots: { index: false },
};

type Params = {
  q?: string | string[];
  field?: string | string[];
  mentors?: string | string[];
};
type Props = { searchParams: Promise<Params> };

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v;

export default function SearchPage({ searchParams }: Props) {
  return (
    <div className="min-h-dvh bg-sand/60 pb-20 md:pb-0">
      <Suspense
        fallback={
          <div role="status" className="flex min-h-dvh items-center justify-center">
            <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
            <span className="sr-only">Loading search</span>
          </div>
        }
      >
        <SearchContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function SearchContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const params = await searchParams;
  const q = (first(params.q) ?? "").slice(0, 60);
  const field = validField(first(params.field));
  const mentors = first(params.mentors) === "1";
  const searching = cleanTerms(q).length > 0 || Boolean(field) || mentors;

  const result = searching
    ? await searchMembers(user.id, { q, field, mentors })
    : { members: [] };

  const heading = mentors
    ? "Members open to mentoring"
    : field
      ? `Members in ${FIELDS.find((f) => f.value === field)?.label}`
      : q
        ? `Results for “${q}”`
        : "Search members";

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search finds Medoras members by name or username. Topics, posts, jobs
            and resources are not searchable yet.
            {mentors
              ? " Mentoring availability is self-reported and not verified."
              : ""}
          </p>
        </div>

        <form role="search" action="/search" method="get" className="flex gap-2">
          <label htmlFor="search-q" className="sr-only">
            Search members by name or username
          </label>
          <input
            id="search-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={60}
            placeholder="Name or username"
            className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Search className="size-4" aria-hidden="true" />
            Search
          </button>
        </form>

        {!searching ? (
          <EmptyState
            icon={Search}
            title="Find people to connect with"
            description="Type a name or username, or browse a field from the Explore fields card on your home page."
          />
        ) : "failed" in result && result.failed ? (
          <p role="alert" className="text-sm text-destructive">
            Search isn&apos;t working right now. Please try again.
          </p>
        ) : result.members.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No members found"
            description="Try a different spelling, or fewer words."
          />
        ) : (
          <ul aria-label="Search results" className="space-y-2">
            {result.members.map((m) => {
              const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
              return (
                <li key={m.id}>
                  <Link
                    href={`/profile/${m.username}`}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-maroon-200 hover:bg-maroon-50/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <MemberAvatar
                      name={m.first_name}
                      src={avatarUrl(m.avatar_path)}
                      className="size-11"
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-maroon-900">
                        {name}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        @{m.username}
                        {m.headline ? ` · ${m.headline}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
