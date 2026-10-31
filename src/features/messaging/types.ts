import type { ConversationKind } from "@/lib/supabase/database.types";

export type Person = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  headline: string | null;
  avatar_path: string | null;
};

export const PERSON_COLUMNS = "id, username, first_name, last_name, headline, avatar_path";

export const personName = (p: Pick<Person, "first_name" | "last_name"> | null | undefined) =>
  p ? [p.first_name, p.last_name].filter(Boolean).join(" ") : "Former member";

export type ConversationSummary = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  /** "pending" means a message request the viewer has not answered. */
  status: "active" | "pending";
  last_message_at: string;
  unread: number;
  last: { body: string; created_at: string; mine: boolean } | null;
  others: Person[];
};

export type ThreadMessage = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
  sender: Person | null;
};

export type ThreadView = {
  id: string;
  kind: ConversationKind;
  title: string | null;
  status: "active" | "pending";
  isAdmin: boolean;
  /** Direct conversation where the other side has not accepted yet (the viewer started it). */
  awaitingReply: boolean;
  others: Person[];
  messages: ThreadMessage[];
};

/** Display title: a group's name, or the other person's name. */
export const conversationTitle = (c: Pick<ConversationSummary, "kind" | "title" | "others">) =>
  c.kind === "group" ? (c.title ?? "Group") : personName(c.others[0]);
