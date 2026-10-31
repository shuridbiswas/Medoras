"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2, X } from "lucide-react";
import { FormAlert, Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { controlClass, labelClass, textareaClass } from "@/components/forms/controls";
import {
  createAnnouncement,
  decideRequest,
  deleteAnnouncement,
  setMemberBan,
  setMemberRole,
} from "@/features/communities/actions";
import { REMOVAL_REASONS } from "@/features/communities/options";
import { idleCommunityForm, type ActionOutcome, type CommunityFormState } from "@/features/communities/types";
import type { CommunityRole } from "@/lib/supabase/database.types";

function useOutcome() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionOutcome>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }
  const line = error ? (
    <p role="alert" className="mt-1 text-xs font-medium text-destructive">
      {error}
    </p>
  ) : null;
  return { run, pending, line };
}

/** Approve or decline one request to join. */
export function RequestButtons({ requestId, name }: { requestId: string; name: string }) {
  const { run, pending, line } = useOutcome();
  return (
    <div>
      <div className="flex gap-2">
        <Button type="button" disabled={pending} onClick={() => run(() => decideRequest(requestId, true))} className="h-9 px-4 text-sm" aria-label={`Approve ${name}`}>
          <Check className="size-4" aria-hidden="true" />
          Approve
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => decideRequest(requestId, false))} className="h-9 px-4 text-sm" aria-label={`Decline ${name}`}>
          <X className="size-4" aria-hidden="true" />
          Decline
        </Button>
      </div>
      {line}
    </div>
  );
}

/** Owner: make a member a moderator, or return a moderator to member. Moderators and owner: remove. */
export function MemberControls({
  communityId,
  memberId,
  name,
  targetRole,
  viewerRole,
}: {
  communityId: string;
  memberId: string;
  name: string;
  targetRole: CommunityRole;
  viewerRole: CommunityRole;
}) {
  const id = useId();
  const { run, pending, line } = useOutcome();
  const [removing, setRemoving] = useState(false);
  const [reason, setReason] = useState("");

  const canChangeRole = viewerRole === "owner" && targetRole !== "owner";
  const canRemove = targetRole !== "owner" && (viewerRole === "owner" || targetRole === "member");
  if (!canChangeRole && !canRemove) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {canChangeRole ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => setMemberRole(communityId, memberId, targetRole === "moderator" ? "member" : "moderator"))}
            className="h-8 px-3 text-xs"
            aria-label={targetRole === "moderator" ? `Return ${name} to member` : `Make ${name} a moderator`}
          >
            {targetRole === "moderator" ? "Return to member" : "Make moderator"}
          </Button>
        ) : null}
        {canRemove ? (
          <Button type="button" variant="outline" onClick={() => setRemoving((v) => !v)} aria-expanded={removing} className="h-8 px-3 text-xs" aria-label={`Remove ${name}`}>
            Remove
          </Button>
        ) : null}
      </div>
      {removing ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <label htmlFor={`${id}-reason`} className={labelClass}>
            Reason (recorded in the moderator log)
          </label>
          <select id={`${id}-reason`} value={reason} onChange={(e) => setReason(e.target.value)} className={controlClass}>
            <option value="">Choose a reason</option>
            {REMOVAL_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">They leave the community and can&apos;t rejoin unless you allow it again.</p>
          <Button type="button" disabled={pending || !reason} onClick={() => run(() => setMemberBan(communityId, memberId, true, reason))} className="h-9 px-4 text-sm">
            {pending ? "Removing…" : "Remove member"}
          </Button>
        </div>
      ) : null}
      {line}
    </div>
  );
}

export function RestoreButton({ communityId, memberId, name }: { communityId: string; memberId: string; name: string }) {
  const { run, pending, line } = useOutcome();
  return (
    <div>
      <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => setMemberBan(communityId, memberId, false))} className="h-8 px-3 text-xs" aria-label={`Allow ${name} to rejoin`}>
        Allow to rejoin
      </Button>
      {line}
    </div>
  );
}

/** Moderators publish an announcement shown at the top of the community. */
export function AnnouncementForm({ communityId }: { communityId: string }) {
  const id = useId();
  const router = useRouter();
  const [state, setState] = useState<CommunityFormState>(idleCommunityForm);
  const [pending, startTransition] = useTransition();
  const err = (key: string) => state.fieldErrors?.[key]?.[0];

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createAnnouncement(state, data);
      setState(result);
      if (result.status === "success") {
        form.reset();
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <input type="hidden" name="communityId" value={communityId} />
      <Field label="Title" name="title" maxLength={120} required error={err("title")} />
      <div>
        <label htmlFor={`${id}-body`} className={labelClass}>
          Announcement
        </label>
        <textarea id={`${id}-body`} name="body" rows={4} maxLength={2000} required className={textareaClass} aria-invalid={err("body") ? true : undefined} />
        {err("body") ? <p role="alert" className="mt-1 text-xs font-medium text-destructive">{err("body")}</p> : null}
      </div>
      {state.status === "error" && state.message ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      {state.status === "success" ? <FormAlert tone="success">{state.message}</FormAlert> : null}
      <Button type="submit" disabled={pending} className="h-10 px-5">
        {pending ? "Publishing…" : "Publish announcement"}
      </Button>
    </form>
  );
}

export function DeleteAnnouncementButton({ announcementId, title }: { announcementId: string; title: string }) {
  const { run, pending, line } = useOutcome();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => deleteAnnouncement(announcementId))}
        aria-label={`Remove announcement: ${title}`}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted-foreground hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Trash2 className="size-3.5" aria-hidden="true" />
        Remove
      </button>
      {line}
    </div>
  );
}
