import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plain statement of what the feed is and is not. Shown with the composer and under the feed.
 * It must stay accurate: verification and automated moderation are not active yet.
 */
export function SafetyNotice({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex gap-2 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <ShieldAlert
        className="mt-0.5 size-3.5 shrink-0 text-maroon-700"
        aria-hidden="true"
      />
      <span>
        <strong className="font-semibold text-maroon-900">
          Never share identifiable patient information.
        </strong>{" "}
        Posts are written by members and are not verified medical advice
        {compact ? "." : (
          <>
            . Member identities are not verified yet and posts are not
            automatically moderated.
          </>
        )}{" "}
        <Link
          href="/community-guidelines"
          className="font-medium text-maroon-700 underline underline-offset-2 hover:text-maroon-900"
        >
          Community guidelines
        </Link>
      </span>
    </p>
  );
}
