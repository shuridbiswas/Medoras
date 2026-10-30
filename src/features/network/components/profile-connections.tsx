import Link from "next/link";
import { UsersRound } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { MemberCard } from "@/features/network/components/member-card";
import { listConnections } from "@/features/network/queries";

const SHOWN = 24;

/** A member's accepted connections, for the Connections tab of their profile. */
export async function ProfileConnections({
  profileId,
  isOwner,
  firstName,
}: {
  profileId: string;
  isOwner: boolean;
  firstName: string;
}) {
  const { members, total, failed } = await listConnections(profileId, 1, SHOWN);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We couldn&apos;t load connections right now. Please refresh.
      </p>
    );
  }
  if (members.length === 0) {
    return (
      <EmptyState
        icon={UsersRound}
        title={isOwner ? "No connections yet" : `${firstName} has no connections yet`}
        description={
          isOwner
            ? "Find people in the directory and send a request. They appear here once they accept."
            : "Connections appear here once two members have both agreed."
        }
        action={isOwner ? { href: "/network", label: "Find members" } : undefined}
      />
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {members.map((m) => (
          <li key={m.id}>
            <MemberCard member={m} actions={false} />
          </li>
        ))}
      </ul>
      {total > members.length ? (
        <p className="text-sm text-muted-foreground">
          Showing {members.length} of {total}.{" "}
          {isOwner ? (
            <Link
              href="/network/connections"
              className="font-medium text-maroon-700 underline-offset-4 hover:underline"
            >
              See all
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
