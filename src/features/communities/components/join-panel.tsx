"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { textareaClass } from "@/components/forms/controls";
import { joinCommunity, leaveCommunity, requestToJoin, withdrawRequest } from "@/features/communities/actions";
import type { CommunityRole, CommunityVisibility } from "@/lib/supabase/database.types";

/** Join, leave, or ask to join, depending on the community and the member's current state. */
export function JoinPanel({
  communityId,
  visibility,
  role,
  requestPending,
}: {
  communityId: string;
  visibility: CommunityVisibility;
  role: CommunityRole | null;
  requestPending: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [asking, setAsking] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setAsking(false);
        setConfirmLeave(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const errorLine = error ? (
    <p role="alert" className="mt-2 text-sm font-medium text-destructive">
      {error}
    </p>
  ) : null;

  if (role) {
    if (role === "owner") {
      return <p className="text-sm text-muted-foreground">You own this community.</p>;
    }
    return (
      <div>
        {confirmLeave ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Leave this community?</span>
            <Button type="button" variant="outline" disabled={pending} onClick={() => run(() => leaveCommunity(communityId))} className="h-9 px-4 text-sm">
              {pending ? "Leaving…" : "Yes, leave"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmLeave(false)} className="h-9 px-3 text-sm">
              Stay
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setConfirmLeave(true)} className="h-9 px-4 text-sm">
            Leave community
          </Button>
        )}
        {errorLine}
      </div>
    );
  }

  if (visibility === "public") {
    return (
      <div>
        <Button type="button" disabled={pending} onClick={() => run(() => joinCommunity(communityId))} className="h-10 px-5">
          {pending ? "Joining…" : "Join community"}
        </Button>
        {errorLine}
      </div>
    );
  }

  if (requestPending) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground" role="status">
          Your request is waiting for a moderator.
        </p>
        <Button type="button" variant="ghost" disabled={pending} onClick={() => run(() => withdrawRequest(communityId))} className="h-9 px-3 text-sm">
          Withdraw request
        </Button>
        {errorLine}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {asking ? (
        <>
          <label htmlFor={`${id}-message`} className="block text-xs font-semibold text-maroon-900">
            Tell the moderators why you&apos;d like to join (optional)
          </label>
          <textarea
            id={`${id}-message`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            rows={3}
            className={textareaClass}
          />
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={() => run(() => requestToJoin(communityId, message))} className="h-10 px-5">
              {pending ? "Sending…" : "Send request"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAsking(false)} className="h-10 px-3">
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <Button type="button" onClick={() => setAsking(true)} className="h-10 px-5">
          Ask to join
        </Button>
      )}
      {errorLine}
    </div>
  );
}
