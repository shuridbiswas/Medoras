import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
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

function Card({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-border bg-surface p-4"
    >
      <h2 id={id} className="font-semibold text-maroon-900">
        {title}
      </h2>
      {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MemberRow({ member }: { member: MemberSummary }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
  return (
    <li>
      <Link
        href={`/profile/${member.username}`}
        className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MemberAvatar
          name={member.first_name}
          src={avatarUrl(member.avatar_path)}
          className="size-9 text-sm"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-maroon-900">
            {name}
          </span>
          {member.headline ? (
            <span className="block truncate text-xs text-muted-foreground">
              {member.headline}
            </span>
          ) : null}
        </span>
      </Link>
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
  const interests = FIELDS.filter((f) => !profile.fields.includes(f.value)).slice(0, 6);

  return (
    <aside aria-label="Discover" className="space-y-4">
      <Card
        id="rail-members"
        title="New members"
        note="Recently joined. Not a ranking or a match."
      >
        {members.length > 0 ? (
          <ul className="space-y-0.5">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No other members have finished joining yet.
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
                href={`/search?field=${f.value}`}
                className="inline-flex h-8 items-center rounded-full border border-maroon-200 bg-maroon-50 px-3 text-xs font-medium text-maroon-800 transition-colors hover:bg-maroon-100 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {f.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        id="rail-categories"
        title="Active this week"
        note="Categories with new posts in the last 7 days."
      >
        {active.length > 0 ? (
          <ul className="space-y-1">
            {active.map((c) => (
              <li key={c.value}>
                <Link
                  href={`/home?category=${c.value}`}
                  className="flex items-center justify-between rounded-lg px-1.5 py-1.5 text-sm text-maroon-900 transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {c.label}
                  <span className="text-xs text-muted-foreground">
                    {c.count} {c.count === 1 ? "post" : "posts"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Categories show up here once members post.
          </p>
        )}
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
            <ul className="space-y-0.5">
              {mentors.map((m) => (
                <MemberRow key={m.id} member={m} />
              ))}
            </ul>
            <Link
              href="/search?mentors=1"
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

      <Card id="rail-upcoming" title="Coming to Medoras" note="Planned. Not available yet.">
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
