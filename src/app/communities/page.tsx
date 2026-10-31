import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { LinkButton } from "@/components/ui/link-button";
import { controlClass, labelClass } from "@/components/forms/controls";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { cn } from "@/lib/utils";
import { CommunityCard } from "@/features/communities/components/community-card";
import { COMMUNITY_KINDS, COMMUNITY_PAGE_SIZE } from "@/features/communities/options";
import { listCommunities } from "@/features/communities/queries";
import { parseDirectoryParams } from "@/features/communities/schemas";

export const metadata: Metadata = {
  title: "Communities",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function CommunitiesPage({ searchParams }: Props) {
  return (
    <AppPage label="communities">
      <CommunitiesContent searchParams={searchParams} />
    </AppPage>
  );
}

async function CommunitiesContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const filters = parseDirectoryParams(await searchParams);

  const limited = await checkRateLimit("search", user.id);
  const result = limited.ok ? await listCommunities(user.id, filters) : { items: [], total: 0, failed: false };

  const hrefFor = (page: number, over: Partial<typeof filters> = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page, ...over })) {
      if (value && !(key === "page" && value === 1) && !(key === "scope" && value === "all")) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `/communities?${query}` : "/communities";
  };

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-maroon-900">Communities</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Groups for a profession, an institution, a research area or a region. Join one to talk with people who share your
              work, or start your own.
            </p>
          </div>
          <LinkButton href="/communities/create" className="h-10 px-4">
            <Plus className="size-4" aria-hidden="true" />
            Create a community
          </LinkButton>
        </div>

        <nav aria-label="Community lists" className="border-b border-border">
          <ul className="flex gap-1">
            {(
              [
                ["all", "Discover"],
                ["mine", "My communities"],
              ] as const
            ).map(([scope, label]) => (
              <li key={scope}>
                <Link
                  href={hrefFor(1, { scope })}
                  aria-current={filters.scope === scope ? "page" : undefined}
                  className={cn(
                    "-mb-px block border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    filters.scope === scope ? "border-maroon-600 text-maroon-700" : "border-transparent text-muted-foreground hover:text-maroon-900",
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <form role="search" aria-label="Find communities" action="/communities" method="get" className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
          {filters.scope === "mine" ? <input type="hidden" name="scope" value="mine" /> : null}
          <div>
            <label htmlFor="community-q" className={labelClass}>
              Search by name, description or institution
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input id="community-q" name="q" type="search" defaultValue={filters.q} maxLength={60} className={`${controlClass} pl-9`} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="community-kind" className={labelClass}>
                Kind
              </label>
              <select id="community-kind" name="kind" defaultValue={filters.kind ?? ""} className={controlClass}>
                <option value="">Any kind</option>
                {COMMUNITY_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="community-visibility" className={labelClass}>
                Access
              </label>
              <select id="community-visibility" name="visibility" defaultValue={filters.visibility ?? ""} className={controlClass}>
                <option value="">Public and private</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-10 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/85 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                Search
              </button>
              <Link href="/communities" className="inline-flex h-10 items-center rounded-lg px-3 text-sm text-muted-foreground hover:text-maroon-900">
                Clear
              </Link>
            </div>
          </div>
        </form>

        {!limited.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {limited.message}
          </p>
        ) : result.failed ? (
          <p role="alert" className="text-sm text-destructive">
            Communities aren&apos;t loading right now. Please try again.
          </p>
        ) : result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filters.scope === "mine" ? "You haven't joined a community yet" : "No communities found"}
            description={
              filters.scope === "mine"
                ? "Browse the directory and join one, or start a community for your profession, institution or region."
                : "Try fewer filters, or be the first to start one. Medyra shows only real communities created by members."
            }
            action={{ href: "/communities/create", label: "Create a community" }}
          />
        ) : (
          <section aria-label="Communities" className="space-y-3">
            <p className="text-sm text-muted-foreground" role="status">
              {result.total} {result.total === 1 ? "community" : "communities"}
            </p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {result.items.map((c) => (
                <li key={c.id}>
                  <CommunityCard community={c} />
                </li>
              ))}
            </ul>
            <Pagination page={filters.page} pageSize={COMMUNITY_PAGE_SIZE} total={result.total} hrefFor={(p) => hrefFor(p)} label="Community pages" />
          </section>
        )}
      </main>
    </>
  );
}
