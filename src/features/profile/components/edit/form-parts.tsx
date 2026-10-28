"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import type { ProfileFormState } from "@/features/profile/schemas";
import { cn } from "@/lib/utils";

export function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5 sm:p-7"
    >
      <h2 id={`${id}-title`} className="text-xl font-bold text-maroon-900">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Announces the result of the last save. Errors and successes are both read out by screen readers. */
export function FormStatus({ state }: { state: ProfileFormState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <FormAlert tone={state.status === "success" ? "success" : "error"}>
      {state.message}
    </FormAlert>
  );
}

function SaveButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-10 px-5">
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
          />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}

/** Save and Cancel. Cancel returns to where the member came from (or runs onCancel). */
export function SaveBar({
  label = "Save changes",
  pendingLabel = "Saving…",
  cancelHref,
  onCancel,
  className,
}: {
  label?: string;
  pendingLabel?: string;
  cancelHref?: string;
  onCancel?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <SaveButton label={label} pendingLabel={pendingLabel} />
      {onCancel ? (
        <Button
          type="button"
          variant="ghost"
          className="h-10 px-4"
          onClick={onCancel}
        >
          Cancel
        </Button>
      ) : cancelHref ? (
        <Link
          href={cancelHref}
          className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium text-maroon-900/80 transition-colors hover:bg-muted"
        >
          Cancel
        </Link>
      ) : null}
    </div>
  );
}
