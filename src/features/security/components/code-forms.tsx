"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { FormAlert, Field, PasswordField, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { reauthenticate, sendEmailCode, verifyEmailCode } from "@/features/security/actions";
import { idleSecurityForm } from "@/features/security/schemas";

type Sent = { sentTo: string; minutes: number };

/**
 * Sign-in step two. A code is emailed as soon as the page opens (once), then the member types it
 * in. "Send a new code" is available if it did not arrive; the server enforces the cooldown.
 */
export function EmailCodeForm({ next }: { next?: string }) {
  const [state, action] = useActionState(verifyEmailCode, idleSecurityForm);
  const [sent, setSent] = useState<Sent | null>(null);
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const started = useRef(false);

  function send(automatic: boolean) {
    setNotice(null);
    startTransition(async () => {
      const result = await sendEmailCode();
      if (result.ok) {
        setSent({ sentTo: result.sentTo, minutes: result.minutes });
        if (!automatic) setNotice({ tone: "info", text: "A new code is on its way." });
      } else {
        setNotice({ tone: "error", text: result.error });
      }
    });
  }

  useEffect(() => {
    // React runs effects twice in development; send only one email.
    if (started.current) return;
    started.current = true;
    send(true);
  }, []);

  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2.5 text-sm text-maroon-900/85" role="status">
        <Mail className="mt-0.5 size-4.5 shrink-0 text-maroon-600" aria-hidden="true" />
        {sent
          ? `We emailed a 6-digit code to ${sent.sentTo}. It works for ${sent.minutes} minutes.`
          : pending
            ? "Sending a code to your email…"
            : "We'll email a 6-digit code to the address on your account."}
      </p>

      <form action={action} className="space-y-4" noValidate>
        <input type="hidden" name="next" value={next ?? ""} />
        <Field
          label="6-digit code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          autoFocus
          required
        />
        {state.status === "error" ? <FormAlert tone="error">{state.message}</FormAlert> : null}
        {notice ? <FormAlert tone={notice.tone === "error" ? "error" : "info"}>{notice.text}</FormAlert> : null}
        <SubmitButton pendingLabel="Checking…">Confirm</SubmitButton>
      </form>

      <Button type="button" variant="ghost" disabled={pending} onClick={() => send(false)} className="h-10 px-3 text-sm">
        Send a new code
      </Button>
    </div>
  );
}

/** Asks for the password again before a sensitive change. */
export function ReauthForm({ next }: { next?: string }) {
  const [state, action] = useActionState(reauthenticate, idleSecurityForm);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <PasswordField label="Password" name="password" autoComplete="current-password" required />
      {state.status === "error" ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      <SubmitButton pendingLabel="Confirming…">Confirm password</SubmitButton>
    </form>
  );
}
