import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_PAGE_SIZE,
  type NotificationItem,
} from "@/features/notifications/format";

/** Notifications are private to the recipient: row level security shows each member only theirs. */

/** Unread count for the header indicator. Any failure shows no indicator rather than an error. */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", userId)
      .is("read_at", null);
    return error ? 0 : (count ?? 0);
  } catch {
    return 0;
  }
}

export async function listNotifications(
  userId: string,
  page: number,
): Promise<{ items: NotificationItem[]; total: number; failed?: boolean }> {
  const supabase = await createClient();
  const from = (page - 1) * NOTIFICATION_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("notifications")
    .select(
      "id, type, entity_type, entity_id, created_at, read_at, actor:profiles!notifications_actor_id_fkey(id, username, first_name, last_name, avatar_path)",
      { count: "exact" },
    )
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + NOTIFICATION_PAGE_SIZE - 1)
    .overrideTypes<NotificationItem[], { merge: false }>();

  if (error || !data) return { items: [], total: 0, failed: true };
  return { items: data, total: count ?? data.length };
}

export type InAppPreferences = {
  inappConnections: boolean;
  inappComments: boolean;
};

/** A missing row means the defaults (everything on). */
export async function getInAppPreferences(userId: string): Promise<InAppPreferences> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notification_preferences")
    .select("inapp_connections, inapp_comments")
    .eq("user_id", userId)
    .maybeSingle()
    .overrideTypes<
      { inapp_connections: boolean; inapp_comments: boolean },
      { merge: false }
    >();
  return {
    inappConnections: data?.inapp_connections ?? true,
    inappComments: data?.inapp_comments ?? true,
  };
}
