import Link from "next/link";
import { Globe, Lock, MapPin, Users } from "lucide-react";
import { chipClass } from "@/components/forms/controls";
import { countryName } from "@/features/profile/format";
import { kindLabel, ROLE_LABELS } from "@/features/communities/options";
import type { CommunityListItem } from "@/features/communities/queries";

export function CommunityCard({ community }: { community: CommunityListItem }) {
  const place = [community.region_label, community.country ? countryName(community.country) : null].filter(Boolean).join(", ");
  const href = `/communities/${community.slug}`;
  return (
    <article aria-label={community.name} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={chipClass}>{kindLabel(community.kind)}</span>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          {community.visibility === "private" ? (
            <>
              <Lock className="size-3.5" aria-hidden="true" /> Private
            </>
          ) : (
            <>
              <Globe className="size-3.5" aria-hidden="true" /> Public
            </>
          )}
        </span>
        {community.role ? (
          <span className="rounded-full border border-maroon-200 px-2 py-0.5 text-xs font-medium text-maroon-700">
            {ROLE_LABELS[community.role]}
          </span>
        ) : community.requestPending ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">Request sent</span>
        ) : null}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-maroon-900">
          <Link href={href} className="hover:underline">
            {community.name}
          </Link>
        </h3>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-maroon-900/85">{community.description}</p>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {community.memberCount !== null ? (
          <li className="flex items-center gap-1.5">
            <Users className="size-3.5 text-maroon-600" aria-hidden="true" />
            {community.memberCount} {community.memberCount === 1 ? "member" : "members"}
          </li>
        ) : null}
        {community.institution ? <li>{community.institution}</li> : null}
        {place ? (
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-maroon-600" aria-hidden="true" />
            {place}
          </li>
        ) : null}
      </ul>
    </article>
  );
}
