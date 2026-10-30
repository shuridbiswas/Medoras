import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarUrl } from "@/lib/storage-url";
import { MuteButton } from "@/features/safety/components/mute-button";
import { listMutedMembers } from "@/features/safety/queries";

/** The members you muted, with a way to undo it. Only you can see this list. */
export async function MutedMembers({ viewerId }: { viewerId: string }) {
  const members = await listMutedMembers(viewerId);
  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven&apos;t muted anyone. Mute a member from their profile.</p>;
  }
  return (
    <ul aria-label="Muted members" className="divide-y divide-border">
      {members.map((m) => {
        const name = [m.first_name, m.last_name].filter(Boolean).join(" ");
        return (
          <li key={m.id} className="flex items-center gap-3 py-3">
            <MemberAvatar name={m.first_name} src={avatarUrl(m.avatar_path)} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-maroon-900">{name}</p>
              {m.username ? (
                <Link href={`/profile/${m.username}`} className="text-xs text-muted-foreground hover:underline">
                  @{m.username}
                </Link>
              ) : null}
            </div>
            <MuteButton memberId={m.id} name={name} muted variant="list" />
          </li>
        );
      })}
    </ul>
  );
}
