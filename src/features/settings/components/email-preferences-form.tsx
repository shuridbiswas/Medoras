"use client";

import { useActionState } from "react";
import { Checkbox, FormAlert, SubmitButton } from "@/components/forms/fields";
import {
  updateEmailPreferences,
  type PreferencesState,
} from "@/features/settings/actions";

const idle: PreferencesState = { status: "idle" };

export function EmailPreferencesForm({ emailActivity }: { emailActivity: boolean }) {
  const [state, action] = useActionState(updateEmailPreferences, idle);

  return (
    <form action={action} className="space-y-4">
      <Checkbox
        name="emailActivity"
        defaultChecked={emailActivity}
        label="Email me about activity on my posts and new connection requests"
      />
      <p className="text-xs text-muted-foreground">
        These emails are not sent yet. Your choice is saved now and respected when they
        launch. Security notices (such as a password change) are always sent.
      </p>
      {state.status !== "idle" ? (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormAlert>
      ) : null}
      <SubmitButton pendingLabel="Saving…" className="h-10 w-auto px-5 text-sm">
        Save preference
      </SubmitButton>
    </form>
  );
}
