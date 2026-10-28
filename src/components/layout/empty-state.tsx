import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-maroon-200 bg-maroon-50/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-maroon-100 text-maroon-700">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold text-maroon-900">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
