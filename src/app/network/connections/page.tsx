import type { Metadata } from "next";
import { UsersRound } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { requireMember } from "@/lib/auth/session";
import { MemberCard } from "@/features/network/components/member-card";
import { NetworkTabs } from "@/features/network/components/network-tabs";
import { CONNECTIONS_PAGE_SIZE } from "@/features/network/options";
import {
  getNetworkCounts,
  getRelationships,
  listConnections,
} from "@/features/network/queries";

export const metadata: Metadata = {
  title: "Your connections",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export default function ConnectionsPage({ searchParams }: Props) {
  return (
    <AppPage label="your connections">
      <ConnectionsContent searchParams={searchParams} />
    </AppPage>
  );
}

async function ConnectionsContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const raw = (await searchParams).page;
  const parsed = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? "1", 10);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 1;

  const [list, counts] = await Promise.all([
    listConnections(user.id, page),
    getNetworkCounts(user.id),
  ]);
  const relationships = await getRelationships(
    user.id,
    list.members.map((m) => m.id),
  );

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Your connections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.connections} {counts.connections === 1 ? "connection" : "connections"} ·{" "}
            {counts.followers} {counts.followers === 1 ? "follower" : "followers"} ·{" "}
            {counts.following} following
          </p>
        </div>
        <NetworkTabs current="connections" userId={user.id} />

        {list.failed ? (
          <p role="alert" className="text-sm text-destructive">
            We couldn&apos;t load your connections. Please refresh.
          </p>
        ) : list.members.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No connections yet"
            description="Find people in the directory and send a request. They appear here once they accept."
            action={{ href: "/network", label: "Find members" }}
          />
        ) : (
          <section aria-label="Connections" className="space-y-3">
            <ul className="space-y-3">
              {list.members.map((m) => (
                <li key={m.id}>
                  <MemberCard member={m} relationship={relationships.get(m.id)} />
                </li>
              ))}
            </ul>
            <Pagination
              page={page}
              pageSize={CONNECTIONS_PAGE_SIZE}
              total={list.total}
              hrefFor={(p) => (p === 1 ? "/network/connections" : `/network/connections?page=${p}`)}
              label="Connection pages"
            />
          </section>
        )}
      </main>
    </>
  );
}
