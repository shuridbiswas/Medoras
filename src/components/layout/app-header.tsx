import Link from "next/link";
import { Home, Search, User } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { UserMenu } from "@/components/layout/user-menu";
import { avatarUrl } from "@/lib/storage-url";
import type { ProfileRow } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

export type HeaderMember = Pick<
  ProfileRow,
  "username" | "first_name" | "last_name" | "avatar_path"
>;

const navLink =
  "hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-maroon-900/80 transition-colors hover:bg-maroon-50 hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none md:inline-flex";

/**
 * Header for signed-in pages: logo, member search, Home, Profile and the account menu.
 * On phones the same destinations move to a bottom tab bar. Pass the signed-in member.
 */
export function AppHeader({
  member,
  wide,
}: {
  member: HeaderMember;
  /** Match the three-column home layout width. */
  wide?: boolean;
}) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div
          className={cn(
            "mx-auto flex h-16 items-center gap-3 px-4 sm:px-6",
            wide ? "max-w-7xl" : "max-w-5xl",
          )}
        >
          <Logo />

          <form
            role="search"
            action="/search"
            method="get"
            className="mx-2 hidden max-w-md flex-1 md:block"
          >
            <label htmlFor="header-search" className="sr-only">
              Search members
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="header-search"
                name="q"
                type="search"
                maxLength={60}
                placeholder="Search members by name or username"
                className="h-10 w-full rounded-full border border-input bg-sand/50 pr-4 pl-9 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </form>

          <nav aria-label="Main" className="ml-auto flex items-center gap-1">
            <Link href="/" className={navLink}>
              <Home className="size-4" aria-hidden="true" />
              Home
            </Link>
            <Link
              href={member.username ? `/profile/${member.username}` : "/profile/edit"}
              className={navLink}
            >
              <User className="size-4" aria-hidden="true" />
              Profile
            </Link>
            <UserMenu
              name={name}
              username={member.username}
              avatarSrc={avatarUrl(member.avatar_path)}
            />
          </nav>
        </div>
      </header>
      <MobileTabBar username={member.username} />
    </>
  );
}
