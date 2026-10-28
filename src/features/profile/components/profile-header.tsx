import { BookOpen, GraduationCap, MapPin, Pencil, Sprout } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";
import {
  careerStageLabel,
  fieldLabels,
  generalLocation,
} from "@/features/profile/format";
import { fullName, type PublicProfile } from "@/features/profile/visibility";

export function ProfileHeader({
  profile,
  isOwner,
  avatarSrc,
  coverSrc,
}: {
  profile: PublicProfile;
  isOwner: boolean;
  avatarSrc: string | null;
  coverSrc: string | null;
}) {
  const name = fullName(profile);
  const fields = fieldLabels(profile.fields);
  const location = generalLocation(profile.location_label, profile.country);
  const stage = careerStageLabel(profile.career_stage);
  const studyLine = [profile.qualification, profile.institution]
    .filter(Boolean)
    .join(" at ");

  return (
    <header className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_-40px_rgba(110,16,38,0.4)]">
      <div className="relative h-36 bg-maroon-700 sm:h-52">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="size-full object-cover" />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 800 200"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 size-full opacity-25"
            fill="none"
            stroke="white"
          >
            <circle cx="650" cy="40" r="60" />
            <circle cx="650" cy="40" r="110" />
            <circle cx="650" cy="40" r="170" />
            <circle cx="650" cy="40" r="240" />
            <path d="M0 150c120-60 220 30 380-20s260-30 420-80" />
          </svg>
        )}
      </div>

      <div className="px-5 pb-6 sm:px-8">
        <div className="relative -mt-14 flex items-end justify-between gap-4 sm:-mt-[4.5rem]">
          <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-maroon-100 text-4xl font-bold text-maroon-700 sm:size-36 sm:text-5xl">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={`Photo of ${name}`}
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden="true">
                {profile.first_name.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          {isOwner ? (
            <LinkButton
              href="/profile/edit"
              variant="outline"
              className="mb-1 h-10 border-maroon-200 px-4 text-sm font-semibold text-maroon-700"
            >
              <Pencil className="size-4" aria-hidden="true" />
              Edit Profile
            </LinkButton>
          ) : null}
        </div>

        <div className="mt-4">
          <h1 className="text-2xl font-bold leading-tight text-maroon-900 sm:text-3xl">
            {name}
          </h1>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.headline ? (
            <p className="mt-2 text-base text-maroon-900/90 sm:text-lg">
              {profile.headline}
            </p>
          ) : isOwner ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Add a headline so people know what you do.
            </p>
          ) : null}
        </div>

        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {studyLine ? (
            <li className="flex items-center gap-1.5">
              <GraduationCap
                className="size-4 text-maroon-600"
                aria-hidden="true"
              />
              <span>{studyLine}</span>
            </li>
          ) : null}
          {profile.specialty ? (
            <li className="flex items-center gap-1.5">
              <BookOpen className="size-4 text-maroon-600" aria-hidden="true" />
              <span>{profile.specialty}</span>
            </li>
          ) : null}
          {location ? (
            <li className="flex items-center gap-1.5">
              <MapPin className="size-4 text-maroon-600" aria-hidden="true" />
              <span>{location}</span>
            </li>
          ) : null}
          {stage ? (
            <li className="flex items-center gap-1.5">
              <Sprout className="size-4 text-maroon-600" aria-hidden="true" />
              <span>{stage}</span>
            </li>
          ) : null}
        </ul>

        {fields.length ? (
          <ul aria-label="Fields" className="mt-4 flex flex-wrap gap-2">
            {fields.map((field) => (
              <li
                key={field}
                className="rounded-full bg-maroon-50 px-3 py-1 text-xs font-semibold text-maroon-700"
              >
                {field}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </header>
  );
}
