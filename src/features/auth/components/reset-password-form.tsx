"use client";

import { useActionState } from "react";
import {
  FormAlert,
  PasswordField,
  SubmitButton,
} from "@/components/forms/fields";
import { updatePassword } from "@/features/auth/actions";
import { initialAuthState } from "@/features/auth/schemas";

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialAuthState);
  const errors = state.fieldErrors ?? {};

  return (
    <div className="space-y-5">
      {state.status === "error" && state.message ? (
        <FormAlert tone="error">{state.message}</FormAlert>
      ) : null}
      <form action={action} noValidate className="space-y-5">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          required
          hint="At least 10 characters, with a letter and a number."
          error={errors.password?.[0]}
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          error={errors.confirmPassword?.[0]}
        />
        <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
      </form>
    </div>
  );
}
