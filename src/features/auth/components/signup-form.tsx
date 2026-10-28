"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import {
  Checkbox,
  Field,
  FormAlert,
  PasswordField,
  SubmitButton,
} from "@/components/forms/fields";
import { resendVerification, signUp } from "@/features/auth/actions";
import { initialAuthState } from "@/features/auth/schemas";

export function SignupForm({ disabled }: { disabled?: boolean }) {
  const [state, action] = useActionState(signUp, initialAuthState);
  const [resendState, resendAction] = useActionState(
    resendVerification,
    initialAuthState,
  );

  if (state.status === "success") {
    return (
      <div className="space-y-5 rounded-2xl border border-maroon-200 bg-maroon-50 p-6">
        <span className="flex size-11 items-center justify-center rounded-full bg-maroon-700 text-white">
          <MailCheck className="size-5" aria-hidden="true" />
        </span>
        <div role="status" className="space-y-2">
          <h2 className="text-xl font-bold text-maroon-900">
            Check your email
          </h2>
          <p className="text-sm leading-relaxed text-maroon-900/80">
            If <strong className="break-all">{state.email}</strong> can be used
            to create an account, we&apos;ve sent a verification link. Open it
            to confirm your address and finish setting up your profile.
          </p>
        </div>
        <form action={resendAction} className="text-sm">
          <input type="hidden" name="email" value={state.email} />
          <span className="text-muted-foreground">
            Nothing arrived? Check spam, or{" "}
          </span>
          <button
            type="submit"
            className="font-semibold text-maroon-700 underline-offset-4 hover:underline"
          >
            resend the email
          </button>
          .
          {resendState.message ? (
            <p role="status" className="mt-2 text-muted-foreground">
              {resendState.message}
            </p>
          ) : null}
        </form>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}
      <form action={action} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="First name"
            name="firstName"
            autoComplete="given-name"
            required
            defaultValue={state.values?.firstName}
            error={errors.firstName?.[0]}
            disabled={disabled}
          />
          <Field
            label="Last name"
            name="lastName"
            autoComplete="family-name"
            required
            defaultValue={state.values?.lastName}
            error={errors.lastName?.[0]}
            disabled={disabled}
          />
        </div>
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.values?.email}
          error={errors.email?.[0]}
          disabled={disabled}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          required
          hint="At least 10 characters, with a letter and a number."
          error={errors.password?.[0]}
          disabled={disabled}
        />
        <PasswordField
          label="Confirm password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.[0]}
          disabled={disabled}
        />
        <Checkbox
          name="acceptTerms"
          required
          error={errors.acceptTerms?.[0]}
          disabled={disabled}
          label={
            <>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-medium text-maroon-700 underline-offset-4 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-maroon-700 underline-offset-4 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </>
          }
        />
        <SubmitButton
          pendingLabel="Creating account…"
          className={disabled ? "pointer-events-none opacity-50" : ""}
        >
          Create account
        </SubmitButton>
      </form>
    </div>
  );
}
