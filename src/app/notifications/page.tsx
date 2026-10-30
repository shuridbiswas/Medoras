import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { Pagination } from "@/components/layout/pagination";
import { requireMember } from "@/lib/auth/session";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { NOTIFICATION_PAGE_SIZE } from "@/features/notifications/format";
import { listNotifications } from "@/features/notifications/queries";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false },
};

type Props = { searchParams: Promise<{ page?: string | string[] }> };

export default function NotificationsPage({ searchParams }: Props) {
  return (
    <AppPage label="your notifications">
      <NotificationsContent searchParams={searchParams} />
    </AppPage>
  );
}

async function NotificationsContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const raw = (await searchParams).page;
  const parsed = Number.parseInt((Array.isArray(raw) ? raw[0] : raw) ?? "1", 10);
  const page = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 1;

  const result = await listNotifications(user.id, page);
  const key = `${page}:${result.items.map((n) => `${n.id}:${n.read_at ?? ""}`).join(",")}`;

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connection requests, replies and comments. Only you can see these.
          </p>
        </div>

        {result.failed ? (
          <p role="alert" className="text-sm text-destructive">
            We couldn&apos;t load your notifications. Please refresh.
          </p>
        ) : (
          <>
            <NotificationList key={key} items={result.items} />
            <Pagination
              page={page}
              pageSize={NOTIFICATION_PAGE_SIZE}
              total={result.total}
              hrefFor={(p) => (p === 1 ? "/notifications" : `/notifications?page=${p}`)}
              label="Notification pages"
            />
          </>
        )}
      </main>
    </>
  );
}
