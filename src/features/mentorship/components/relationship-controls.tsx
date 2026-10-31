"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import {
  changeMentorshipStatus,
  decideMentorshipRequest,
  sendMentorshipRequest,
  submitMentorshipFeedback,
  withdrawMentorshipRequest,
} from "@/features/mentorship/actions";
import { GOALS_MAX, MENTOR_FORMATS } from "@/features/mentorship/options";
import type { Outcome } from "@/features/mentorship/state";
import type { MentorFormat, MentorshipStatus } from "@/lib/supabase/database.types";

function useRun() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<Outcome>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };
  const line = error ? (
    <p role="alert" className="mt-2 text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;
  return { run, pending, line };
}

/** The mentee explains their goals and sends a request. */
export function RequestForm({ mentorId, mentorName, formats }: { mentorId: string; mentorName: string; formats: MentorFormat[] }) {
  const id = useId();
  const [goals, setGoals] = useState("");
  const [format, setFormat] = useState("");
  const { run, pending, line } = useRun();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => sendMentorshipRequest(mentorId, goals, format), () => setGoals(""));
      }}
      className="space-y-3"
      noValidate
    >
      <div>
        <label htmlFor={`${id}-goals`} className={labelClass}>
          What would you like help with from {mentorName}?
        </label>
        <textarea
          id={`${id}-goals`}
          value={goals}
          onChange={(e) => setGoals(e.target.value)}
          rows={5}
          maxLength={GOALS_MAX}
          className={textareaClass}
          placeholder="Your goals, what you've tried, and what a good outcome looks like. Don't include patient information."
        />
        <p className="mt-1 text-right text-xs text-muted-foreground" aria-hidden="true">{goals.length}/{GOALS_MAX}</p>
      </div>
      <div className="max-w-xs">
        <label htmlFor={`${id}-format`} className={labelClass}>
          Preferred format (optional)
        </label>
        <select id={`${id}-format`} value={format} onChange={(e) => setFormat(e.target.value)} className={controlClass}>
          <option value="">No preference</option>
          {MENTOR_FORMATS.filter((f) => formats.includes(f.value)).map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>
      {line}
      <Button type="submit" disabled={pending || goals.trim().length < 20} className="h-10 px-5">
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}

export function WithdrawRequestButton({ requestId }: { requestId: string }) {
  const { run, pending, line } = useRun();
  return (
    <div>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => withdrawMentorshipRequest(requestId))} className="h-9 px-3 text-sm">
        Withdraw request
      </Button>
      {line}
    </div>
  );
}

/** The mentor accepts, or declines with an optional kind note. */
export function DecideRequestControls({ requestId, name }: { requestId: string; name: string }) {
  const id = useId();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const { run, pending, line } = useRun();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={() => run(() => decideMentorshipRequest(requestId, true))} className="h-9 px-4 text-sm" aria-label={`Accept ${name}`}>
          Accept
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setDeclining((v) => !v)} aria-expanded={declining} className="h-9 px-4 text-sm" aria-label={`Decline ${name}`}>
          Decline
        </Button>
      </div>
      {declining ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <label htmlFor={`${id}-note`} className={labelClass}>
            A short, kind note for {name} (optional)
          </label>
          <textarea id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} className={textareaClass} />
          <Button type="button" disabled={pending} onClick={() => run(() => decideMentorshipRequest(requestId, false, note))} className="h-9 px-4 text-sm">
            {pending ? "Declining…" : "Decline request"}
          </Button>
        </div>
      ) : null}
      {line}
    </div>
  );
}

/** Pause, resume, complete or end a mentorship. Only the mentor can pause or resume. */
export function MentorshipControls({ mentorshipId, status, role }: { mentorshipId: string; status: MentorshipStatus; role: "mentor" | "mentee" }) {
  const { run, pending, line } = useRun();
  const [confirm, setConfirm] = useState<"completed" | "ended" | null>(null);
  if (status === "completed" || status === "ended") return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {role === "mentor" ? (
          <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => changeMentorshipStatus(mentorshipId, status === "active" ? "paused" : "active"))} className="h-9 px-4 text-sm">
            {status === "active" ? "Pause" : "Resume"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={pending} onClick={() => setConfirm("completed")} className="h-9 px-4 text-sm">
          Mark as completed
        </Button>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => setConfirm("ended")} className="h-9 px-3 text-sm text-muted-foreground">
          End early
        </Button>
      </div>
      {confirm ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            {confirm === "completed" ? "Mark this mentorship as completed? You can both leave feedback afterwards." : "End this mentorship early? The other person is told."}
          </span>
          <Button type="button" disabled={pending} onClick={() => run(() => changeMentorshipStatus(mentorshipId, confirm), () => setConfirm(null))} className="h-9 px-4 text-sm">
            Yes
          </Button>
          <Button type="button" variant="ghost" onClick={() => setConfirm(null)} className="h-9 px-3 text-sm">
            Cancel
          </Button>
        </div>
      ) : null}
      {line}
    </div>
  );
}

/** Private feedback, readable by the two people only. */
export function FeedbackForm({ mentorshipId }: { mentorshipId: string }) {
  const id = useId();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const { run, pending, line } = useRun();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => submitMentorshipFeedback(mentorshipId, Number(rating), comment));
      }}
      className="space-y-3"
      noValidate
    >
      <div className="max-w-xs">
        <label htmlFor={`${id}-rating`} className={labelClass}>
          How helpful was it? (1 to 5)
        </label>
        <select id={`${id}-rating`} value={rating} onChange={(e) => setRating(e.target.value)} className={controlClass}>
          <option value="">Choose</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-comment`} className={labelClass}>
          Comments (optional)
        </label>
        <textarea id={`${id}-comment`} value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className={textareaClass} />
        <p className="mt-1 text-xs text-muted-foreground">Only you and the other person can read this. It isn&apos;t shown publicly.</p>
      </div>
      {line}
      <Button type="submit" disabled={pending || !rating} className="h-10 px-5">
        {pending ? "Sending…" : "Send feedback"}
      </Button>
    </form>
  );
}
