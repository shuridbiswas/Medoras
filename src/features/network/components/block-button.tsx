"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setBlock } from "@/features/network/actions";

/** Block or unblock a member. Blocking ends any connection or follow and stops new ones. */
export function BlockButton({
  memberId,
  name,
  blocked = false,
  variant = "profile",
}: {
  memberId: string;
  name: string;
  blocked?: boolean;
  variant?: "profile" | "list";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(block: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setBlock(memberId, block);
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else setError(result.error);
    });
  }

  if (blocked) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(false)}
          className="h-9 px-3 text-sm"
          aria-label={`Unblock ${name}`}
        >
          Unblock
        </Button>
        {error ? (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="text-sm">
      {confirming ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-muted-foreground">
            Block {name}? You will no longer be connected or following each other, and neither of
            you can send requests or follow. You can unblock later in Settings.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => run(true)}
              className="h-9 border-destructive/40 px-3 text-destructive hover:text-destructive"
            >
              Yes, block
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
              className="h-9 px-3"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          aria-label={`Block ${name}`}
        >
          <Ban className="size-3.5" aria-hidden="true" />
          {variant === "profile" ? "Block this member" : "Block"}
        </button>
      )}
      {error ? (
        <p role="alert" className="mt-1 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
