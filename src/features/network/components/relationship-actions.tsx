"use client";

import { useState, useTransition } from "react";
import { Check, Clock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptRequest,
  declineRequest,
  removeConnection,
  sendConnectionRequest,
  setFollow,
  withdrawRequest,
} from "@/features/network/actions";
import type { NetworkActionResult, Relationship } from "@/features/network/types";
import { cn } from "@/lib/utils";

type Result = NetworkActionResult<{ relationship: Relationship }>;

/**
 * Connect, follow and answer-a-request buttons for one member. Every state change goes through a
 * server action; the button shows what the server says the relationship now is, never a guess.
 */
export function RelationshipActions({
  memberId,
  name,
  initial,
  compact = false,
  showFollow = true,
  className,
}: {
  memberId: string;
  name: string;
  initial: Relationship;
  compact?: boolean;
  showFollow?: boolean;
  className?: string;
}) {
  const [relationship, setRelationship] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pending, startTransition] = useTransition();
  const size = compact ? "h-9 px-3 text-sm" : "h-10 px-4 text-sm";

  function run(action: () => Promise<Result>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setRelationship(result.relationship);
        setConfirmRemove(false);
      } else {
        setError(result.error);
      }
    });
  }

  const id = relationship.connectionId;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {relationship.state === "none" ? (
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(() => sendConnectionRequest(memberId))}
          className={size}
          aria-label={`Connect with ${name}`}
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Connect
        </Button>
      ) : null}

      {relationship.state === "request_sent" && id ? (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-50 px-3 text-sm font-medium text-maroon-800 h-9">
            <Clock className="size-4" aria-hidden="true" />
            Request sent
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => withdrawRequest(id))}
            className={size}
            aria-label={`Withdraw your request to ${name}`}
          >
            Withdraw
          </Button>
        </>
      ) : null}

      {relationship.state === "request_received" && id ? (
        <>
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => acceptRequest(id))}
            className={size}
            aria-label={`Accept ${name}'s request`}
          >
            <Check className="size-4" aria-hidden="true" />
            Accept
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => declineRequest(id))}
            className={size}
            aria-label={`Decline ${name}'s request`}
          >
            Decline
          </Button>
        </>
      ) : null}

      {relationship.state === "connected" && id ? (
        confirmRemove ? (
          <>
            <span className="text-sm text-muted-foreground">Remove {name}?</span>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(() => removeConnection(id))}
              className={cn(size, "border-destructive/40 text-destructive hover:text-destructive")}
            >
              Yes, remove
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmRemove(false)}
              className={size}
            >
              Keep
            </Button>
          </>
        ) : (
          <>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-maroon-50 px-3 text-sm font-medium text-maroon-800">
              <Check className="size-4" aria-hidden="true" />
              Connected
            </span>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmRemove(true)}
              className={cn(size, "text-muted-foreground")}
              aria-label={`Remove ${name} from your connections`}
            >
              Remove
            </Button>
          </>
        )
      ) : null}

      {showFollow ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          aria-pressed={relationship.following}
          onClick={() => run(() => setFollow(memberId, !relationship.following))}
          className={cn(size, relationship.following && "border-maroon-300 bg-maroon-50 text-maroon-800")}
          aria-label={`${relationship.following ? "Unfollow" : "Follow"} ${name}`}
        >
          {relationship.following ? "Following" : "Follow"}
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
