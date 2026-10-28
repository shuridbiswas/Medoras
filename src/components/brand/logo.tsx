import Link from "next/link";
import { cn } from "@/lib/utils";

/** Two peaks joined by a bridge: an "M" built from people meeting in the middle. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("size-9", className)}
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="11" className="fill-teal-800" />
      <path
        d="M9.5 28V15.5c0-1.7 2.2-2.4 3.2-1L20 24l7.3-9.5c1-1.4 3.2-.7 3.2 1V28"
        fill="none"
        stroke="oklch(0.97 0.015 190)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="10.5" r="2.4" fill="oklch(0.68 0.12 50)" />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "font-display text-[1.45rem] font-semibold tracking-tight",
        tone === "dark" ? "text-teal-900" : "text-white",
        className,
      )}
    >
      Medoras
    </span>
  );
}

export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <Link
      href="/"
      aria-label="Medoras home"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark />
      <Wordmark tone={tone} />
    </Link>
  );
}
