import {
  Briefcase,
  Check,
  Compass,
  GraduationCap,
  HandHeart,
  Lightbulb,
  Sparkles,
  Target,
} from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import {
  employmentTypeLabel,
  formatMonthRange,
  formatYearRange,
} from "@/features/profile/format";
import type { PublicProfile } from "@/features/profile/visibility";
import type {
  EducationRow,
  ExperienceRow,
  SkillRow,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

function Card({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 sm:p-6",
        className,
      )}
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-maroon-900">
        {Icon ? <Icon className="size-5 text-maroon-600" aria-hidden /> : null}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

const Prose = ({ children }: { children: string }) => (
  <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-maroon-900/85">
    {children}
  </p>
);

const Chips = ({
  items,
  tone = "soft",
}: {
  items: string[];
  tone?: "soft" | "outline";
}) => (
  <ul className="flex flex-wrap gap-2">
    {items.map((item) => (
      <li
        key={item}
        className={cn(
          "rounded-full px-3 py-1 text-sm",
          tone === "soft"
            ? "bg-maroon-50 font-medium text-maroon-700"
            : "border border-border bg-surface text-maroon-900/85",
        )}
      >
        {item}
      </li>
    ))}
  </ul>
);

const names = (skills: SkillRow[], kind: SkillRow["kind"]) =>
  skills.filter((s) => s.kind === kind).map((s) => s.name);

export function AboutSection({
  profile,
  skills,
  isOwner,
}: {
  profile: PublicProfile;
  skills: SkillRow[];
  isOwner: boolean;
}) {
  const interests = names(skills, "interest");
  const hasAnything =
    profile.bio ||
    profile.professional_journey ||
    profile.career_aspirations ||
    interests.length;

  if (!hasAnything) {
    return (
      <EmptyState
        icon={Sparkles}
        title={
          isOwner
            ? "Tell your story"
            : `${profile.first_name} hasn't added an About section yet`
        }
        description={
          isOwner
            ? "Share a short bio, your professional journey and where you want to go. It helps others connect with you."
            : "Check back soon."
        }
        action={
          isOwner
            ? { href: "/profile/edit#about", label: "Write your About section" }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {profile.bio ? (
        <Card title="About">
          <Prose>{profile.bio}</Prose>
        </Card>
      ) : null}
      {profile.professional_journey ? (
        <Card title="Professional journey" icon={Compass}>
          <Prose>{profile.professional_journey}</Prose>
        </Card>
      ) : null}
      {profile.career_aspirations ? (
        <Card title="Career aspirations" icon={Target}>
          <Prose>{profile.career_aspirations}</Prose>
        </Card>
      ) : null}
      {interests.length ? (
        <Card title="Fields of interest" icon={Lightbulb}>
          <Chips items={interests} />
        </Card>
      ) : null}
    </div>
  );
}

export function MentorshipCard({
  profile,
  skills,
  isOwner,
}: {
  profile: PublicProfile;
  skills: SkillRow[];
  isOwner: boolean;
}) {
  const areas = names(skills, "mentorship_area");
  const active =
    profile.looking_for_mentorship ||
    profile.open_to_mentor ||
    areas.length > 0;

  return (
    <Card title="Mentorship" icon={HandHeart}>
      {active ? (
        <div className="space-y-4">
          <ul className="space-y-2">
            {profile.looking_for_mentorship ? (
              <li className="flex items-center gap-2 text-sm font-medium text-maroon-900">
                <Check className="size-4 text-maroon-600" aria-hidden="true" />
                Looking for mentorship
              </li>
            ) : null}
            {profile.open_to_mentor ? (
              <li className="flex items-center gap-2 text-sm font-medium text-maroon-900">
                <Check className="size-4 text-maroon-600" aria-hidden="true" />
                Interested in becoming a mentor
              </li>
            ) : null}
          </ul>
          {areas.length ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Areas of expertise or interest
              </p>
              <Chips items={areas} tone="outline" />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Let others know if you're looking for a mentor or open to mentoring."
            : "No mentorship preferences shared yet."}
        </p>
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        Mentorship preferences are self-reported. They are not verified
        professional credentials.
      </p>
    </Card>
  );
}

export function EducationSection({
  items,
  isOwner,
  firstName,
}: {
  items: EducationRow[];
  isOwner: boolean;
  firstName: string;
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title={
          isOwner
            ? "Add your education"
            : `${firstName} hasn't added education yet`
        }
        description={
          isOwner
            ? "Programs, degrees and certifications help people understand your path."
            : "Check back soon."
        }
        action={
          isOwner
            ? { href: "/profile/edit#education", label: "Add education" }
            : undefined
        }
      />
    );
  }
  return (
    <ol className="space-y-5">
      {items.map((e) => (
        <li
          key={e.id}
          className="relative rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base font-semibold text-maroon-900">
            {e.institution}
          </h3>
          <p className="text-sm text-maroon-900/85">
            {[e.qualification, e.field_of_study].filter(Boolean).join(", ")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatYearRange(e.start_year, e.end_year, e.currently_studying) ??
              "Dates not provided"}
            {e.currently_studying ? " · Currently studying" : ""}
          </p>
          {e.description ? (
            <div className="mt-3">
              <Prose>{e.description}</Prose>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ExperienceSection({
  items,
  isOwner,
  firstName,
}: {
  items: ExperienceRow[];
  isOwner: boolean;
  firstName: string;
}) {
  if (!items.length) {
    return (
      <EmptyState
        icon={Briefcase}
        title={
          isOwner
            ? "Add your experience"
            : `${firstName} hasn't added experience yet`
        }
        description={
          isOwner
            ? "Jobs, placements, internships and volunteer work all count."
            : "Check back soon."
        }
        action={
          isOwner
            ? { href: "/profile/edit#experience", label: "Add experience" }
            : undefined
        }
      />
    );
  }
  return (
    <ol className="space-y-5">
      {items.map((x) => (
        <li
          key={x.id}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-base font-semibold text-maroon-900">{x.title}</h3>
          <p className="text-sm text-maroon-900/85">
            {[x.organization, employmentTypeLabel(x.employment_type)]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatMonthRange(x.start_date, x.end_date, x.is_current)}
          </p>
          {x.description ? (
            <div className="mt-3">
              <Prose>{x.description}</Prose>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function SkillsSection({
  skills,
  isOwner,
  firstName,
}: {
  skills: SkillRow[];
  isOwner: boolean;
  firstName: string;
}) {
  const list = names(skills, "skill");
  const interests = names(skills, "interest");

  if (!list.length && !interests.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title={
          isOwner
            ? "Add skills and interests"
            : `${firstName} hasn't added skills yet`
        }
        description={
          isOwner
            ? "List what you're good at and what you want to learn. They're self-reported, so be honest and specific."
            : "Check back soon."
        }
        action={
          isOwner
            ? { href: "/profile/edit#skills", label: "Add skills" }
            : undefined
        }
      />
    );
  }
  return (
    <div className="space-y-5">
      {list.length ? (
        <Card title="Skills">
          <Chips items={list} />
        </Card>
      ) : null}
      {interests.length ? (
        <Card title="Interests">
          <Chips items={interests} tone="outline" />
        </Card>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Skills and interests are self-reported and have not been verified.
      </p>
    </div>
  );
}

/** Owner-only nudge toward a fuller profile. Hidden once everything is filled in. */
export function CompletenessCard({
  profile,
  education,
  experience,
  skills,
}: {
  profile: PublicProfile;
  education: EducationRow[];
  experience: ExperienceRow[];
  skills: SkillRow[];
}) {
  const steps = [
    {
      label: "Add a profile photo",
      done: Boolean(profile.avatar_path),
      href: "/profile/edit#images",
    },
    {
      label: "Add a cover image",
      done: Boolean(profile.cover_path),
      href: "/profile/edit#images",
    },
    {
      label: "Write your bio",
      done: Boolean(profile.bio),
      href: "/profile/edit#about",
    },
    {
      label: "Add your education",
      done: education.length > 0,
      href: "/profile/edit#education",
    },
    {
      label: "Add your experience",
      done: experience.length > 0,
      href: "/profile/edit#experience",
    },
    {
      label: "List your skills",
      done: names(skills, "skill").length > 0,
      href: "/profile/edit#skills",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <section
      aria-labelledby="completeness"
      className="rounded-2xl border border-maroon-200 bg-maroon-50 p-5 sm:p-6"
    >
      <h2 id="completeness" className="text-lg font-bold text-maroon-900">
        Complete your profile
      </h2>
      <p className="text-sm text-maroon-900/75">
        {doneCount} of {steps.length} done
      </p>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-4 items-center justify-center rounded-full",
                s.done
                  ? "bg-maroon-600 text-white"
                  : "border border-maroon-200 bg-white",
              )}
            >
              {s.done ? <Check className="size-3" strokeWidth={3} /> : null}
            </span>
            {s.done ? (
              <span className="text-muted-foreground line-through">
                {s.label}
              </span>
            ) : (
              <a
                href={s.href}
                className="font-medium text-maroon-700 underline-offset-4 hover:underline"
              >
                {s.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
