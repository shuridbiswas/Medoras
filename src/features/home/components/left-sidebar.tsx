import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarUrl } from "@/lib/storage-url";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { appNav } from "@/features/home/nav";
import { MEMBER_TYPES } from "@/features/onboarding/options";
import { cn } from "@/lib/utils";

/** Left rail: who you are, and where you can go. `current` marks the page you are on. */
export function LeftSidebar({
  profile,
  current = "home",
}: {
  profile: ProfileRow;
  current?: string;
}) {
  const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const role = MEMBER_TYPES.find((m) => m.value === profile.member_type)?.label;
  const profileHref = profile.username
    ? `/profile/${profile.username}`
    : "/profile/edit";

  return (
    <aside aria-label="Your account" className="space-y-4">
      <section
        aria-labelledby="sidebar-profile"
        className="overflow-hidden rounded-2xl border border-border bg-surface"
      >
        <div className="h-14 bg-maroon-700" aria-hidden="true" />
        <div className="-mt-7 px-4 pb-4">
          <Link href={profileHref} tabIndex={-1} aria-hidden="true">
            <MemberAvatar
              name={profile.first_name}
              src={avatarUrl(profile.avatar_path)}
              className="size-14 border-2 border-surface text-lg"
            />
          </Link>
          <h2 id="sidebar-profile" className="mt-2 truncate font-semibold text-maroon-900">
            <Link href={profileHref} className="hover:underline">
              {name}
            </Link>
          </h2>
          {profile.headline ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
              {profile.headline}
            </p>
          ) : role ? (
            <p className="mt-0.5 text-sm text-muted-foreground">{role}</p>
          ) : null}
        </div>
      </section>

      <nav
        aria-label="Sections"
        className="rounded-2xl border border-border bg-surface p-2"
      >
        <ul className="space-y-0.5">
          {appNav(profile.username).map(({ key, label, href, icon: Icon, soon }) => (
            <li key={key}>
              <Link
                href={href}
                aria-current={key === current ? "page" : undefined}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  key === current
                    ? "bg-maroon-50 text-maroon-800"
                    : "text-maroon-900/80 hover:bg-maroon-50 hover:text-maroon-900",
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
                {label}
                {soon ? (
                  <span className="ml-auto rounded-full bg-sand px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    Soon
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
