import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppFrame } from "@/components/layout/app-frame";
import { AppHeader } from "@/components/layout/app-header";
import { avatarUrl, coverUrl, requireMember } from "@/lib/auth/session";
import { FormSection } from "@/features/profile/components/edit/form-parts";
import { ImageCard } from "@/features/profile/components/edit/image-card";
import {
  AboutForm,
  BasicsForm,
  MentorshipForm,
} from "@/features/profile/components/edit/profile-forms";
import {
  EducationManager,
  ExperienceManager,
} from "@/features/profile/components/edit/entry-managers";
import { TagEditor } from "@/features/profile/components/edit/tag-editor";
import { getProfileById } from "@/features/profile/queries";
import {
  removeAvatar,
  removeCover,
  uploadAvatar,
  uploadCover,
} from "@/features/profile/actions";
import {
  AVATAR_MAX_BYTES,
  COVER_MAX_BYTES,
  SKILL_LIMITS,
} from "@/features/profile/schemas";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false },
};

const sections = [
  ["images", "Photos"],
  ["details", "Details"],
  ["about", "About"],
  ["mentorship", "Mentorship"],
  ["skills", "Skills & interests"],
  ["education", "Education"],
  ["experience", "Experience"],
] as const;

export default function EditProfilePage() {
  return (
    <AppFrame>
      <Suspense
        fallback={
          <div
            role="status"
            className="flex min-h-dvh items-center justify-center"
          >
            <span className="size-8 animate-spin rounded-full border-2 border-maroon-200 border-t-maroon-700 motion-reduce:animate-none" />
            <span className="sr-only">Loading editor</span>
          </div>
        }
      >
        <EditContent />
      </Suspense>
    </AppFrame>
  );
}

async function EditContent() {
  // Only the signed-in owner can reach this page, and every save re-checks that on the server.
  const { user, profile: me } = await requireMember();
  const data = await getProfileById(user.id);
  if (!data) notFound();
  const { profile, education, experience, skills } = data;
  const names = (kind: string) =>
    skills.filter((s) => s.kind === kind).map((s) => s.name);
  const back = `/profile/${profile.username}`;

  return (
    <>
      <AppHeader member={me} />
      <main
        id="main"
        className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        <div>
          <Link
            href={back}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-maroon-700 underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to your profile
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-maroon-900">
            Edit your profile
          </h1>
          <p className="mt-1 text-muted-foreground">
            Everything here is visible to other signed-in Medyra members. Your
            email address is never shown.
          </p>
          <nav
            aria-label="Jump to section"
            className="mt-4 flex flex-wrap gap-2"
          >
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="rounded-full border border-border bg-surface px-3 py-1 text-sm text-maroon-900/85 transition-colors hover:border-maroon-200 hover:bg-maroon-50"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        <FormSection
          id="images"
          title="Photos"
          description="Your profile photo and cover image."
        >
          <div className="space-y-8">
            <ImageCard
              id="cover-image"
              label="Cover image"
              shape="cover"
              currentSrc={coverUrl(profile.cover_path)}
              fallback="No cover image"
              maxMb={COVER_MAX_BYTES / (1024 * 1024)}
              upload={uploadCover}
              remove={removeCover}
            />
            <ImageCard
              id="profile-photo"
              label="Profile photo"
              shape="avatar"
              currentSrc={avatarUrl(profile.avatar_path)}
              fallback="No photo"
              maxMb={AVATAR_MAX_BYTES / (1024 * 1024)}
              upload={uploadAvatar}
              remove={removeAvatar}
            />
          </div>
        </FormSection>

        <FormSection
          id="details"
          title="Details"
          description="Your name, headline, field and where you study or work."
        >
          <BasicsForm
            cancelHref={back}
            initial={{
              firstName: profile.first_name,
              lastName: profile.last_name,
              headline: profile.headline ?? "",
              locationLabel: profile.location_label ?? "",
              memberType: profile.member_type ?? "",
              fields: profile.fields,
              institution: profile.institution ?? "",
              qualification: profile.qualification ?? "",
              specialty: profile.specialty ?? "",
              careerStage: profile.career_stage ?? "",
            }}
          />
        </FormSection>

        <FormSection
          id="about"
          title="About"
          description="Your story, in your own words."
        >
          <AboutForm
            cancelHref={back}
            initial={{
              bio: profile.bio ?? "",
              professionalJourney: profile.professional_journey ?? "",
              careerAspirations: profile.career_aspirations ?? "",
            }}
          />
        </FormSection>

        <FormSection
          id="mentorship"
          title="Mentorship"
          description="Tell the community whether you are looking for a mentor or open to mentoring."
        >
          <div className="space-y-8">
            <MentorshipForm
              cancelHref={back}
              initial={{
                lookingForMentorship: profile.looking_for_mentorship,
                openToMentor: profile.open_to_mentor,
              }}
            />
            <TagEditor
              kind="mentorship_area"
              label="Areas of expertise or interest"
              hint="Topics you could mentor on, or want guidance with."
              initial={names("mentorship_area")}
              limit={SKILL_LIMITS.mentorship_area}
              placeholder="e.g. Clinical placements"
            />
          </div>
        </FormSection>

        <FormSection
          id="skills"
          title="Skills & interests"
          description="Self-reported. They are not verified credentials."
        >
          <div className="space-y-8">
            <TagEditor
              kind="skill"
              label="Skills"
              hint="Press Enter to add."
              initial={names("skill")}
              limit={SKILL_LIMITS.skill}
              placeholder="e.g. Active listening"
            />
            <TagEditor
              kind="interest"
              label="Fields of interest"
              hint="Press Enter to add."
              initial={names("interest")}
              limit={SKILL_LIMITS.interest}
              placeholder="e.g. Neuropsychology"
            />
          </div>
        </FormSection>

        <FormSection
          id="education"
          title="Education"
          description="Programs, degrees and certifications."
        >
          <EducationManager items={education} />
        </FormSection>

        <FormSection
          id="experience"
          title="Experience"
          description="Jobs, placements, internships and volunteer work."
        >
          <ExperienceManager items={experience} />
        </FormSection>
      </main>
    </>
  );
}
