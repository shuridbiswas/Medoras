import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { MemberAvatar } from "@/components/member-avatar";
import { LinkButton } from "@/components/ui/link-button";
import { avatarUrl } from "@/lib/storage-url";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { FIELDS } from "@/features/onboarding/options";
import { UPCOMING_FEATURES } from "@/features/home/content";
import {
  getActiveCategories,
  getNewMembers,
  getOpenMentors,
  type MemberSummary,
} from "@/features/home/queries";
import { RelationshipActions } from "@/features/network/components/relationship-actions";
import { getRelationships } from "@/features/network/queries";
import { noRelationship, type Relationship } from "@/features/network/types";

function Card({
  id,
  title,
  note,
  action,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-surface p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={id} className="font-semibold text-maroon-900">
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            aria-label={action.label}
            className="text-maroon-700 transition-colors hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </div>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MemberRow({
  member,
  relationship,
}: {
  member: MemberSummary;
  relationship?: Relationship;
}) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
  return (
    <li className="space-y-2 rounded-lg p-1.5">
      <Link
        href={`/profile/${member.username}`}
        className="flex items-center gap-3 rounded-lg transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MemberAvatar
          name={member.first_name}
          src={avatarUrl(member.avatar_path)}
          className="size-10 text-sm"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-maroon-900">{name}</span>
          {member.headline ? (
            <span className="block truncate text-xs text-muted-foreground">
              {member.headline}
            </span>
          ) : null}
        </span>
      </Link>
      {relationship ? (
        <RelationshipActions
          memberId={member.id}
          name={name}
          initial={relationship}
          compact
          showFollow={false}
          className="pl-[3.25rem]"
        />
      ) : null}
    </li>
  );
}

/**
 * Right rail. All of it is real data: newly joined members, interests you have not listed,
 * categories that had posts this week, and members who say they can mentor. Empty means empty.
 */
export async function RightSidebar({ profile }: { profile: ProfileRow }) {
  const [members, mentors, active] = await Promise.all([
    getNewMembers(profile.id),
    getOpenMentors(profile.id),
    getActiveCategories(),
  ]);
  const relationships = await getRelationships(profile.id, [
    ...members.map((m) => m.id),
    ...mentors.map((m) => m.id),
  ]);
  const interests = FIELDS.filter((f) => !profile.fields.includes(f.value)).slice(0, 6);

  return (
    <aside aria-label="Discover" className="space-y-4">
      <section
        aria-labelledby="rail-welcome"
        className="relative overflow-hidden rounded-2xl border border-maroon-100 bg-maroon-50 p-5"
      >
        <LogoMark className="pointer-events-none absolute -top-2 -right-3 h-20 w-auto opacity-[0.14]" />
        <h2 id="rail-welcome" className="relative font-display text-xl font-bold text-maroon-800">
          Welcome to Medyra
        </h2>
        <p className="relative mt-1.5 text-sm leading-relaxed text-maroon-900/75">
          A space for healthcare and social services students, professionals and researchers.
        </p>
        <LinkButton href="/network" className="relative mt-3 h-10 rounded-xl px-4 text-sm">
          Find people
          <ArrowRight className="size-4" aria-hidden="true" />
        </LinkButton>
      </section>

      <Card
        id="rail-members"
        title="New members"
        note="Recently joined. Not a ranking or a match."
        action={{ href: "/network", label: "Open the directory" }}
      >
        {members.length > 0 ? (
          <ul className="space-y-1">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                relationship={relationships.get(m.id) ?? noRelationship}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No other members have finished joining yet.
          </p>
        )}
      </Card>

      <Card
        id="rail-categories"
        title="Active this week"
        note="Categories with new posts in the last 7 days."
      >
        {active.length > 0 ? (
          <ol className="space-y-1">
            {active.map((c, i) => (
              <li key={c.value}>
                <Link
                  href={`/?category=${c.value}`}
                  className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 text-sm text-maroon-900 transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-xs font-semibold text-maroon-700"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.count} {c.count === 1 ? "post" : "posts"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Categories show up here once members post.
          </p>
        )}
      </Card>

      <Card
        id="rail-interests"
        title="Explore fields"
        note="Find members in other fields of practice."
      >
        <ul className="flex flex-wrap gap-2">
          {interests.map((f) => (
            <li key={f.value}>
              <Link
                href={`/network?field=${f.value}`}
                className="inline-flex h-8 items-center rounded-full border border-maroon-200 bg-maroon-50 px-3 text-xs font-medium text-maroon-800 transition-colors hover:bg-maroon-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        id="rail-mentors"
        title="Mentorship"
        note="Self-reported. Mentor matching is not built yet."
      >
        {mentors.length > 0 ? (
          <>
            <p className="mb-2 text-xs text-muted-foreground">
              Members who say they are open to mentoring:
            </p>
            <ul className="space-y-1">
              {mentors.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  relationship={relationships.get(m.id) ?? noRelationship}
                />
              ))}
            </ul>
            <Link
              href="/network?mentorship=offering"
              className="mt-2 inline-block text-sm font-medium text-maroon-700 hover:text-maroon-900 hover:underline"
            >
              See all
            </Link>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No members have said they are open to mentoring yet. You can
            change yours in{" "}
            <Link
              href="/profile/edit#mentorship"
              className="font-medium text-maroon-700 underline underline-offset-2"
            >
              your profile
            </Link>
            .
          </p>
        )}
      </Card>

      <Card id="rail-upcoming" title="Coming to Medyra" note="Planned. Not available yet.">
        <ul className="space-y-2">
          {UPCOMING_FEATURES.map((f) => (
            <li key={f.title} className="text-sm">
              <span className="font-medium text-maroon-900">{f.title}</span>
              <span className="block text-xs text-muted-foreground">{f.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}

export function RightSidebarSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Loading suggestions</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-40 animate-pulse rounded-2xl border border-border bg-surface motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}
