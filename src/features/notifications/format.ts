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
  entity_type: "post" | "connection" | "community" | "mentorship" | "forum_question" | "conversation" | null;
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
    case "community_join_request":
      return "asked to join a community you moderate";
    case "community_request_approved":
      return "approved your request to join a community";
    case "community_post_removed":
      return "removed one of your community posts";
    case "forum_answer":
      return "answered a question you asked or follow";
    case "forum_reply":
      return "replied to your answer";
    case "forum_answer_accepted":
      return "accepted your answer";
    case "message_request":
      return "sent you a message request";
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
    case "forum_answer":
    case "forum_reply":
    case "forum_answer_accepted":
      return n.entity_type === "forum_question" && n.entity_id ? `/forums/${n.entity_id}` : "/notifications";
    case "message_request":
      return n.entity_type === "conversation" && n.entity_id ? `/messages/${n.entity_id}` : "/messages";
    case "mentorship_event":
      return "/mentorship/requests";
    case "community_join_request":
    case "community_request_approved":
    case "community_post_removed":
      return "/communities";
    default:
      return "/notifications";
  }
}

export const NOTIFICATION_PAGE_SIZE = 20;
