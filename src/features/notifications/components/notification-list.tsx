"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { avatarUrl } from "@/lib/storage-url";
import {
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/features/notifications/actions";
import {
  actorName,
  describeAction,
  notificationHref,
  type NotificationItem,
} from "@/features/notifications/format";
import { cn } from "@/lib/utils";

/**
 * The notification inbox. Each row reads "<name> <what happened>" and links to where it
 * happened; no post or comment text is ever shown. Opening a row marks it read.
 */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [read, setRead] = useState<ReadonlySet<string>>(new Set());
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = items.filter((n) => !removed.has(n.id));
  const isRead = (n: NotificationItem) => Boolean(n.read_at) || read.has(n.id);
  const unread = visible.filter((n) => !isRead(n)).length;

  function open(n: NotificationItem) {
    const href = notificationHref(n);
    if (isRead(n)) return router.push(href);
    setRead((s) => new Set(s).add(n.id));
    startTransition(async () => {
      await markNotificationRead(n.id);
      router.push(href);
      router.refresh();
    });
  }

  function markAll() {
    setError(null);
    startTransition(async () => {
      const result = await markAllNotificationsRead();
      if (result.ok) {
        setRead(new Set(items.map((n) => n.id)));
        router.refresh();
      } else setError(result.error);
    });
  }

  function remove(n: NotificationItem) {
    setError(null);
    startTransition(async () => {
      const result = await deleteNotification(n.id);
      if (result.ok) {
        setRemoved((s) => new Set(s).add(n.id));
        router.refresh();
      } else setError(result.error);
    });
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="You're all caught up"
        description="Connection requests, replies and comments on your posts will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          {unread > 0 ? `${unread} unread` : "Everything is read"}
        </p>
        <Button
          type="button"
          variant="outline"
          disabled={pending || unread === 0}
          onClick={markAll}
          className="h-9 px-3 text-sm"
        >
          <CheckCheck className="size-4" aria-hidden="true" />
          Mark all as read
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul aria-label="Notifications" className="overflow-hidden rounded-2xl border border-border bg-surface">
        {visible.map((n) => {
          const unreadRow = !isRead(n);
          const name = actorName(n.actor);
          return (
            <li
              key={n.id}
              className={cn(
                "flex items-start gap-3 border-b border-border p-4 last:border-b-0",
                unreadRow && "bg-maroon-50/60",
              )}
            >
              <MemberAvatar
                name={n.actor?.first_name ?? "?"}
                src={avatarUrl(n.actor?.avatar_path ?? null)}
                className="size-10"
              />
              <button
                type="button"
                onClick={() => open(n)}
                className="min-w-0 flex-1 rounded-md text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="block text-sm text-maroon-900">
                  <span className="font-semibold">{name}</span> {describeAction(n.type)}
                </span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <RelativeTime iso={n.created_at} />
                  {unreadRow ? (
                    <span className="rounded-full bg-maroon-700 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
                      New
                    </span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => remove(n)}
                disabled={pending}
                aria-label={`Dismiss notification from ${name}`}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-maroon-50 hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Notifications never include the text of posts or comments. Change which ones you receive in{" "}
        <Link href="/settings#notifications" className="font-medium text-maroon-700 underline-offset-4 hover:underline">
          Settings
        </Link>
        .
      </p>
    </div>
  );
}
