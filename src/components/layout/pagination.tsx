import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const link =
  "inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 text-sm font-medium text-maroon-900 transition-colors hover:bg-maroon-50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

/** Previous / next links with "Page X of Y". `hrefFor` builds the URL for a page number. */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label = "Pagination",
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3 pt-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={link}>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className={cn(link, "pointer-events-none opacity-40")} aria-hidden="true">
          <ChevronLeft className="size-4" />
          Previous
        </span>
      )}
      <p className="text-sm text-muted-foreground">
        Page {Math.min(page, pages)} of {pages}
      </p>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={link}>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(link, "pointer-events-none opacity-40")} aria-hidden="true">
          Next
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
