import type { NotificationType } from "@/lib/supabase/database.types";

/**
 * Turns a notification into a sentence and a link. Only the type and the actor's name are used:
 * notifications never carry post or comment text, so there is nothing private to leak.
 */

export type NotificationActor = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  avatar_path: string | null;
};

export type NotificationItem = {
  id: string;
  type: NotificationType;
  entity_type: "post" | "connection" | "community" | "mentorship" | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
  actor: NotificationActor | null;
};

const SOMEONE = "A member";

export const actorName = (actor: NotificationActor | null) =>
  actor ? [actor.first_name, actor.last_name].filter(Boolean).join(" ") || SOMEONE : SOMEONE;

/** What happened, without the actor's name (shown in bold in front of it). */
export function describeAction(type: NotificationType): string {
  switch (type) {
    case "connection_request":
      return "sent you a connection request";
    case "connection_accepted":
      return "accepted your connection request";
    case "post_comment":
      return "commented on your post";
    case "comment_reply":
      return "also commented on a post you commented on";
    case "mention":
      return "mentioned you";
    case "community_event":
      return "shared a community update";
    case "mentorship_event":
      return "sent a mentorship update";
  }
}

/** Where the notification leads. Always an internal path. */
export function notificationHref(n: NotificationItem): string {
  switch (n.type) {
    case "connection_request":
      return "/network/requests";
    case "connection_accepted":
      return n.actor?.username ? `/profile/${n.actor.username}` : "/network/connections";
    case "post_comment":
    case "comment_reply":
    case "mention":
      return n.entity_type === "post" && n.entity_id ? `/post/${n.entity_id}` : "/notifications";
    default:
      return "/notifications";
  }
}

export const NOTIFICATION_PAGE_SIZE = 20;
