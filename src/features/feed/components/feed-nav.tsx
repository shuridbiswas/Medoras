import Link from "next/link";
import { POST_CATEGORIES, type PostCategory } from "@/features/feed/options";
import { cn } from "@/lib/utils";

export type FeedScope = "following";

const href = (scope: FeedScope | undefined, category?: PostCategory) => {
  const params = new URLSearchParams();
  if (scope) params.set("feed", scope);
  if (category) params.set("category", category);
  const query = params.toString();
  return query ? `/?${query}` : "/";
};

/**
 * Feed navigation. Two views: Latest (everyone, newest first) and Following (members you
 * follow). Categories filter either view. Nothing ranks or personalizes posts, so there is no
 * "For you" or "Popular" view.
 */
export function FeedNav({
  active,
  scope,
}: {
  active?: PostCategory;
  scope?: FeedScope;
}) {
  const views = [
    { href: href(undefined, active), label: "Latest", current: !scope },
    { href: href("following", active), label: "Following", current: scope === "following" },
  ];
  const chips = [
    { href: href(scope), label: "All", current: !active },
    ...POST_CATEGORIES.map((c) => ({
      href: href(scope, c.value),
      label: c.label,
      current: active === c.value,
    })),
  ];

  return (
    <div className="space-y-3">
      <nav aria-label="Feed view" className="border-b border-border">
        <ul className="flex gap-1">
          {views.map((v) => (
            <li key={v.label}>
              <Link
                href={v.href}
                scroll={false}
                aria-current={v.current ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  v.current
                    ? "border-maroon-600 text-maroon-700"
                    : "border-transparent text-muted-foreground hover:text-maroon-900",
                )}
              >
                {v.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <nav aria-label="Feed categories" className="-mx-4 sm:mx-0">
        <ul className="flex gap-2 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0">
          {chips.map((item) => (
            <li key={item.label} className="shrink-0">
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
    </div>
  );
}
