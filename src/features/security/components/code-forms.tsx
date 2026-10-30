"use client";

import { useActionState } from "react";
import { Field, FormAlert, PasswordField, SubmitButton } from "@/components/forms/fields";
import {
  reauthenticate,
  redeemRecoveryCode,
  verifyMfaChallenge,
} from "@/features/security/actions";
import { idleSecurityForm } from "@/features/security/schemas";

/** Sign-in step two: the 6-digit code from the member's authenticator app. */
export function MfaVerifyForm({ next }: { next?: string }) {
  const [state, action] = useActionState(verifyMfaChallenge, idleSecurityForm);
  return (
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
      <SubmitButton pendingLabel="Checking…">Verify</SubmitButton>
    </form>
  );
}

/** Lost your phone? One recovery code removes the authenticator so you can set up a new one. */
export function RecoveryForm() {
  const [state, action] = useActionState(redeemRecoveryCode, idleSecurityForm);
  return (
    <form action={action} className="space-y-4" noValidate>
      <Field
        label="Recovery code"
        name="code"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="xxxx-xxxx-xxxx"
        hint="Each code works once."
        required
      />
      {state.status === "error" ? <FormAlert tone="error">{state.message}</FormAlert> : null}
      <SubmitButton pendingLabel="Checking…">Use recovery code</SubmitButton>
    </form>
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
