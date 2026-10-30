import { Suspense } from "react";
import Link from "next/link";
import { RequestCountBadge } from "@/features/network/components/request-count";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "discover", label: "Discover", href: "/network" },
  { key: "requests", label: "Requests", href: "/network/requests" },
  { key: "connections", label: "Connections", href: "/network/connections" },
] as const;

export type NetworkTab = (typeof TABS)[number]["key"];

/** Sub-navigation for the network pages (real links, so each tab is its own URL). */
export function NetworkTabs({ current, userId }: { current: NetworkTab; userId: string }) {
  return (
    <nav aria-label="Network" className="border-b border-border">
      <ul className="flex gap-1">
        {TABS.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === current ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                t.key === current
                  ? "border-maroon-600 text-maroon-700"
                  : "border-transparent text-muted-foreground hover:text-maroon-900",
              )}
            >
              {t.label}
              {t.key === "requests" ? (
                <Suspense fallback={null}>
                  <RequestCountBadge userId={userId} />
                </Suspense>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
