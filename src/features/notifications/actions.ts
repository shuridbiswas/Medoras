"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { reportError } from "@/lib/monitoring/report";
import { idSchema } from "@/features/feed/schemas";
import type { ActionResult } from "@/features/feed/types";
import { saveNotificationPreferences } from "@/features/notifications/preferences";
import { getUnreadCount } from "@/features/notifications/queries";

const GENERIC_ERROR = "Something went wrong. Please try again.";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function refresh() {
  revalidatePath("/notifications");
}

/** Marks one notification read. Filtered by the verified member and enforced by row level security. */
export async function markNotificationRead(
  id: string,
): Promise<ActionResult<{ unread: number }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(id).success) return fail(GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) {
    reportError("notifications.read", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true, unread: await getUnreadCount(user.id) };
}

export async function markAllNotificationsRead(): Promise<ActionResult<{ unread: number }>> {
  const { user } = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("read_at", null);
  if (error) {
    reportError("notifications.read_all", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true, unread: await getUnreadCount(user.id) };
}

export async function deleteNotification(
  id: string,
): Promise<ActionResult<{ unread: number }>> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(id).success) return fail(GENERIC_ERROR);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("recipient_id", user.id);
  if (error) {
    reportError("notifications.delete", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true, unread: await getUnreadCount(user.id) };
}

export type InAppPreferencesState = {
  status: "idle" | "success" | "error";
  message?: string;
};

/** The member's own in-app preferences. The row key is the verified user id, never a form value. */
export async function updateInAppPreferences(
  _prev: InAppPreferencesState,
  formData: FormData,
): Promise<InAppPreferencesState> {
  const { user } = await requireMember();

  const { error } = await saveNotificationPreferences(user.id, {
    inapp_connections: formData.get("inappConnections") === "on",
    inapp_comments: formData.get("inappComments") === "on",
  });
  if (error) {
    reportError("notification_preferences.inapp", error);
    return { status: "error", message: "We couldn't save that. Please try again." };
  }
  revalidatePath("/settings");
  return { status: "success", message: "Saved." };
}
