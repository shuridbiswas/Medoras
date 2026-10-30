import { Suspense } from "react";
import { Plus, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { LinkButton } from "@/components/ui/link-button";
import {
  BellLink,
  NotificationBell,
} from "@/features/notifications/components/notification-bell";
import { RequestCountBadge } from "@/features/network/components/request-count";
import { avatarUrl } from "@/lib/storage-url";
import type { ProfileRow } from "@/lib/supabase/database.types";

export type HeaderMember = Pick<
  ProfileRow,
  "id" | "username" | "first_name" | "last_name" | "avatar_path"
>;

/**
 * Chrome for signed-in pages: a fixed sidebar on large screens (logo, navigation, New Post), a
 * top bar (search, notifications, account menu), and a bottom tab bar on phones. Wrap the page
 * in <AppFrame> so the content clears the sidebar.
 */
export function AppHeader({ member }: { member: HeaderMember }) {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");

  return (
    <>
      <aside
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface lg:flex"
      >
        <div className="flex h-16 shrink-0 items-center px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <SidebarNav
            username={member.username}
            badges={{
              network: (
                <Suspense fallback={null}>
                  <RequestCountBadge userId={member.id} />
                </Suspense>
              ),
            }}
          />
        </div>
        <div className="shrink-0 p-4">
          <LinkButton href="/#composer" className="h-11 w-full rounded-xl text-[0.95rem]">
            <Plus className="size-4.5" aria-hidden="true" />
            New Post
          </LinkButton>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-surface">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <Logo className="lg:hidden" />

          <form role="search" action="/network" method="get" className="mx-auto hidden max-w-xl flex-1 md:block lg:mx-0">
            <label htmlFor="header-search" className="sr-only">
              Search members
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="header-search"
                name="q"
                type="search"
                maxLength={60}
                placeholder="Search members by name or username"
                className="h-11 w-full rounded-full border border-transparent bg-sand pr-4 pl-10 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-surface focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1">
            <Suspense fallback={<BellLink />}>
              <NotificationBell userId={member.id} />
            </Suspense>
            <UserMenu
              name={name}
              username={member.username}
              avatarSrc={avatarUrl(member.avatar_path)}
            />
          </div>
        </div>
      </header>
      <MobileTabBar username={member.username} />
    </>
  );
}
