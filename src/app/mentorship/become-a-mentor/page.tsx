import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/app-header";
import { AppPage } from "@/components/layout/app-page";
import { requireMember } from "@/lib/auth/session";
import { AvailabilityEditor, MentorForm, RemoveListingButton } from "@/features/mentorship/components/mentor-forms";
import { MentorshipLimits, MentorshipTabs } from "@/features/mentorship/components/shared";
import { getMyMentorProfile } from "@/features/mentorship/queries";

export const metadata: Metadata = {
  title: "Become a mentor",
  robots: { index: false },
};

export default function BecomeMentorPage() {
  return (
    <AppPage label="the mentor form">
      <BecomeContent />
    </AppPage>
  );
}

async function BecomeContent() {
  const { user, profile } = await requireMember();
  const mine = await getMyMentorProfile(user.id);
  // Students (by member type or career stage) can ask for a mentor but not list as one. The
  // database enforces the same rule.
  const student =
    profile.member_type === "undergraduate_student" || profile.member_type === "graduate_student" || profile.career_stage === "student";

  return (
    <>
      <AppHeader member={profile} />
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-bold text-maroon-900">{mine ? "Your mentor listing" : "Become a mentor"}</h1>
        <MentorshipTabs current="become" />
        <MentorshipLimits />

        {student && !mine ? (
          <p role="status" className="rounded-2xl border border-border bg-surface p-5 text-sm text-maroon-900">
            Mentor listings are for members who have finished their studies. As a student you can ask a mentor to guide you instead.
          </p>
        ) : (
          <>
            <section aria-labelledby="listing-heading" className="space-y-4 rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 id="listing-heading" className="text-lg font-semibold text-maroon-900">
                Listing details
              </h2>
              <MentorForm initial={mine ?? undefined} />
            </section>

            {mine ? (
              <>
                <section aria-labelledby="availability-heading" className="space-y-3 rounded-2xl border border-border bg-surface p-5 sm:p-6">
                  <h2 id="availability-heading" className="text-lg font-semibold text-maroon-900">
                    When you are usually free
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Weekly times shown on your profile to help mentees suggest a session. Nothing is booked from here and no calendar is connected.
                    Up to 14 windows.
                  </p>
                  <AvailabilityEditor windows={mine.availability} />
                </section>
                <RemoveListingButton />
              </>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
