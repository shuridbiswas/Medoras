import { EyeOff, Info } from "lucide-react";
import { ANONYMITY, EDUCATIONAL_NOTICE, NOT_CRISIS } from "@/features/forums/content";
import { cn } from "@/lib/utils";

/** What the forums are and are not. Shown on the forum home, the ask page and every question. */
export function EducationalNotice({ compact, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <p className={cn("flex gap-2 text-xs leading-relaxed text-muted-foreground", className)}>
        <Info className="mt-0.5 size-3.5 shrink-0 text-maroon-700" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-maroon-900">Peer perspectives for learning, not clinical advice.</strong> Not a
          consultation, diagnosis or patient-specific second opinion. Never share identifiable patient information.
        </span>
      </p>
    );
  }
  return (
    <section aria-labelledby="edu-notice" className={cn("rounded-2xl border border-maroon-200 bg-maroon-50/70 p-4 sm:p-5", className)}>
      <h2 id="edu-notice" className="flex items-center gap-2 text-sm font-semibold text-maroon-900">
        <Info className="size-4 text-maroon-700" aria-hidden="true" />
        {EDUCATIONAL_NOTICE.title}
      </h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-maroon-900/90">
        {EDUCATIONAL_NOTICE.points.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{NOT_CRISIS}</p>
    </section>
  );
}

/** What "anonymous" does and does not mean, next to the checkbox that offers it. */
export function AnonymityExplainer({ className }: { className?: string }) {
  return (
    <details className={cn("rounded-xl border border-border bg-sand/50 p-3 text-sm", className)}>
      <summary className="flex cursor-pointer items-center gap-2 font-medium text-maroon-700">
        <EyeOff className="size-4" aria-hidden="true" />
        What anonymous means
      </summary>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-maroon-900/90">
        {ANONYMITY.detail.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </details>
  );
}
