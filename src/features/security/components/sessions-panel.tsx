"use client";

import { useState, useTransition } from "react";
import { LogOut } from "lucide-react";
import { FormAlert } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { signOutEverywhere, signOutOtherDevices } from "@/features/security/actions";

/**
 * Session control. Supabase does not give an app a list of a member's sessions, so Medyra offers
 * the two actions it can do: sign out every other device, or every device including this one.
 */
export function SessionsPanel() {
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Signed in on a shared or lost device? Sign it out from here. (Your list of devices isn&apos;t
        available, so these act on all of them at once.)
      </p>
      {message ? <FormAlert tone={message.tone}>{message.text}</FormAlert> : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="h-10 px-4"
          onClick={() =>
            startTransition(async () => {
              const result = await signOutOtherDevices();
              setMessage(
                result.ok
                  ? { tone: "success", text: "Every other device was signed out." }
                  : { tone: "error", text: result.error },
              );
            })
          }
        >
          Sign out other devices
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="h-10 px-4"
          onClick={() => startTransition(async () => void (await signOutEverywhere()))}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out everywhere
        </Button>
      </div>
    </div>
  );
}
