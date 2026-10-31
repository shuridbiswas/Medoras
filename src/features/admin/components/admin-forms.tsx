"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  claimReport,
  decideAppeal,
  executeDeletion,
  moderateReport,
  setMemberStatus,
  setRetention,
} from "@/features/admin/actions";
import type { AdminFormState } from "@/features/admin/schemas";

const idle: AdminFormState = { status: "idle" };
const control =
  "w-full rounded-lg border border-input bg-surface px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Result({ state }: { state: AdminFormState }) {
  if (state.status === "idle") return null;
  return <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert>;
}

/** Take a report from "open" to "reviewing", so two people don't handle the same one. */
export function ClaimButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        className="h-9 px-3 text-sm"
        onClick={() =>
          startTransition(async () => {
            const result = await claimReport(reportId);
            if (result.ok) router.refresh();
            else setError(result.error ?? "Something went wrong.");
          })
        }
      >
        Start review
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Record a decision on one report. Everything but "dismiss" needs a message the member will see. */
export function ReportDecisionForm({ reportId, targetType }: { reportId: string; targetType: string }) {
  const [state, action, pending] = useActionState(moderateReport, idle);
  const [decision, setDecision] = useState("dismiss");
  const canRemove = ["post", "comment", "question", "answer", "reply", "community"].includes(targetType);

  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-sand/40 p-3.5" noValidate>
      <input type="hidden" name="reportId" value={reportId} />
      <div>
        <label htmlFor={`d-${reportId}`} className="mb-1 block text-xs font-semibold text-maroon-900">
          Decision
        </label>
        <select id={`d-${reportId}`} name="decision" value={decision} onChange={(e) => setDecision(e.target.value)} className={control}>
          <option value="dismiss">Dismiss (no action)</option>
          <option value="warn">Warn the member</option>
          {canRemove ? <option value="remove_content">{targetType === "community" ? "Close the community and notify its creator" : `Remove the ${targetType} and notify the member`}</option> : null}
          <option value="suspend">Suspend the member</option>
        </select>
      </div>
      {decision !== "dismiss" ? (
        <div>
          <label htmlFor={`m-${reportId}`} className="mb-1 block text-xs font-semibold text-maroon-900">
            Message to the member (they will see this and can appeal)
          </label>
          <textarea id={`m-${reportId}`} name="memberMessage" rows={3} maxLength={1000} className={control} />
        </div>
      ) : null}
      <div>
        <label htmlFor={`n-${reportId}`} className="mb-1 block text-xs font-semibold text-maroon-900">
          Internal note (staff only)
        </label>
        <textarea id={`n-${reportId}`} name="note" rows={2} maxLength={1000} className={control} />
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending || state.status === "success"} className="h-9 px-4 text-sm">
        {pending ? "Saving…" : "Record decision"}
      </Button>
    </form>
  );
}

export function AppealDecisionForm({ appealId }: { appealId: string }) {
  const [state, action, pending] = useActionState(decideAppeal, idle);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-border bg-sand/40 p-3.5" noValidate>
      <input type="hidden" name="appealId" value={appealId} />
      <div>
        <label htmlFor={`ad-${appealId}`} className="mb-1 block text-xs font-semibold text-maroon-900">
          Decision
        </label>
        <select id={`ad-${appealId}`} name="decision" defaultValue="upheld" className={control}>
          <option value="upheld">Uphold the original decision</option>
          <option value="overturned">Overturn it (restores a suspended account)</option>
        </select>
      </div>
      <div>
        <label htmlFor={`an-${appealId}`} className="mb-1 block text-xs font-semibold text-maroon-900">
          Note to the member
        </label>
        <textarea id={`an-${appealId}`} name="note" rows={3} maxLength={1000} className={control} />
      </div>
      <Result state={state} />
      <Button type="submit" disabled={pending || state.status === "success"} className="h-9 px-4 text-sm">
        {pending ? "Saving…" : "Decide appeal"}
      </Button>
    </form>
  );
}

/** Suspend or restore a member directly (not from a report). Always sends the member a message. */
export function MemberStatusForm({ memberId, status, name }: { memberId: string; status: "active" | "suspended"; name: string }) {
  const [state, action, pending] = useActionState(setMemberStatus, idle);
  const next = status === "suspended" ? "active" : "suspended";
  return (
    <form action={action} className="space-y-2" noValidate>
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="status" value={next} />
      <label htmlFor={`sm-${memberId}`} className="block text-xs font-semibold text-maroon-900">
        {next === "suspended" ? `Message to ${name} (they will see this and can appeal)` : `Message to ${name}`}
      </label>
      <textarea id={`sm-${memberId}`} name="message" rows={2} maxLength={1000} className={control} />
      <label htmlFor={`sr-${memberId}`} className="block text-xs font-semibold text-maroon-900">
        Internal reason (staff only)
      </label>
      <input id={`sr-${memberId}`} name="reason" maxLength={500} className={control} />
      <Result state={state} />
      <Button type="submit" variant={next === "suspended" ? "outline" : "default"} disabled={pending} className="h-9 px-4 text-sm">
        {next === "suspended" ? "Suspend member" : "Restore member"}
      </Button>
    </form>
  );
}

export function DeletionButton({ requestId, due, name }: { requestId: string; due: boolean; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!due) return <span className="text-xs text-muted-foreground">Cooling-off period not over</span>;
  return (
    <div className="text-sm">
      {confirming ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Permanently delete {name}&apos;s account and content?</span>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="h-9 border-destructive/40 px-3 text-destructive hover:text-destructive"
            onClick={() =>
              startTransition(async () => {
                const result = await executeDeletion(requestId);
                if (result.ok) router.refresh();
                else setError(result.error ?? "Something went wrong.");
              })
            }
          >
            Yes, delete
          </Button>
          <Button type="button" variant="ghost" className="h-9 px-3" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </span>
      ) : (
        <Button type="button" variant="outline" className="h-9 px-3" onClick={() => setConfirming(true)} aria-label={`Delete ${name}'s account`}>
          Carry out deletion
        </Button>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RetentionForm({ policy }: { policy: { key: string; days: number; description: string } }) {
  const [state, action, pending] = useActionState(setRetention, idle);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3" noValidate>
      <input type="hidden" name="key" value={policy.key} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`rt-${policy.key}`} className="block text-sm font-semibold text-maroon-900">
          {policy.key.replace(/_/g, " ")}
        </label>
        <p className="text-xs text-muted-foreground">{policy.description}</p>
      </div>
      <input
        id={`rt-${policy.key}`}
        name="days"
        type="number"
        min={1}
        max={3650}
        defaultValue={policy.days}
        aria-label={`Days to keep ${policy.key.replace(/_/g, " ")}`}
        className="h-9 w-24 rounded-lg border border-input bg-surface px-2 text-sm"
      />
      <Button type="submit" variant="outline" disabled={pending} className="h-9 px-3 text-sm">
        Save
      </Button>
      {state.status !== "idle" ? (
        <p role={state.status === "error" ? "alert" : "status"} className={state.status === "error" ? "w-full text-xs text-destructive" : "w-full text-xs text-maroon-700"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
