import type { Metadata } from "next";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarUrl } from "@/lib/storage-url";
import { requireMember } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { DecideRequestControls, WithdrawRequestButton } from "@/features/mentorship/components/relationship-controls";
import { MentorshipTabs } from "@/features/mentorship/components/shared";
import { formatLabel } from "@/features/mentorship/options";
import { listRequests, type RequestEntry } from "@/features/mentorship/queries";

export const metadata: Metadata = {
  title: "Mentorship requests",
  robots: { index: false },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default function RequestsPage({ searchParams }: Props) {
  return (
    <AppPage label="mentorship requests">
      <RequestsContent searchParams={searchParams} />
    </AppPage>
  );
}

const STATUS_STYLE = {
  pending: "bg-maroon-50 text-maroon-800",
  accepted: "bg-maroon-700 text-white",
  declined: "bg-sand text-muted-foreground",
} as const;

function RequestCard({ entry, mode }: { entry: RequestEntry; mode: "received" | "sent" }) {
  const name = [entry.person.first_name, entry.person.last_name].filter(Boolean).join(" ");
  const href = mode === "sent" ? `/mentorship/${entry.person.id}` : entry.person.username ? `/profile/${entry.person.username}` : null;
  return (
    <article aria-label={`Request with ${name}`} className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <MemberAvatar name={entry.person.first_name} src={avatarUrl(entry.person.avatar_path)} className="size-11" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-maroon-900">
            {href ? <Link href={href} className="hover:underline">{name}</Link> : name}
          </p>
          <p className="text-xs text-muted-foreground">
            {mode === "received" ? "Asked you" : "You asked"} <RelativeTime iso={entry.created_at} />
            {entry.preferred_format ? ` · prefers ${formatLabel(entry.preferred_format).toLowerCase()}` : ""}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[entry.status])}>{entry.status}</span>
      </div>
      <p className="rounded-xl bg-sand/60 p-3 text-sm leading-relaxed whitespace-pre-wrap text-maroon-900/90">{entry.goals}</p>
      {entry.status === "declined" && entry.decline_note && mode === "sent" ? (
        <p className="text-sm text-maroon-900">
          <span className="text-xs text-muted-foreground">Their note: </span>
          {entry.decline_note}
        </p>
      ) : null}
      {entry.status === "pending" ? (
        mode === "received" ? (
          <DecideRequestControls requestId={entry.id} name={entry.person.first_name} />
        ) : (
          <WithdrawRequestButton requestId={entry.id} />
        )
      ) : null}
      {entry.status === "accepted" ? (
        <Link href="/mentorship/my-mentorships" className="text-sm font-medium text-maroon-700 hover:underline">
          Open the mentorship
        </Link>
      ) : null}
    </article>
  );
}

async function RequestsContent({ searchParams }: Props) {
  const { user, profile } = await requireMember();
  const raw = (await searchParams).tab;
  const tab = (Array.isArray(raw) ? raw[0] : raw) === "sent" ? "sent" : "received";
  const { received, sent, failed } = await listRequests(user.id);
  const pending = received.filter((r) => r.status === "pending").length;
  const shown = tab === "sent" ? sent : received;

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-maroon-900">Mentorship requests</h1>
        <MentorshipTabs current="requests" pendingRequests={pending} />
        <nav aria-label="Request lists" className="flex gap-2">
          {(
            [
              ["received", `Received (${received.length})`],
              ["sent", `Sent (${sent.length})`],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={key === "received" ? "/mentorship/requests" : "/mentorship/requests?tab=sent"}
              aria-current={tab === key ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium",
                tab === key ? "border-maroon-700 bg-maroon-700 text-white" : "border-border bg-surface text-maroon-900/80 hover:bg-maroon-50",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
        {failed ? (
          <p role="alert" className="text-sm text-destructive">Requests aren&apos;t loading right now. Please try again.</p>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === "sent" ? "You haven't asked a mentor yet" : "No requests yet"}
            description={tab === "sent" ? "Find a mentor, then explain your goals in a request." : "When a member asks you to mentor them, the request appears here and you choose whether to accept."}
            action={tab === "sent" ? { href: "/mentorship/find", label: "Find a mentor" } : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id}>
                <RequestCard entry={r} mode={tab} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
