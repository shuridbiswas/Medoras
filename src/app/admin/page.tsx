import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { RelativeTime } from "@/components/relative-time";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNav, AdminNotice } from "@/features/admin/components/admin-nav";
import { DeletionButton, RetentionForm } from "@/features/admin/components/admin-forms";
import {
  getAdminSummary,
  listAudit,
  listDeletionRequests,
  listRetention,
  personName,
} from "@/features/admin/queries";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <AppPage label="the admin area">
      <AdminContent />
    </AppPage>
  );
}

const card = "rounded-2xl border border-border bg-surface p-5";

async function AdminContent() {
  const { profile } = await requireAdmin();
  const [summary, audit, deletions, retention] = await Promise.all([
    getAdminSummary(),
    listAudit(25),
    listDeletionRequests(),
    listRetention(),
  ]);
  const stats = [
    { label: "Open reports", value: summary.open, href: "/admin/reports?status=open" },
    { label: "In review", value: summary.reviewing, href: "/admin/reports?status=reviewing" },
    { label: "Open appeals", value: summary.appeals, href: "/admin/reports#appeals" },
    { label: "Suspended members", value: summary.suspended, href: "/admin/users" },
    { label: "Deletion requests", value: summary.deletions, href: "#deletions" },
  ];

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">Moderation, member status and data requests.</p>
        </div>
        <AdminNav current="overview" />
        <AdminNotice />

        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <li key={s.label}>
              <Link href={s.href} className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-maroon-200 hover:bg-maroon-50/50">
                <span className="block text-2xl font-bold text-maroon-900">{s.value}</span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <section id="deletions" aria-labelledby="deletions-title" className={card}>
          <h2 id="deletions-title" className="text-lg font-bold text-maroon-900">
            Account deletion requests
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Members can cancel during a 30-day cooling-off period. Carrying one out permanently deletes the account and
            everything it owns. A scheduled job to do this automatically is not set up.
          </p>
          {deletions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open requests.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {deletions.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    <span className="font-semibold text-maroon-900">{personName(d.member)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      asked <RelativeTime iso={d.requested_at} />, due {new Date(d.scheduled_for).toLocaleDateString("en-CA")}
                    </span>
                  </span>
                  <DeletionButton requestId={d.id} due={d.due} name={personName(d.member)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="retention-title" className={card}>
          <h2 id="retention-title" className="text-lg font-bold text-maroon-900">
            Retention
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How long operational data is kept. The purge itself (<code>private.run_retention_purge()</code>) must be
            scheduled by the database owner; it is not scheduled yet.
          </p>
          <div className="mt-3 space-y-4">
            {retention.map((p) => (
              <RetentionForm key={p.key} policy={p} />
            ))}
          </div>
        </section>

        <section aria-labelledby="audit-title" className={card}>
          <h2 id="audit-title" className="text-lg font-bold text-maroon-900">
            Audit log
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The latest staff actions. Entries contain ids and decisions, never post or comment text. They cannot be
            edited or deleted.
          </p>
          {audit.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-border text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                  <span>
                    <code className="text-maroon-800">{a.action}</code>{" "}
                    <span className="text-muted-foreground">by {a.actor ? personName(a.actor) : "the system"}</span>
                  </span>
                  <RelativeTime iso={a.created_at} className="text-xs text-muted-foreground" />
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </>
  );
}
