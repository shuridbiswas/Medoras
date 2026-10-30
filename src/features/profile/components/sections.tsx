import Link from "next/link";
import {
  BookOpen,
  Check,
  GraduationCap,
  HandHeart,
  Pencil,
  Stethoscope,
  User,
  UsersRound,
} from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import {
  employmentTypeLabel,
  fieldLabels,
  formatMonthRange,
  formatYearRange,
} from "@/features/profile/format";
import type { PublicProfile } from "@/features/profile/visibility";
import type { NetworkCounts, NetworkMember } from "@/features/network/types";
import { avatarUrl } from "@/lib/storage-url";
import type {
  EducationRow,
  ExperienceRow,
  SkillRow,
} from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

function Card({
  id,
  title,
  icon: Icon,
  edit,
  children,
  className,
}: {
  id: string;
  title: string;
  icon: IconType;
  /** Owner-only link to the matching section of the edit page. */
  edit?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn("rounded-3xl border border-border bg-surface p-5 sm:p-6", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-3 text-lg font-bold text-maroon-900">
          <span className="flex size-9 items-center justify-center rounded-full bg-maroon-50 text-maroon-700">
            <Icon className="size-4.5" aria-hidden />
          </span>
          {title}
        </h2>
        {edit ? (
          <Link
            href={edit}
            aria-label={`Edit ${title.toLowerCase()}`}
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-maroon-700 transition-colors hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            Edit
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
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
  label,
  tone = "soft",
}: {
  items: string[];
  label: string;
  tone?: "soft" | "outline";
}) => (
  <ul aria-label={label} className="flex flex-wrap gap-2">
    {items.map((item) => (
      <li
        key={item}
        className={cn(
          "rounded-full px-3.5 py-1.5 text-sm",
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

const Hint = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground">{children}</p>
);

const names = (skills: SkillRow[], kind: SkillRow["kind"]) =>
  skills.filter((s) => s.kind === kind).map((s) => s.name);

export function AboutCard({
  profile,
  isOwner,
}: {
  profile: PublicProfile;
  isOwner: boolean;
}) {
  const hasText =
    profile.bio || profile.professional_journey || profile.career_aspirations;
  const flags = [
    profile.open_to_mentor ? "Open to mentorship" : null,
    profile.looking_for_mentorship ? "Looking for mentorship" : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <Card id="profile-about" title="About me" icon={User} edit={isOwner ? "/profile/edit#about" : undefined}>
      {hasText ? (
        <div className="space-y-4">
          {profile.bio ? <Prose>{profile.bio}</Prose> : null}
          {profile.professional_journey ? (
            <div>
              <h3 className="text-sm font-semibold text-maroon-900">Professional journey</h3>
              <Prose>{profile.professional_journey}</Prose>
            </div>
          ) : null}
          {profile.career_aspirations ? (
            <div>
              <h3 className="text-sm font-semibold text-maroon-900">Career aspirations</h3>
              <Prose>{profile.career_aspirations}</Prose>
            </div>
          ) : null}
        </div>
      ) : (
        <Hint>
          {isOwner
            ? "Tell people who you are, what you study or do, and where you want to go."
            : `${profile.first_name} hasn't added an About section yet.`}
        </Hint>
      )}

      {flags.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <ul aria-label="Mentorship" className="flex flex-wrap gap-2">
            {flags.map((f) => (
              <li
                key={f}
                className="inline-flex items-center gap-2 rounded-full border border-maroon-200 bg-maroon-50 px-3.5 py-1.5 text-sm font-medium text-maroon-800"
              >
                <HandHeart className="size-4" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Mentorship preferences are self-reported. They are not verified professional
            credentials.
          </p>
        </div>
      ) : null}
    </Card>
  );
}

export function InterestsCard({
  profile,
  skills,
  isOwner,
}: {
  profile: PublicProfile;
  skills: SkillRow[];
  isOwner: boolean;
}) {
  const fields = fieldLabels(profile.fields);
  const groups = [
    { label: "Fields", items: fields, tone: "soft" as const },
    { label: "Interests", items: names(skills, "interest"), tone: "soft" as const },
    { label: "Skills", items: names(skills, "skill"), tone: "outline" as const },
    {
      label: "Mentorship areas",
      items: names(skills, "mentorship_area"),
      tone: "outline" as const,
    },
  ].filter((g) => g.items.length > 0);

  return (
    <Card
      id="profile-interests"
      title="Skills & interests"
      icon={Stethoscope}
      edit={isOwner ? "/profile/edit#skills" : undefined}
    >
      {groups.length ? (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              {groups.length > 1 ? (
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.label}
                </h3>
              ) : null}
              <Chips items={g.items} label={g.label} tone={g.tone} />
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Skills and interests are self-reported and have not been verified.
          </p>
        </div>
      ) : (
        <Hint>
          {isOwner
            ? "List what you're good at and what you want to learn. They're self-reported, so be honest and specific."
            : `${profile.first_name} hasn't added skills or interests yet.`}
        </Hint>
      )}
    </Card>
  );
}

type TimelineEntry = {
  key: string;
  kind: "education" | "experience";
  title: string;
  subtitle: string;
  when: string;
  current: boolean;
  /** Sort key: the start date as YYYYMM. */
  start: number;
};

function timeline(education: EducationRow[], experience: ExperienceRow[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...education.map((e) => ({
      key: `e-${e.id}`,
      kind: "education" as const,
      title: [e.qualification, e.field_of_study].filter(Boolean).join(", "),
      subtitle: e.institution,
      when: formatYearRange(e.start_year, e.end_year, e.currently_studying) ?? "",
      current: e.currently_studying,
      start: (e.start_year ?? 0) * 100,
    })),
    ...experience.map((x) => ({
      key: `x-${x.id}`,
      kind: "experience" as const,
      title: x.title,
      subtitle: [x.organization, employmentTypeLabel(x.employment_type)]
        .filter(Boolean)
        .join(" · "),
      when: formatMonthRange(x.start_date, x.end_date, x.is_current),
      current: x.is_current,
      start: Number(x.start_date.slice(0, 4)) * 100 + Number(x.start_date.slice(5, 7)),
    })),
  ];
  // Current roles first, then newest start date.
  return entries.sort((a, b) => Number(b.current) - Number(a.current) || b.start - a.start);
}

const TIMELINE_LIMIT = 8;

export function TimelineCard({
  education,
  experience,
  isOwner,
  firstName,
}: {
  education: EducationRow[];
  experience: ExperienceRow[];
  isOwner: boolean;
  firstName: string;
}) {
  const entries = timeline(education, experience);
  const shown = entries.slice(0, TIMELINE_LIMIT);

  return (
    <Card
      id="profile-timeline"
      title="Education & experience"
      icon={GraduationCap}
      edit={isOwner ? "/profile/edit#education" : undefined}
    >
      {shown.length ? (
        <>
          <ol className="relative space-y-5 border-l border-maroon-200 pl-6">
            {shown.map((e) => (
              <li key={e.key} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[1.82rem] size-2.5 rounded-full bg-maroon-700 ring-4 ring-surface"
                />
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <h3 className="text-base font-semibold text-maroon-900">{e.title}</h3>
                  {e.when ? (
                    <p className="text-sm text-muted-foreground">{e.when}</p>
                  ) : null}
                </div>
                <p className="text-sm text-maroon-900/80">
                  {e.subtitle}
                  <span className="sr-only"> ({e.kind})</span>
                </p>
              </li>
            ))}
          </ol>
          {entries.length > shown.length ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Showing {shown.length} of {entries.length}.
            </p>
          ) : null}
        </>
      ) : (
        <Hint>
          {isOwner ? (
            <>
              Add your programs, degrees, placements and jobs.{" "}
              <Link
                href="/profile/edit#education"
                className="font-medium text-maroon-700 underline underline-offset-2"
              >
                Add education
              </Link>{" "}
              or{" "}
              <Link
                href="/profile/edit#experience"
                className="font-medium text-maroon-700 underline underline-offset-2"
              >
                add experience
              </Link>
              .
            </>
          ) : (
            `${firstName} hasn't added education or experience yet.`
          )}
        </Hint>
      )}
    </Card>
  );
}

/** Connection, follower and following counts, with a few connections shown by name. */
export function NetworkCard({
  counts,
  connections,
  isOwner,
}: {
  counts: NetworkCounts;
  connections: NetworkMember[];
  isOwner: boolean;
}) {
  const stats = [
    { label: counts.connections === 1 ? "connection" : "connections", value: counts.connections },
    { label: counts.followers === 1 ? "follower" : "followers", value: counts.followers },
    { label: "following", value: counts.following },
  ];

  return (
    <Card id="profile-network" title="Connections" icon={UsersRound}>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-sand/70 px-2 py-3">
            <dd className="text-xl font-bold text-maroon-900">{s.value}</dd>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
          </div>
        ))}
      </dl>

      {connections.length ? (
        <ul aria-label="Some connections" className="mt-4 flex flex-wrap gap-2">
          {connections.map((m) => (
            <li key={m.id}>
              <Link
                href={`/profile/${m.username}`}
                title={[m.first_name, m.last_name].join(" ")}
                aria-label={[m.first_name, m.last_name].join(" ")}
                className="block rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <MemberAvatar
                  name={m.first_name}
                  src={avatarUrl(m.avatar_path)}
                  className="size-10 border-2 border-surface"
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {isOwner ? (
        <Link
          href="/network/connections"
          className="mt-4 inline-block text-sm font-medium text-maroon-700 underline-offset-4 hover:underline"
        >
          View all
        </Link>
      ) : null}
    </Card>
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
      className="rounded-3xl border border-maroon-200 bg-maroon-50 p-5 sm:p-6"
    >
      <h2 id="completeness" className="flex items-center gap-2 text-lg font-bold text-maroon-900">
        <BookOpen className="size-4.5 text-maroon-600" aria-hidden="true" />
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
