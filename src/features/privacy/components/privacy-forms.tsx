"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Checkbox, FormAlert, SubmitButton } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  updatePrivacySettings,
} from "@/features/privacy/actions";
import { idlePrivacyForm } from "@/features/privacy/schemas";

export function PrivacySettingsForm({
  profileVisibility,
  directoryListed,
}: {
  profileVisibility: "members" | "connections";
  directoryListed: boolean;
}) {
  const [state, action] = useActionState(updatePrivacySettings, idlePrivacyForm);
  return (
    <form action={action} className="space-y-5">
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-maroon-900">Who can see your profile details</legend>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="radio" name="profileVisibility" value="members" defaultChecked={profileVisibility === "members"} className="mt-1 accent-maroon-700" />
          <span>
            <strong>Every Medyra member</strong>
            <span className="block text-muted-foreground">Bio, journey, education, experience and skills are visible to all signed-in members.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="radio" name="profileVisibility" value="connections" defaultChecked={profileVisibility === "connections"} className="mt-1 accent-maroon-700" />
          <span>
            <strong>Only my connections</strong>
            <span className="block text-muted-foreground">
              Your name, photo, headline and field stay visible so people can find you; the details above are
              limited to accepted connections. (Education, experience and skills are enforced in the database; your
              bio is hidden by the app.)
            </span>
          </span>
        </label>
      </fieldset>
      <Checkbox name="directoryListed" defaultChecked={directoryListed} label="List me in the member directory and suggestions" />
      <p className="text-xs text-muted-foreground">
        Unlisting hides you from search and suggestions. People who know your username can still open your profile.
      </p>
      {state.status !== "idle" ? <FormAlert tone={state.status === "success" ? "success" : "error"}>{state.message}</FormAlert> : null}
      <SubmitButton pendingLabel="Saving…" className="h-10 w-auto px-5 text-sm">
        Save privacy settings
      </SubmitButton>
    </form>
  );
}

/** Request, or cancel, deletion of the whole account. A 30-day cooling-off period applies. */
export function DeletionPanel({ pending: open }: { pending: { id: string; scheduledFor: string } | null }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function request() {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletion();
      if (result.ok) {
        setConfirming(false);
        router.refresh();
      } else if (result.reauth) router.push(`/reauth?next=${encodeURIComponent("/settings/privacy")}`);
      else setError(result.error);
    });
  }

  function cancel(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await cancelAccountDeletion(id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {open ? (
        <div role="status" className="rounded-xl border border-maroon-200 bg-maroon-50 p-4 text-sm text-maroon-900">
          <p>
            <strong>Deletion requested.</strong> Your account and everything in it will be deleted after{" "}
            {open.scheduledFor}. Until then you can change your mind.
          </p>
          <Button type="button" variant="outline" disabled={busy} onClick={() => cancel(open.id)} className="mt-3 h-9 px-3 text-sm">
            Cancel the deletion request
          </Button>
        </div>
      ) : confirming ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p>
            This deletes your account, profile, posts, comments, connections and everything else you added. It can&apos;t
            be undone after the 30-day waiting period. Your sign-in stays active until then.
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={request} className="h-9 border-destructive/40 px-3 text-destructive hover:text-destructive">
              Yes, request deletion
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)} className="h-9 px-3">
              Keep my account
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" onClick={() => setConfirming(true)} className="h-10 px-4">
          Request account deletion
        </Button>
      )}
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
    </div>
  );
}
