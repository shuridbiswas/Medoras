import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarUrl } from "@/lib/storage-url";
import { BlockButton } from "@/features/network/components/block-button";
import { listBlockedMembers } from "@/features/network/queries";

/** The members you blocked, with a way to undo it. Only you can see this list. */
export async function BlockedMembers({ viewerId }: { viewerId: string }) {
  const members = await listBlockedMembers(viewerId);

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        You haven&apos;t blocked anyone. You can block a member from their profile.
      </p>
    );
  }

  return (
    <ul aria-label="Blocked members" className="divide-y divide-border">
      {members.map((m) => {
        const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
        return (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <MemberAvatar name={m.first_name} src={avatarUrl(m.avatar_path)} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-maroon-900">{name}</p>
              {m.username ? (
                <Link
                  href={`/profile/${m.username}`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  @{m.username}
                </Link>
              ) : null}
            </div>
            <BlockButton memberId={m.id} name={name} blocked />
          </li>
        );
      })}
    </ul>
  );
}
