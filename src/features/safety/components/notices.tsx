"use client";

import { useActionState, useState } from "react";
import { Megaphone } from "lucide-react";
import { FormAlert } from "@/components/forms/fields";
import { RelativeTime } from "@/components/relative-time";
import { Button } from "@/components/ui/button";
import { submitAppeal, type AppealState } from "@/features/safety/actions";
import { APPEAL_MAX } from "@/features/safety/options";
import type { NoticeWithAppeal } from "@/features/safety/queries";

const idle: AppealState = { status: "idle" };

const TITLES: Record<NoticeWithAppeal["kind"], string> = {
  warning: "Warning",
  content_removed: "Content removed",
  suspended: "Account suspended",
  restored: "Account restored",
  appeal_decision: "Appeal decision",
};

const APPEALABLE = new Set<NoticeWithAppeal["kind"]>(["warning", "content_removed", "suspended"]);

function AppealForm({ noticeId }: { noticeId: string }) {
  const [state, action, pending] = useActionState(submitAppeal, idle);
  return (
    <form action={action} className="mt-3 space-y-2" noValidate>
      <input type="hidden" name="noticeId" value={noticeId} />
      <label htmlFor={`appeal-${noticeId}`} className="block text-xs font-semibold text-maroon-900">
        Why do you disagree with this decision?
      </label>
      <textarea
        id={`appeal-${noticeId}`}
        name="message"
        rows={4}
        maxLength={APPEAL_MAX}
        className="w-full resize-y rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      {state.status === "error" ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{state.message}</FormAlert> : null}
      <Button type="submit" disabled={pending || state.status === "success"} className="h-9 px-4 text-sm">
        {pending ? "Sending…" : "Send appeal"}
      </Button>
    </form>
  );
}

/** Messages from the Medyra team about moderation decisions, each with a way to appeal. */
export function ModerationNotices({ notices }: { notices: NoticeWithAppeal[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (notices.length === 0) return null;

  return (
    <section aria-labelledby="notices-title" className="rounded-2xl border border-maroon-200 bg-maroon-50/60 p-5">
      <h2 id="notices-title" className="flex items-center gap-2 font-bold text-maroon-900">
        <Megaphone className="size-4.5 text-maroon-700" aria-hidden="true" />
        Messages from the Medyra team
      </h2>
      <ul className="mt-3 space-y-4">
        {notices.map((n) => (
          <li key={n.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="flex flex-wrap items-center gap-x-2 font-semibold text-maroon-900">
              {TITLES[n.kind]}
              <RelativeTime iso={n.created_at} className="text-xs font-normal text-muted-foreground" />
            </p>
            <p className="mt-1 whitespace-pre-wrap text-maroon-900/90">{n.message}</p>

            {n.appeal ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Appeal {n.appeal.status === "open" ? "sent. A person will review it." : `decided: ${n.appeal.status === "overturned" ? "the decision was overturned" : "the decision stands"}.`}
                {n.appeal.decision_note ? ` ${n.appeal.decision_note}` : ""}
              </p>
            ) : APPEALABLE.has(n.kind) ? (
              open === n.id ? (
                <AppealForm noticeId={n.id} />
              ) : (
                <Button type="button" variant="outline" onClick={() => setOpen(n.id)} className="mt-3 h-9 px-3 text-sm">
                  Appeal this decision
                </Button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
