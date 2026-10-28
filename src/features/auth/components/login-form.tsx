"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Checkbox,
  Field,
  FormAlert,
  PasswordField,
  SubmitButton,
} from "@/components/forms/fields";
import { resendVerification, signIn } from "@/features/auth/actions";
import { initialAuthState } from "@/features/auth/schemas";

export function LoginForm({
  next,
  notice,
  disabled,
}: {
  next?: string;
  notice?: string;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(signIn, initialAuthState);
  const [resendState, resendAction] = useActionState(
    resendVerification,
    initialAuthState,
  );

  return (
    <div className="space-y-5">
      {notice ? <FormAlert tone="info">{notice}</FormAlert> : null}
      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}

      <form action={action} noValidate className="space-y-5">
        {next ? <input type="hidden" name="next" value={next} /> : null}
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
        <div className="space-y-2">
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            error={state.fieldErrors?.password?.[0]}
            disabled={disabled}
          />
          <div className="flex items-center justify-between gap-4">
            <Checkbox
              name="remember"
              label="Keep me signed in"
              defaultChecked
            />
            <Link
              href="/forgot-password"
              className="shrink-0 text-sm font-medium text-maroon-700 underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <SubmitButton
          pendingLabel="Signing in…"
          className={disabled ? "pointer-events-none opacity-50" : ""}
        >
          Sign in
        </SubmitButton>
      </form>

      {state.needsVerification && state.email ? (
        <form
          action={resendAction}
          className="rounded-xl border border-border bg-sand p-4"
        >
          <input type="hidden" name="email" value={state.email} />
          <p className="text-sm text-maroon-900">
            Didn&apos;t get the verification email? We can send it again.
          </p>
          <button
            type="submit"
            className="mt-2 text-sm font-semibold text-maroon-700 underline-offset-4 hover:underline"
          >
            Resend verification email
          </button>
          {resendState.message ? (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {resendState.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
