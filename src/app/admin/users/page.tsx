import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNav, AdminNotice } from "@/features/admin/components/admin-nav";
import { MemberStatusForm } from "@/features/admin/components/admin-forms";
import { ADMIN_PAGE_SIZE, personName, searchUsers } from "@/features/admin/queries";
import { cleanText } from "@/features/network/schemas";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Members",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ q?: string; page?: string }> };

export default function AdminUsersPage({ searchParams }: Props) {
  return (
    <AppPage label="members">
      <UsersContent searchParams={searchParams} />
    </AppPage>
  );
}

async function UsersContent({ searchParams }: Props) {
  const { user, profile } = await requireAdmin();
  const params = await searchParams;
  const q = cleanText(params.q);
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.min(Math.max(parsedPage, 1), 500) : 1;
  const { users, total, failed } = await searchUsers(q, page);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">Find a member, see their status, suspend or restore them.</p>
        </div>
        <AdminNav current="users" />
        <AdminNotice />

        <form role="search" action="/admin/users" method="get" className="flex gap-2">
          <label htmlFor="admin-q" className="sr-only">
            Search members by name or username
          </label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={60}
            placeholder="Name or username"
            className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <button type="submit" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
            <Search className="size-4" aria-hidden="true" />
            Search
          </button>
        </form>

        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            Members could not be loaded.
          </p>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No members found" description="Try a different spelling." />
        ) : (
          <ul className="space-y-3">
            {users.map((u) => {
              const name = personName(u);
              const isSelf = u.id === user.id;
              return (
                <li key={u.id} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-maroon-900">
                      {u.username ? (
                        <Link href={`/profile/${u.username}`} className="hover:underline">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                      {u.username ? <span className="ml-2 text-sm font-normal text-muted-foreground">@{u.username}</span> : null}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        u.status === "suspended" ? "bg-maroon-100 text-maroon-800" : "bg-sand text-muted-foreground",
                      )}
                    >
                      {u.status}
                    </span>
                  </div>
                  {u.status === "suspended" && u.reason ? <p className="text-sm text-muted-foreground">Reason: {u.reason}</p> : null}
                  {isSelf ? (
                    <p className="text-xs text-muted-foreground">This is you. You can&apos;t change your own status.</p>
                  ) : (
                    <details className="text-sm">
                      <summary className="cursor-pointer font-medium text-maroon-700">
                        {u.status === "suspended" ? "Restore this member" : "Suspend this member"}
                      </summary>
                      <div className="mt-3">
                        <MemberStatusForm memberId={u.id} status={u.status} name={name} />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          total={total}
          hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`}
          label="Member pages"
        />
      </main>
    </>
  );
}
