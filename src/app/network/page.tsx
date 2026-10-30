import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { DirectoryFiltersForm } from "@/features/network/components/directory-filters";
import { MemberCard } from "@/features/network/components/member-card";
import { NetworkTabs } from "@/features/network/components/network-tabs";
import { DIRECTORY_PAGE_SIZE } from "@/features/network/options";
import { getRelationships, searchDirectory } from "@/features/network/queries";
import { parseDirectoryParams } from "@/features/network/schemas";

export const metadata: Metadata = {
  title: "Network",
  robots: { index: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function NetworkPage({ searchParams }: Props) {
  return (
    <AppPage label="the member directory">
      <NetworkContent searchParams={searchParams} />
    </AppPage>
  );
}

async function NetworkContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const filters = parseDirectoryParams(await searchParams);

  const limited = await checkRateLimit("search", user.id);
  const result = limited.ok
    ? await searchDirectory(user.id, filters)
    : { members: [], total: 0, failed: false };
  const relationships = await getRelationships(
    user.id,
    result.members.map((m) => m.id),
  );

  // Keep every active filter in the page links.
  const hrefFor = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page })) {
      if (value && !(key === "page" && value === 1)) params.set(key, String(value));
    }
    const query = params.toString();
    return query ? `/network?${query}` : "/network";
  };

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Network</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Find students, professionals and researchers across healthcare and social services.
          </p>
        </div>
        <NetworkTabs current="discover" userId={user.id} />
        <DirectoryFiltersForm filters={filters} />

        {!limited.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {limited.message}
          </p>
        ) : result.failed ? (
          <p role="alert" className="text-sm text-destructive">
            The directory isn&apos;t working right now. Please try again.
          </p>
        ) : result.members.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No members found"
            description="Try fewer filters or a different spelling. Members appear here once they finish joining."
          />
        ) : (
          <section aria-label="Members" className="space-y-3">
            <p className="text-sm text-muted-foreground" role="status">
              {result.total} {result.total === 1 ? "member" : "members"}
            </p>
            <ul className="space-y-3">
              {result.members.map((m) => (
                <li key={m.id}>
                  <MemberCard member={m} relationship={relationships.get(m.id)} />
                </li>
              ))}
            </ul>
            <Pagination
              page={filters.page}
              pageSize={DIRECTORY_PAGE_SIZE}
              total={result.total}
              hrefFor={hrefFor}
              label="Directory pages"
            />
          </section>
        )}
      </main>
    </>
  );
}
