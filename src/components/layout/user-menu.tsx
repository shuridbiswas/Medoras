"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown, LogOut, Settings, User } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { signOut } from "@/features/auth/actions";

const item =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-maroon-900 outline-none data-highlighted:bg-maroon-50";

/** Account dropdown: profile, settings, sign out. Keyboard and screen reader friendly (Base UI Menu). */
export function UserMenu({
  name,
  username,
  avatarSrc,
}: {
  name: string;
  username: string | null;
  avatarSrc: string | null;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Account menu for ${name}`}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 outline-none transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-maroon-50"
      >
        <MemberAvatar name={name} src={avatarSrc} className="size-8 text-xs" />
        <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50">
          <Menu.Popup className="min-w-56 rounded-xl border border-border bg-surface p-1.5 shadow-lg outline-none">
            <div className="px-3 pt-2 pb-2.5">
              <p className="truncate text-sm font-semibold text-maroon-900">{name}</p>
              {username ? (
                <p className="truncate text-xs text-muted-foreground">@{username}</p>
              ) : null}
            </div>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.LinkItem
              href={username ? `/profile/${username}` : "/profile/edit"}
              className={item}
            >
              <User className="size-4" aria-hidden="true" />
              My profile
            </Menu.LinkItem>
            <Menu.LinkItem href="/settings" className={item}>
              <Settings className="size-4" aria-hidden="true" />
              Settings
            </Menu.LinkItem>
            <Menu.Separator className="my-1 h-px bg-border" />
            <form action={signOut}>
              <Menu.Item render={<button type="submit" />} className={item}>
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </Menu.Item>
            </form>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
