"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, LogOut, Menu, PenSquare, Search, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { signOut } from "@/features/auth/actions";
import { appNav, isActivePath } from "@/features/home/nav";
import { cn } from "@/lib/utils";

const tab =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium outline-none transition-colors focus-visible:bg-maroon-50";

/** Phone navigation: the five things members need most, with the composer one tap away. */
export function MobileTabBar({ username }: { username: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const profileHref = username ? `/profile/${username}` : "/profile/edit";

  const links = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/search", label: "Search", icon: Search },
    { href: "/home#composer", label: "Post", icon: PenSquare, primary: true },
    { href: profileHref, label: "Profile", icon: User },
  ];

  return (
    <>
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        <ul className="flex">
          {links.map(({ href, label, icon: Icon, primary }) => {
            const active =
              !href.includes("#") && isActivePath(pathname, href.split("#")[0]);
            return (
              <li key={label} className="flex flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    tab,
                    active ? "text-maroon-700" : "text-muted-foreground",
                  )}
                >
                  {primary ? (
                    <span className="flex size-9 items-center justify-center rounded-full bg-maroon-700 text-white">
                      <Icon className="size-4.5" aria-hidden="true" />
                    </span>
                  ) : (
                    <Icon className="size-5" aria-hidden="true" />
                  )}
                  {label}
                </Link>
              </li>
            );
          })}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cn(tab, "text-muted-foreground")}
            >
              <Menu className="size-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl p-4 pb-6">
          <SheetHeader className="p-0">
            <SheetTitle className="text-base font-semibold text-maroon-900">
              Menu
            </SheetTitle>
          </SheetHeader>
          <ul className="space-y-0.5">
            {appNav(username).map(({ key, label, href, icon: Icon, soon }) => (
              <li key={key}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-maroon-900 transition-colors hover:bg-maroon-50"
                >
                  <Icon className="size-4.5" aria-hidden="true" />
                  {label}
                  {soon ? (
                    <span className="ml-auto text-xs font-normal text-muted-foreground">
                      Coming soon
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <form action={signOut}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-maroon-900 transition-colors hover:bg-maroon-50"
            >
              <LogOut className="size-4.5" aria-hidden="true" />
              Sign out
            </button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
