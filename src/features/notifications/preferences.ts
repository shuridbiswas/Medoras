import "server-only";
import { createClient } from "@/lib/supabase/server";

type Patch = Partial<{
  notify_activity: boolean;
  inapp_connections: boolean;
  inapp_comments: boolean;
}>;

/**
 * Saves the member's own notification preferences. The row is owner-only and the owner column
 * is not updatable, so this cannot be an `upsert` (it would try to write user_id and be denied).
 * Update first; if the member has no row yet, insert it. `userId` is always the verified user.
 */
export async function saveNotificationPreferences(
  userId: string,
  patch: Patch,
): Promise<{ error: { code?: string; message?: string } | null }> {
  const supabase = await createClient();

  const updated = await supabase
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", userId)
    .select("user_id");
  if (updated.error) return { error: updated.error };
  if (updated.data && updated.data.length > 0) return { error: null };

  const inserted = await supabase
    .from("notification_preferences")
    .insert({ user_id: userId, ...patch });
  // 23505: another request created the row first; apply the change to it.
  if (inserted.error?.code === "23505") {
    const retry = await supabase
      .from("notification_preferences")
      .update(patch)
      .eq("user_id", userId);
    return { error: retry.error };
  }
  return { error: inserted.error };
}
