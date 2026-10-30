import Link from "next/link";
import { cn } from "@/lib/utils";

/** Four leaves around an "M": members growing together as one community. */
export function LogoMark({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <svg
      viewBox="210 243 992 688"
      className={cn("h-8 w-auto", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        className={tone === "light" ? "fill-white" : "fill-maroon-700"}
        d="M220 253 H360 C560 253 680 380 690 548 L475 377 V636 L300 628 C250 560 225 420 220 253 Z M 1192 253 H 1052 C 852 253 732 380 722 548 L 937 377 V 636 L 1112 628 C 1162 560 1187 420 1192 253 Z M297 660 C420 660 520 680 590 740 C640 785 662 850 672 921 H590 C440 921 340 800 297 660 Z M 1115 660 C 992 660 892 680 822 740 C 772 785 750 850 740 921 H 822 C 972 921 1072 800 1115 660 Z M533 500 C600 520 660 590 703 665 C746 590 806 520 880 500 V658 C800 690 740 780 703 895 C665 780 600 700 533 658 Z"
      />
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
        "font-display text-[1.45rem] font-bold tracking-tight",
        tone === "dark" ? "text-maroon-700" : "text-white",
        className,
      )}
    >
      Medyra
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
      aria-label="Medyra home"
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <LogoMark tone={tone} />
      <Wordmark tone={tone} />
    </Link>
  );
}
