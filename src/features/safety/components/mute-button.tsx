"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMute } from "@/features/safety/actions";

/** Mute or unmute a member: their posts and comments disappear from your feed, quietly. */
export function MuteButton({
  memberId,
  name,
  muted = false,
  variant = "profile",
}: {
  memberId: string;
  name: string;
  muted?: boolean;
  variant?: "profile" | "list";
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setMute(memberId, !muted);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="text-sm">
      {variant === "list" ? (
        <Button type="button" variant="outline" disabled={pending} onClick={toggle} className="h-9 px-3 text-sm" aria-label={`${muted ? "Unmute" : "Mute"} ${name}`}>
          {muted ? "Unmute" : "Mute"}
        </Button>
      ) : (
        <button
          type="button"
          onClick={toggle}
          disabled={pending}
          aria-label={`${muted ? "Unmute" : "Mute"} ${name}`}
          className="inline-flex items-center gap-1.5 rounded-md text-muted-foreground transition-colors hover:text-maroon-900 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
        >
          <VolumeX className="size-3.5" aria-hidden="true" />
          {muted ? "Unmute this member" : "Mute this member"}
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
