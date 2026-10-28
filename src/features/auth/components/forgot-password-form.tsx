"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Field, FormAlert, SubmitButton } from "@/components/forms/fields";
import { requestPasswordReset } from "@/features/auth/actions";
import { initialAuthState } from "@/features/auth/schemas";

export function ForgotPasswordForm({
  notice,
  disabled,
}: {
  notice?: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(
    requestPasswordReset,
    initialAuthState,
  );

  if (state.status === "success") {
    return (
      <div
        role="status"
        className="space-y-3 rounded-2xl border border-maroon-200 bg-maroon-50 p-6"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-maroon-700 text-white">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-bold text-maroon-900">Check your email</h2>
        <p className="text-sm leading-relaxed text-maroon-900/80">
          If an account exists for{" "}
          <strong className="break-all">{state.email}</strong>, we&apos;ve sent
          a link to reset your password. It expires after a short time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {notice ? <FormAlert tone="error">{notice}</FormAlert> : null}
      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}
      <form action={action} noValidate className="space-y-5">
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email?.[0]}
          disabled={disabled}
        />
        <SubmitButton
          pendingLabel="Sending…"
          className={disabled ? "pointer-events-none opacity-50" : ""}
        >
          Send reset link
        </SubmitButton>
      </form>
    </div>
  );
}
