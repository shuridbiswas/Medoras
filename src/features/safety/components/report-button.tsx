"use client";

import { useId, useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitReport } from "@/features/safety/actions";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "@/features/safety/options";
import type { ReportInput } from "@/features/safety/schemas";
import { cn } from "@/lib/utils";

/**
 * "Report" for a post, comment or profile. Opens a small inline form (no pop-up to get stuck in).
 * Reports are read by people on the Medyra team; nothing is screened automatically, and the form
 * says so and points to emergency services for anyone in immediate danger.
 */
export function ReportButton({
  targetType,
  targetId,
  className,
  label = "Report",
}: {
  targetType: ReportInput["targetType"];
  targetId: string;
  className?: string;
  label?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitReport({ targetType, targetId, reason, details });
      if (result.ok) setSent(true);
      else setError(result.error);
    });
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-form`}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Flag className="size-3.5" aria-hidden="true" />
        {label}
      </button>

      {open ? (
        <div id={`${id}-form`} className="mt-2 rounded-xl border border-border bg-surface p-3.5 text-sm shadow-xs">
          {sent ? (
            <p role="status" className="text-maroon-900">
              Thank you. A person on the Medyra team will review this. You won&apos;t see the outcome, and a
              report doesn&apos;t remove anything by itself.
            </p>
          ) : (
            <form onSubmit={send} className="space-y-3" noValidate>
              <fieldset className="space-y-1.5">
                <legend className="font-semibold text-maroon-900">Why are you reporting this {targetType}?</legend>
                {REPORT_REASONS.map((r) => (
                  <label key={r.value} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name={`${id}-reason`}
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="mt-1 accent-maroon-700"
                    />
                    <span>{r.label}</span>
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor={`${id}-details`} className="mb-1 block text-xs font-semibold text-maroon-900">
                  Anything we should know? (optional)
                </label>
                <textarea
                  id={`${id}-details`}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={REPORT_DETAILS_MAX}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Don&apos;t include patient information. Reports are reviewed by people; nothing is screened
                  automatically.
                </p>
              </div>
              <p className="rounded-lg bg-maroon-50 p-2.5 text-xs text-maroon-900">
                If someone is in immediate danger, contact your local emergency number now. Medyra is not a crisis
                service and can&apos;t respond in real time.
              </p>
              {error ? (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={pending || !reason} className="h-9 px-4 text-sm">
                  {pending ? "Sending…" : "Send report"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} className={cn("h-9 px-3 text-sm")}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
