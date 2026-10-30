"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isRecentAuth, requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { POLICY_DOCS, POLICY_VERSION } from "@/lib/legal";
import { privacySettingsSchema, type PrivacyFormState } from "@/features/privacy/schemas";

const GENERIC = "Something went wrong. Please try again.";
const REAUTH = "For your security, please confirm your password first.";

type Result = { ok: true } | { ok: false; error: string; reauth?: boolean };

/** Profile visibility and directory listing. Only the signed-in member's own row is touched. */
export async function updatePrivacySettings(_prev: PrivacyFormState, formData: FormData): Promise<PrivacyFormState> {
  const { user } = await requireMember();
  const parsed = privacySettingsSchema.safeParse({
    profileVisibility: formData.get("profileVisibility"),
    directoryListed: formData.get("directoryListed") === "on",
  });
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      profile_visibility: parsed.data.profileVisibility,
      directory_listed: parsed.data.directoryListed,
    })
    .eq("id", user.id)
    .select("id");
  if (error || !data || data.length === 0) {
    if (error) reportError("profiles.privacy", error);
    return { status: "error", message: "We couldn't save that. Please try again." };
  }
  revalidatePath("/", "layout");
  return { status: "success", message: "Saved." };
}

/**
 * Ask for the account to be deleted. It needs a recent sign-in, waits out a 30-day cooling-off
 * period (the member can cancel), and is then carried out by an administrator.
 */
export async function requestAccountDeletion(): Promise<Result> {
  const { user } = await requireMember();
  if (!isRecentAuth(user)) return { ok: false, error: REAUTH, reauth: true };
  const limited = await checkRateLimit("privacy", user.id);
  if (!limited.ok) return { ok: false, error: limited.message };

  const supabase = await createClient();
  const { error } = await supabase.from("data_requests").insert({ user_id: user.id, kind: "deletion" });
  // 23505: already requested, which is what the member wants.
  if (error && error.code !== "23505") {
    reportError("data_requests.insert", error);
    return { ok: false, error: GENERIC };
  }
  revalidatePath("/settings/privacy");
  return { ok: true };
}

export async function cancelAccountDeletion(requestId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, error: GENERIC };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("user_id", user.id)
    .eq("status", "requested")
    .select("id");
  if (error) {
    reportError("data_requests.cancel", error);
    return { ok: false, error: GENERIC };
  }
  if (!data || data.length === 0) return { ok: false, error: "That request can't be cancelled any more." };
  revalidatePath("/settings/privacy");
  return { ok: true };
}

/**
 * Records that the member accepted the current Terms, Privacy Policy and Community Guidelines.
 * Called when onboarding completes. Best effort and idempotent: a duplicate is fine, and a
 * failure never blocks the member (it is retried the next time they accept).
 */
export async function recordPolicyConsent(userId: string): Promise<void> {
  const supabase = await createClient();
  await Promise.all(
    POLICY_DOCS.map(async ({ kind }) => {
      const { error } = await supabase
        .from("consent_records")
        .insert({ user_id: userId, kind, version: POLICY_VERSION });
      if (error && error.code !== "23505") reportError("consent_records.insert", error);
    }),
  );
}
