import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { avatarUrl, coverUrl, requireMember } from "@/lib/auth/session";
import { ProfileHeader } from "@/features/profile/components/profile-header";
import { ProfileTabs } from "@/features/profile/components/profile-tabs";
import {
  AboutSection,
  CompletenessCard,
  EducationSection,
  ExperienceSection,
  MentorshipCard,
  SkillsSection,
} from "@/features/profile/components/sections";
import { ProfileActivity } from "@/features/feed/components/profile-activity";
import { getProfileByUsername } from "@/features/profile/queries";
import { toPublicProfile } from "@/features/profile/visibility";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false },
};

type Props = { params: Promise<{ username: string }> };

export default function ProfilePage({ params }: Props) {
  return (
    <div className="min-h-dvh bg-sand/60 pb-20 md:pb-0">
      <Suspense fallback={<ProfileFallback />}>
        <ProfileContent params={params} />
      </Suspense>
    </div>
  );
}

function ProfileFallback() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
      <span className="sr-only">Loading profile</span>
    </div>
  );
}

async function ProfileContent({ params }: Props) {
  const { username } = await params;
  // Viewers must be signed-in, verified members who finished onboarding.
  const { user, profile: me } = await requireMember();

  // Unknown usernames, malformed ones, and profiles the viewer isn't allowed to see are all "not found".
  const data = await getProfileByUsername(username);
  if (!data) notFound();

  const isOwner = data.profile.id === user.id;
  const profile = toPublicProfile(data.profile);
  const { education, experience, skills } = data;

  return (
    <>
      <AppHeader member={me} />
      <main
        id="main"
        className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          avatarSrc={avatarUrl(profile.avatar_path)}
          coverSrc={coverUrl(profile.cover_path)}
        />
        <ProfileTabs
          tabs={[
            {
              id: "overview",
              label: "Overview",
              panel: (
                <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
                  <AboutSection
                    profile={profile}
                    skills={skills}
                    isOwner={isOwner}
                  />
                  <div className="space-y-5">
                    {isOwner ? (
                      <CompletenessCard
                        profile={profile}
                        education={education}
                        experience={experience}
                        skills={skills}
                      />
                    ) : null}
                    <MentorshipCard
                      profile={profile}
                      skills={skills}
                      isOwner={isOwner}
                    />
                  </div>
                </div>
              ),
            },
            {
              id: "education",
              label: "Education",
              count: education.length,
              panel: (
                <EducationSection
                  items={education}
                  isOwner={isOwner}
                  firstName={profile.first_name}
                />
              ),
            },
            {
              id: "experience",
              label: "Experience",
              count: experience.length,
              panel: (
                <ExperienceSection
                  items={experience}
                  isOwner={isOwner}
                  firstName={profile.first_name}
                />
              ),
            },
            {
              id: "skills",
              label: "Skills & interests",
              panel: (
                <SkillsSection
                  skills={skills}
                  isOwner={isOwner}
                  firstName={profile.first_name}
                />
              ),
            },
            {
              id: "activity",
              label: "Activity",
              panel: (
                <ProfileActivity
                  viewerId={user.id}
                  authorId={profile.id}
                  isOwner={isOwner}
                  firstName={profile.first_name}
                />
              ),
            },
          ]}
        />
      </main>
    </>
  );
}
