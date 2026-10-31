import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { Pagination } from "@/components/layout/pagination";
import { RelativeTime } from "@/components/relative-time";
import { requireMember } from "@/lib/auth/session";
import { CommunityForm } from "@/features/communities/components/community-form";
import { MemberRow } from "@/features/communities/components/member-row";
import { MemberControls, RequestButtons, RestoreButton } from "@/features/communities/components/staff-controls";
import {
  AUDIT_ACTION_LABELS,
  AUDIT_PAGE_SIZE,
  MEMBERS_PAGE_SIZE,
  removalReasonLabel,
} from "@/features/communities/options";
import {
  getCommunityBySlug,
  listAuditLog,
  listBans,
  listCommunityMembers,
  listJoinRequests,
} from "@/features/communities/queries";

export const metadata: Metadata = {
  title: "Community members",
  robots: { index: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function MembersPage({ params, searchParams }: Props) {
  return (
    <AppPage label="the member list">
      <MembersContent params={params} searchParams={searchParams} />
    </AppPage>
  );
}

const pageNumber = (v: string | string[] | undefined) => {
  const n = Number.parseInt((Array.isArray(v) ? v[0] : v) ?? "1", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), 500) : 1;
};

async function MembersContent({ params, searchParams }: Props) {
  const { slug } = await params;
  const query = await searchParams;
  const { user, profile } = await requireMember();
  const community = await getCommunityBySlug(user.id, slug);
  if (!community) notFound();

  const role = community.role;
  const isStaff = role === "owner" || role === "moderator";
  const canRead = community.visibility === "public" || role !== null;
  const base = `/communities/${community.slug}/members`;

  const page = pageNumber(query.page);
  const logPage = pageNumber(query.log);
  const [list, requests, bans, audit] = canRead
    ? await Promise.all([
        listCommunityMembers(user.id, community.id, page),
        isStaff ? listJoinRequests(community.id) : Promise.resolve([]),
        isStaff ? listBans(community.id) : Promise.resolve([]),
        isStaff ? listAuditLog(community.id, logPage) : Promise.resolve({ entries: [], total: 0 }),
      ])
    : [null, [], [], { entries: [], total: 0 }];

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <Link href={`/communities/${community.slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {community.name}
        </Link>
        <h1 className="text-2xl font-bold text-maroon-900">Members</h1>

        {!list ? (
          <EmptyState
            icon={Lock}
            title="The member list is private"
            description="Only members of a private community can see who else belongs. Ask to join from the community page."
            action={{ href: `/communities/${community.slug}`, label: "Back to the community" }}
          />
        ) : list.failed ? (
          <p role="alert" className="text-sm text-destructive">
            We couldn&apos;t load the members. Please try again.
          </p>
        ) : (
          <>
            {isStaff && requests.length > 0 ? (
              <section aria-labelledby="requests-heading" className="space-y-3">
                <h2 id="requests-heading" className="text-lg font-semibold text-maroon-900">
                  Requests to join ({requests.length})
                </h2>
                <ul className="space-y-3">
                  {requests.map((r) => (
                    <li key={r.id}>
                      <MemberRow member={r.member}>
                        <RequestButtons requestId={r.id} name={r.member.first_name} />
                      </MemberRow>
                      {r.message ? (
                        <p className="mt-1.5 rounded-lg bg-sand/60 px-3 py-2 text-sm whitespace-pre-wrap text-maroon-900/90">{r.message}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="staff-heading" className="space-y-3">
              <h2 id="staff-heading" className="text-lg font-semibold text-maroon-900">
                Owner and moderators
              </h2>
              {list.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No moderators are listed.</p>
              ) : (
                <ul className="space-y-3">
                  {list.staff.map((s) => (
                    <li key={s.member.id}>
                      <MemberRow member={s.member} role={s.role}>
                        {isStaff && role && s.member.id !== user.id ? (
                          <MemberControls communityId={community.id} memberId={s.member.id} name={s.member.first_name} targetRole={s.role} viewerRole={role} />
                        ) : null}
                      </MemberRow>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="members-heading" className="space-y-3">
              <h2 id="members-heading" className="text-lg font-semibold text-maroon-900">
                Members ({list.total})
              </h2>
              {list.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No other members yet.</p>
              ) : (
                <ul className="space-y-3">
                  {list.members.map((m) => (
                    <li key={m.member.id}>
                      <MemberRow member={m.member} role={m.role}>
                        {isStaff && role && m.member.id !== user.id ? (
                          <MemberControls communityId={community.id} memberId={m.member.id} name={m.member.first_name} targetRole={m.role} viewerRole={role} />
                        ) : null}
                      </MemberRow>
                    </li>
                  ))}
                </ul>
              )}
              <Pagination page={page} pageSize={MEMBERS_PAGE_SIZE} total={list.total} hrefFor={(p) => (p === 1 ? base : `${base}?page=${p}`)} label="Member pages" />
            </section>

            {isStaff ? (
              <>
                {bans.length > 0 ? (
                  <section aria-labelledby="bans-heading" className="space-y-3">
                    <h2 id="bans-heading" className="text-lg font-semibold text-maroon-900">
                      Removed members
                    </h2>
                    <ul className="space-y-3">
                      {bans.map((b) => (
                        <li key={b.member.id}>
                          <MemberRow member={b.member}>
                            <div className="text-right">
                              <p className="mb-1 text-xs text-muted-foreground">{removalReasonLabel(b.reason)}</p>
                              <RestoreButton communityId={community.id} memberId={b.member.id} name={b.member.first_name} />
                            </div>
                          </MemberRow>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section aria-labelledby="log-heading" className="space-y-3">
                  <h2 id="log-heading" className="text-lg font-semibold text-maroon-900">
                    Moderator log
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Every moderator action is recorded here with the reason, never the content. Entries can&apos;t be edited or deleted,
                    and Medyra staff can read them.
                  </p>
                  {audit.entries.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                      {audit.entries.map((e) => (
                        <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                          <span>
                            <span className="font-medium text-maroon-900">
                              {e.actor ? [e.actor.first_name, e.actor.last_name].filter(Boolean).join(" ") : "A former moderator"}
                            </span>{" "}
                            {(AUDIT_ACTION_LABELS[e.action] ?? e.action).toLowerCase()}
                            {e.targetName ? ` (${e.targetName})` : ""}
                            {typeof e.metadata.reason === "string" ? ` — ${removalReasonLabel(e.metadata.reason)}` : ""}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            <RelativeTime iso={e.created_at} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Pagination
                    page={logPage}
                    pageSize={AUDIT_PAGE_SIZE}
                    total={audit.total}
                    hrefFor={(p) => (p === 1 ? base : `${base}?log=${p}`)}
                    label="Moderator log pages"
                  />
                </section>
              </>
            ) : null}

            {role === "owner" ? (
              <section aria-labelledby="settings-heading" className="space-y-3">
                <h2 id="settings-heading" className="text-lg font-semibold text-maroon-900">
                  Community settings
                </h2>
                <details className="rounded-2xl border border-border bg-surface p-5">
                  <summary className="cursor-pointer text-sm font-medium text-maroon-700">Edit description, rules and access</summary>
                  <div className="mt-4">
                    <CommunityForm
                      initial={{
                        id: community.id,
                        name: community.name,
                        description: community.description,
                        kind: community.kind,
                        visibility: community.visibility,
                        rules: community.rules,
                        institution: community.institution,
                        region_label: community.region_label,
                        country: community.country,
                      }}
                    />
                  </div>
                </details>
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
