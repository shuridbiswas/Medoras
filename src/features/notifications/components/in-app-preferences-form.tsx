"use client";

import { useActionState } from "react";
import { Checkbox, FormAlert, SubmitButton } from "@/components/forms/fields";
import {
  updateInAppPreferences,
  type InAppPreferencesState,
} from "@/features/notifications/actions";

const idle: InAppPreferencesState = { status: "idle" };

/** Which in-app notifications to receive. Both default to on. */
export function InAppPreferencesForm({
  inappConnections,
  inappComments,
}: {
  inappConnections: boolean;
  inappComments: boolean;
}) {
  const [state, action] = useActionState(updateInAppPreferences, idle);

  return (
    <form action={action} className="space-y-4">
      <Checkbox
        name="inappConnections"
        defaultChecked={inappConnections}
        label="Connection requests and accepted requests"
      />
      <Checkbox
        name="inappComments"
        defaultChecked={inappComments}
        label="Comments and replies on posts"
      />
      <p className="text-xs text-muted-foreground">
        Notifications show who did something, never what they wrote.
      </p>
      {state.status !== "idle" ? (
        <FormAlert tone={state.status === "success" ? "success" : "error"}>
          {state.message}
        </FormAlert>
      ) : null}
      <SubmitButton pendingLabel="Saving…" className="h-10 w-auto px-5 text-sm">
        Save notification settings
      </SubmitButton>
    </form>
  );
}
