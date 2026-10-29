import Link from "next/link";
import { POST_CATEGORIES, type PostCategory } from "@/features/feed/options";
import { cn } from "@/lib/utils";

/**
 * Feed navigation. The feed is chronological (newest first); categories filter it. There is no
 * "Following" or "For you" view because nothing ranks or personalizes posts yet.
 */
export function FeedNav({ active }: { active?: PostCategory }) {
  const items = [
    { href: "/home", label: "Latest", current: !active },
    ...POST_CATEGORIES.map((c) => ({
      href: `/home?category=${c.value}`,
      label: c.label,
      current: active === c.value,
    })),
  ];

  return (
    <nav aria-label="Feed filters" className="-mx-4 sm:mx-0">
      <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
        {items.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link
              href={item.href}
              scroll={false}
              aria-current={item.current ? "page" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                item.current
                  ? "border-maroon-700 bg-maroon-700 text-white"
                  : "border-border bg-surface text-maroon-900/80 hover:bg-maroon-50 hover:text-maroon-900",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
