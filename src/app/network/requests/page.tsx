import type { Metadata } from "next";
import { Inbox, Send } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { requireMember } from "@/lib/auth/session";
import { MemberCard } from "@/features/network/components/member-card";
import { NetworkTabs } from "@/features/network/components/network-tabs";
import { getRelationships, listRequests } from "@/features/network/queries";
import { noRelationship } from "@/features/network/types";

export const metadata: Metadata = {
  title: "Connection requests",
  robots: { index: false },
};

export default function RequestsPage() {
  return (
    <AppPage label="your requests">
      <RequestsContent />
    </AppPage>
  );
}

async function RequestsContent() {
  const { user, profile } = await requireMember();
  const [incoming, outgoing] = await Promise.all([
    listRequests(user.id, "incoming"),
    listRequests(user.id, "outgoing"),
  ]);
  // The real state of each pair, including whether the viewer also follows them.
  const relationships = await getRelationships(user.id, [
    ...incoming.requests.map((r) => r.member.id),
    ...outgoing.requests.map((r) => r.member.id),
  ]);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Connection requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accepting is mutual: you are connected only when both of you agree. Following is
            separate and needs no approval.
          </p>
        </div>
        <NetworkTabs current="requests" userId={user.id} />

        <section aria-labelledby="incoming" className="space-y-3">
          <h2 id="incoming" className="text-lg font-bold text-maroon-900">
            Received
          </h2>
          {incoming.failed ? (
            <p role="alert" className="text-sm text-destructive">
              We couldn&apos;t load your requests. Please refresh.
            </p>
          ) : incoming.requests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No requests waiting"
              description="When someone asks to connect, you will see it here and in your notifications."
            />
          ) : (
            <ul className="space-y-3">
              {incoming.requests.map((r) => (
                <li key={r.id}>
                  <p className="mb-1 text-xs text-muted-foreground">
                    Sent <RelativeTime iso={r.created_at} />
                  </p>
                  <MemberCard
                    member={r.member}
                    relationship={relationships.get(r.member.id) ?? noRelationship}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="outgoing" className="space-y-3">
          <h2 id="outgoing" className="text-lg font-bold text-maroon-900">
            Sent
          </h2>
          {outgoing.failed ? (
            <p role="alert" className="text-sm text-destructive">
              We couldn&apos;t load your sent requests. Please refresh.
            </p>
          ) : outgoing.requests.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No pending requests"
              description="Requests you send stay here until the other person answers. You can withdraw them any time."
            />
          ) : (
            <ul className="space-y-3">
              {outgoing.requests.map((r) => (
                <li key={r.id}>
                  <MemberCard
                    member={r.member}
                    relationship={relationships.get(r.member.id) ?? noRelationship}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
