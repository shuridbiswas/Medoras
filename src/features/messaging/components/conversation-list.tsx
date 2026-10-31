import Link from "next/link";
import { Users } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { RelativeTime } from "@/components/relative-time";
import { avatarUrl } from "@/lib/storage-url";
import { conversationTitle, type ConversationSummary } from "@/features/messaging/types";
import { cn } from "@/lib/utils";

/** The inbox. Each row is a real link; unread conversations are bold and carry a count. */
export function ConversationList({ items, activeId }: { items: ConversationSummary[]; activeId?: string }) {
  return (
    <ul aria-label="Conversations" className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {items.map((c) => {
        const title = conversationTitle(c);
        const first = c.others[0];
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              aria-current={c.id === activeId ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-maroon-50/60 focus-visible:bg-maroon-50 focus-visible:outline-none",
                c.id === activeId && "bg-maroon-50",
              )}
            >
              {c.kind === "group" ? (
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-maroon-100 text-maroon-700">
                  <Users className="size-5" />
                </span>
              ) : (
                <MemberAvatar name={first?.first_name ?? "?"} src={avatarUrl(first?.avatar_path ?? null)} className="size-11" />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn("truncate text-sm", c.unread > 0 ? "font-bold text-maroon-900" : "font-semibold text-maroon-900")}>{title}</span>
                  {c.last ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <RelativeTime iso={c.last.created_at} />
                    </span>
                  ) : null}
                </span>
                <span className={cn("block truncate text-sm", c.unread > 0 ? "text-maroon-900" : "text-muted-foreground")}>
                  {c.last ? `${c.last.mine ? "You: " : ""}${c.last.body}` : "No messages yet"}
                </span>
              </span>
              {c.unread > 0 ? (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-maroon-700 px-1.5 text-xs font-semibold text-white">
                  <span aria-hidden="true">{c.unread > 99 ? "99+" : c.unread}</span>
                  <span className="sr-only">{c.unread} unread {c.unread === 1 ? "message" : "messages"}</span>
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
