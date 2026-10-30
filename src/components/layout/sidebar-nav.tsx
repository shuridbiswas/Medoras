"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { appNav, isActivePath } from "@/features/home/nav";
import { cn } from "@/lib/utils";

/**
 * Desktop navigation. `badges` maps a nav key to a server-rendered badge (e.g. pending requests
 * on Network), so the counts stay out of this client component.
 */
export function SidebarNav({
  username,
  badges = {},
}: {
  username: string | null;
  badges?: Record<string, React.ReactNode>;
}) {
  const pathname = usePathname();
  const items = appNav(username);

  const render = (group: "primary" | "secondary") => (
    <ul className="space-y-1">
      {items
        .filter((i) => i.group === group)
        .map(({ key, label, href, icon: Icon, soon }) => {
          const active = isActivePath(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[0.95rem] font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  active
                    ? "bg-maroon-100/70 text-maroon-800"
                    : "text-maroon-900/75 hover:bg-maroon-50 hover:text-maroon-900",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
                {soon ? (
                  <span className="ml-auto rounded-full bg-sand px-2 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
                    Soon
                  </span>
                ) : (
                  <span className="ml-auto">{badges[key]}</span>
                )}
              </Link>
            </li>
          );
        })}
    </ul>
  );

  return (
    <nav aria-label="Sections" className="space-y-3">
      {render("primary")}
      <div className="border-t border-border pt-3">{render("secondary")}</div>
    </nav>
  );
}
