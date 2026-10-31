import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, MessageSquare } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { EmptyState } from "@/components/layout/empty-state";
import { RelativeTime } from "@/components/relative-time";
import { MemberAvatar } from "@/components/member-avatar";
import { LinkButton } from "@/components/ui/link-button";
import { avatarUrl } from "@/lib/storage-url";
import { requireMember } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { FeedbackForm, MentorshipControls } from "@/features/mentorship/components/relationship-controls";
import { MentorshipTabs } from "@/features/mentorship/components/shared";
import { STATUS_LABELS } from "@/features/mentorship/options";
import { listMentorships, type MentorshipEntry } from "@/features/mentorship/queries";

export const metadata: Metadata = {
  title: "My mentorships",
  robots: { index: false },
};

export default function MyMentorshipsPage() {
  return (
    <AppPage label="your mentorships">
      <MyContent />
    </AppPage>
  );
}

function Stars({ rating }: { rating: number }) {
  return <span aria-label={`${rating} out of 5`}>{"★".repeat(rating)}{"☆".repeat(5 - rating)}</span>;
}

function Entry({ entry }: { entry: MentorshipEntry }) {
  const name = [entry.person.first_name, entry.person.last_name].filter(Boolean).join(" ");
  const live = entry.status === "active" || entry.status === "paused";
  return (
    <article aria-label={`Mentorship with ${name}`} className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3">
        <MemberAvatar name={entry.person.first_name} src={avatarUrl(entry.person.avatar_path)} className="size-12" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-maroon-900">
            {entry.person.username ? <Link href={`/profile/${entry.person.username}`} className="hover:underline">{name}</Link> : name}
          </p>
          <p className="text-xs text-muted-foreground">
            You are the {entry.role} · started <RelativeTime iso={entry.started_at} />
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", live ? "bg-maroon-50 text-maroon-800" : "bg-sand text-muted-foreground")}>
          {STATUS_LABELS[entry.status]}
        </span>
      </div>

      {entry.status === "paused" ? <p className="text-sm text-muted-foreground">The mentor paused this mentorship. They can resume it whenever they&apos;re ready.</p> : null}

      {live && entry.conversation_id ? (
        <LinkButton href={`/messages/${entry.conversation_id}`} variant="outline" className="h-9 px-4 text-sm">
          <MessageSquare className="size-4" aria-hidden="true" />
          Open the conversation
        </LinkButton>
      ) : null}

      <MentorshipControls mentorshipId={entry.id} status={entry.status} role={entry.role} />

      {entry.status === "completed" ? (
        <div className="space-y-3 border-t border-border pt-3">
          <h3 className="text-sm font-semibold text-maroon-900">Feedback</h3>
          {entry.myFeedback ? (
            <p className="text-sm">
              <span className="text-xs text-muted-foreground">Yours: </span>
              <Stars rating={entry.myFeedback.rating} /> {entry.myFeedback.comment}
            </p>
          ) : (
            <FeedbackForm mentorshipId={entry.id} />
          )}
          {entry.theirFeedback ? (
            <p className="text-sm">
              <span className="text-xs text-muted-foreground">From {entry.person.first_name}: </span>
              <Stars rating={entry.theirFeedback.rating} /> {entry.theirFeedback.comment}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

async function MyContent() {
  const { user, profile } = await requireMember();
  const { entries, failed } = await listMentorships(user.id);
  const live = entries.filter((e) => e.status === "active" || e.status === "paused");
  const past = entries.filter((e) => e.status === "completed" || e.status === "ended");

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-maroon-900">My mentorships</h1>
        <MentorshipTabs current="mine" />
        {failed ? (
          <p role="alert" className="text-sm text-destructive">Your mentorships aren&apos;t loading right now. Please try again.</p>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No mentorships yet"
            description="When a mentor accepts your request, or you accept someone's, it appears here with a conversation opened between you."
            action={{ href: "/mentorship/find", label: "Find a mentor" }}
          />
        ) : (
          <>
            <section aria-labelledby="live-heading" className="space-y-3">
              <h2 id="live-heading" className="text-lg font-semibold text-maroon-900">Current</h2>
              {live.length === 0 ? <p className="text-sm text-muted-foreground">Nothing current.</p> : (
                <ul className="space-y-3">{live.map((e) => <li key={e.id}><Entry entry={e} /></li>)}</ul>
              )}
            </section>
            {past.length > 0 ? (
              <section aria-labelledby="past-heading" className="space-y-3">
                <h2 id="past-heading" className="text-lg font-semibold text-maroon-900">Finished</h2>
                <ul className="space-y-3">{past.map((e) => <li key={e.id}><Entry entry={e} /></li>)}</ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
