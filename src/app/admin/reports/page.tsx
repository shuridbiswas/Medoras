import type { Metadata } from "next";
import Link from "next/link";
import { Flag } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { RelativeTime } from "@/components/relative-time";
import { requireAdmin } from "@/lib/auth/session";
import { AdminNav, AdminNotice } from "@/features/admin/components/admin-nav";
import { AppealDecisionForm, ClaimButton, ReportDecisionForm } from "@/features/admin/components/admin-forms";
import { ADMIN_PAGE_SIZE, listAppeals, listReports, personName } from "@/features/admin/queries";
import { REPORT_FILTERS, parseReportFilter } from "@/features/admin/schemas";
import { reportReasonLabel } from "@/features/safety/options";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ status?: string; page?: string }> };

export default function AdminReportsPage({ searchParams }: Props) {
  return (
    <AppPage label="the report queue">
      <ReportsContent searchParams={searchParams} />
    </AppPage>
  );
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-maroon-100 text-maroon-800",
  reviewing: "bg-amber-100 text-amber-900",
  actioned: "bg-sand text-maroon-900",
  dismissed: "bg-sand text-muted-foreground",
};

async function ReportsContent({ searchParams }: Props) {
  const { profile } = await requireAdmin();
  const params = await searchParams;
  const filter = parseReportFilter(params.status);
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const page = Number.isFinite(parsedPage) ? Math.min(Math.max(parsedPage, 1), 500) : 1;
  const [{ reports, total, failed }, appeals] = await Promise.all([listReports(filter, page), listAppeals("open")]);

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review what members reported and record a decision.</p>
        </div>
        <AdminNav current="reports" />
        <AdminNotice />

        <nav aria-label="Report filter" className="flex flex-wrap gap-2">
          {REPORT_FILTERS.map((f) => (
            <Link
              key={f}
              href={`/admin/reports?status=${f}`}
              aria-current={f === filter ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium capitalize",
                f === filter ? "border-maroon-700 bg-maroon-700 text-white" : "border-border bg-surface text-maroon-900/80 hover:bg-maroon-50",
              )}
            >
              {f}
            </Link>
          ))}
        </nav>

        {failed ? (
          <p role="alert" className="text-sm text-destructive">
            The queue could not be loaded.
          </p>
        ) : reports.length === 0 ? (
          <EmptyState icon={Flag} title="Nothing here" description="No reports match this filter." />
        ) : (
          <ul className="space-y-4">
            {reports.map((r) => {
              const live = r.status === "open" || r.status === "reviewing";
              const targetHref =
                r.target_type === "post"
                  ? `/post/${r.target_id}`
                  : r.target_type === "profile" && r.target?.username
                    ? `/profile/${r.target.username}`
                    : null;
              return (
                <li key={r.id} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-maroon-900">
                      {reportReasonLabel(r.reason)}{" "}
                      <span className="font-normal text-muted-foreground">on a {r.target_type}</span>
                    </p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_STYLE[r.status])}>{r.status}</span>
                  </div>
                  <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-muted-foreground">Reported by</dt>
                      <dd>{personName(r.reporter)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">About</dt>
                      <dd>
                        {personName(r.target)}
                        {r.target?.username ? <span className="text-muted-foreground"> @{r.target.username}</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Filed</dt>
                      <dd>
                        <RelativeTime iso={r.created_at} />
                      </dd>
                    </div>
                  </dl>
                  {r.excerpt ? (
                    <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-maroon-200 bg-sand/60 px-3 py-2 text-sm text-maroon-900/90">
                      {r.excerpt}
                    </blockquote>
                  ) : null}
                  {r.details ? (
                    <p className="text-sm">
                      <span className="text-xs text-muted-foreground">Reporter&apos;s note: </span>
                      {r.details}
                    </p>
                  ) : null}
                  {targetHref ? (
                    <Link href={targetHref} className="text-sm font-medium text-maroon-700 underline-offset-4 hover:underline">
                      Open the {r.target_type}
                    </Link>
                  ) : r.target_type === "comment" ? (
                    <p className="text-xs text-muted-foreground">Comment (shown above as it was when reported).</p>
                  ) : null}

                  {r.status === "open" ? <ClaimButton reportId={r.id} /> : null}
                  {live ? <ReportDecisionForm reportId={r.id} targetType={r.target_type} /> : null}
                </li>
              );
            })}
          </ul>
        )}
        <Pagination
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          total={total}
          hrefFor={(p) => `/admin/reports?status=${filter}&page=${p}`}
          label="Report pages"
        />

        <section id="appeals" aria-labelledby="appeals-title" className="space-y-3">
          <h2 id="appeals-title" className="text-lg font-bold text-maroon-900">
            Open appeals
          </h2>
          {appeals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appeals waiting.</p>
          ) : (
            <ul className="space-y-4">
              {appeals.map((a) => (
                <li key={a.id} className="space-y-3 rounded-2xl border border-border bg-surface p-5 text-sm">
                  <p className="font-semibold text-maroon-900">
                    {personName(a.member)}
                    <span className="ml-2 font-normal text-muted-foreground">
                      appealed <RelativeTime iso={a.created_at} />
                    </span>
                  </p>
                  {a.notice ? (
                    <p className="text-muted-foreground">
                      <span className="text-xs">Decision they&apos;re appealing ({a.notice.kind.replace(/_/g, " ")}): </span>
                      {a.notice.message}
                    </p>
                  ) : null}
                  <blockquote className="whitespace-pre-wrap rounded-lg border-l-4 border-maroon-200 bg-sand/60 px-3 py-2">{a.message}</blockquote>
                  <AppealDecisionForm appealId={a.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
