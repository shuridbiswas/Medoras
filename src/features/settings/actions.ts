"use server";

import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { reportError } from "@/lib/monitoring/report";
import { saveNotificationPreferences } from "@/features/notifications/preferences";

export type PreferencesState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/**
 * Saves the member's own email preference. The row key is the verified user id (never a form
 * value), and row level security allows only the owner to write it.
 */
export async function updateEmailPreferences(
  _prev: PreferencesState,
  formData: FormData,
): Promise<PreferencesState> {
  const { user } = await requireMember();
  const emailActivity = formData.get("emailActivity") === "on";

  const { error } = await saveNotificationPreferences(user.id, {
    notify_activity: emailActivity,
  });

  if (error) {
    reportError("notification_preferences.upsert", error);
    return { status: "error", message: "We couldn't save that. Please try again." };
  }
  revalidatePath("/settings");
  return { status: "success", message: "Saved." };
}
