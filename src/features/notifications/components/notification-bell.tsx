import Link from "next/link";
import { Bell } from "lucide-react";
import { getUnreadCount } from "@/features/notifications/queries";
import { cn } from "@/lib/utils";

const bellClass =
  "relative inline-flex size-10 items-center justify-center rounded-full text-maroon-900/80 transition-colors hover:bg-maroon-50 hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** The header indicator. A failure to count shows the bell without a badge, never an error. */
export function BellLink({ unread = 0 }: { unread?: number }) {
  const label =
    unread > 0
      ? `Notifications, ${unread} unread`
      : "Notifications";
  return (
    <Link href="/notifications" aria-label={label} className={bellClass}>
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-1 right-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-maroon-700 px-1 text-[0.65rem] leading-4.5 font-bold text-white ring-2 ring-surface",
          )}
        >
          {unread > 9 ? "9+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

export async function NotificationBell({ userId }: { userId: string }) {
  return <BellLink unread={await getUnreadCount(userId)} />;
}
