import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, HandHeart, Search } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { LinkButton } from "@/components/ui/link-button";
import { requireMember } from "@/lib/auth/session";
import { MentorshipLimits, MentorshipTabs } from "@/features/mentorship/components/shared";
import { countPendingReceived, getMyMentorProfile, listMentorships } from "@/features/mentorship/queries";

export const metadata: Metadata = {
  title: "Mentorship",
  robots: { index: false },
};

export default function MentorshipPage() {
  return (
    <AppPage label="mentorship">
      <MentorshipContent />
    </AppPage>
  );
}

async function MentorshipContent() {
  const { user, profile } = await requireMember();
  const [mine, pending, mentorships] = await Promise.all([
    getMyMentorProfile(user.id),
    countPendingReceived(user.id),
    listMentorships(user.id),
  ]);
  const active = mentorships.entries.filter((m) => m.status === "active" || m.status === "paused");

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="text-2xl font-bold text-maroon-900">Mentorship</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Find someone further along who is willing to share what they know, or offer your own experience to someone starting out.
          </p>
        </div>
        <MentorshipTabs current="overview" pendingRequests={pending} />

        <div className="grid gap-4 sm:grid-cols-2">
          <section aria-labelledby="mentee-heading" className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-maroon-100 text-maroon-700">
              <Search className="size-5" aria-hidden="true" />
            </span>
            <h2 id="mentee-heading" className="text-lg font-semibold text-maroon-900">
              Find a mentor
            </h2>
            <p className="text-sm text-muted-foreground">Filter by profession, topic, language and experience, then tell a mentor what you hope to achieve.</p>
            <LinkButton href="/mentorship/find" className="h-10 px-4">
              Browse mentors
            </LinkButton>
          </section>
          <section aria-labelledby="mentor-heading" className="space-y-3 rounded-2xl border border-border bg-surface p-5">
            <span className="flex size-10 items-center justify-center rounded-full bg-maroon-100 text-maroon-700">
              <HandHeart className="size-5" aria-hidden="true" />
            </span>
            <h2 id="mentor-heading" className="text-lg font-semibold text-maroon-900">
              {mine ? "Your mentor listing" : "Become a mentor"}
            </h2>
            {mine ? (
              <p className="text-sm text-muted-foreground" role="status">
                {mine.accepting ? "You're accepting requests." : "Your listing is paused."} {mine.activeMentees} of {mine.capacity}{" "}
                {mine.capacity === 1 ? "place" : "places"} in use.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Professionals, educators and researchers can offer guidance. Students can ask for a mentor.</p>
            )}
            <LinkButton href="/mentorship/become-a-mentor" variant="outline" className="h-10 px-4">
              {mine ? "Edit listing" : "Get started"}
            </LinkButton>
          </section>
        </div>

        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="flex items-center gap-2 text-lg font-semibold text-maroon-900">
            <GraduationCap className="size-5 text-maroon-600" aria-hidden="true" />
            Your mentorships
          </h2>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None yet. Once a request is accepted it appears here, with a conversation opened between you. {pending > 0 ? <Link href="/mentorship/requests" className="font-medium text-maroon-700 underline underline-offset-2">You have {pending} waiting.</Link> : null}
            </p>
          ) : (
            <ul className="space-y-2">
              {active.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium text-maroon-900">{[m.person.first_name, m.person.last_name].join(" ")}</span>{" "}
                    <span className="text-muted-foreground">· you are the {m.role}</span>
                  </span>
                  <Link href="/mentorship/my-mentorships" className="font-medium text-maroon-700 hover:underline">
                    Manage
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <MentorshipLimits />
      </main>
    </>
  );
}
