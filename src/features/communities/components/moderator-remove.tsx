"use client";

import { useId, useState, useTransition } from "react";
import { ShieldMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/forms/controls";
import { removeCommunityPost } from "@/features/communities/actions";
import { REMOVAL_REASONS } from "@/features/communities/options";

/**
 * A moderator's "remove this post" control. It needs a reason, which goes into the community's
 * moderator log (the reason only, never the post's text), and the author is told it was removed.
 */
export function ModeratorRemovePost({ postId, onRemoved }: { postId: string; onRemoved: (id: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeCommunityPost(postId, reason);
      if (result.ok) onRemoved(postId);
      else setError(result.error);
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <ShieldMinus className="size-3.5" aria-hidden="true" />
        Remove as moderator
      </button>
      {open ? (
        <div id={`${id}-panel`} className="mt-2 w-full max-w-sm space-y-2.5 rounded-xl border border-border bg-surface p-3.5 text-sm shadow-xs">
          <label htmlFor={`${id}-reason`} className="block text-xs font-semibold text-maroon-900">
            Reason (recorded in the moderator log; the author is told it was removed)
          </label>
          <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={controlClass}>
            <option value="">Choose a reason</option>
            {REMOVAL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" onClick={remove} disabled={pending || !reason} className="h-9 px-4 text-sm">
              {pending ? "Removing…" : "Remove post"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 px-3 text-sm">
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
