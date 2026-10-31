"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { groupSchema, idSchema, sendSchema, startSchema } from "@/features/messaging/schemas";

/**
 * Every action starts with requireMember(). The sender is always the verified session; row level
 * security checks that the member is an active participant, and the database functions repeat
 * every rule (connections for groups, blocks, request limits). A refusal never says whether a
 * block or a decline was the reason.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Messages written by the database for members are safe to show; everything else stays generic. */
function friendly(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (/too quickly|not accepted your message request|can't message this member|only add your connections|up to 20|between 1 and 19|no longer (open|available)/i.test(message)) {
    return message;
  }
  if (error?.code === "42501") return "You can't send messages in this conversation.";
  return GENERIC_ERROR;
}

const refresh = () => revalidatePath("/messages", "layout");

export async function startConversation(otherId: string, body: string): Promise<Result<{ conversationId: string }>> {
  const { user } = await requireMember();
  const parsed = startSchema.safeParse({ otherId, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const limited = await checkRateLimit("message", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_direct_conversation", {
    p_other: parsed.data.otherId,
    p_body: parsed.data.body,
  });
  if (error || !data) {
    if (error && error.code !== "23514" && error.code !== "P0002") reportError("messages.start", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true, conversationId: data };
}

export async function sendMessage(conversationId: string, body: string): Promise<Result> {
  const { user } = await requireMember();
  const parsed = sendSchema.safeParse({ conversationId, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const limited = await checkRateLimit("message", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .insert({ conversation_id: parsed.data.conversationId, sender_id: user.id, body: parsed.data.body });
  if (error) {
    if (error.code !== "42501" && error.code !== "23514") reportError("messages.insert", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true };
}

export async function respondToRequest(conversationId: string, accept: boolean): Promise<Result> {
  await requireMember();
  if (!idSchema.safeParse(conversationId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_message_request", { p_conversation: conversationId, p_accept: accept });
  if (error) {
    if (error.code !== "P0002") reportError("messages.respond", error);
    return fail(friendly(error));
  }
  refresh();
  revalidatePath("/notifications");
  return { ok: true };
}

export async function createGroup(title: string, memberIds: string[]): Promise<Result<{ conversationId: string }>> {
  const { user } = await requireMember();
  const parsed = groupSchema.safeParse({ title, memberIds });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const limited = await checkRateLimit("message", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group_conversation", {
    p_title: parsed.data.title,
    p_members: parsed.data.memberIds,
  });
  if (error || !data) {
    if (error && error.code !== "23514") reportError("messages.create_group", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true, conversationId: data };
}

export async function addGroupMember(conversationId: string, memberId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(conversationId).success || !idSchema.safeParse(memberId).success) return fail(GENERIC_ERROR);
  const limited = await checkRateLimit("message", user.id);
  if (!limited.ok) return fail(limited.message);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_group_member", { p_conversation: conversationId, p_user: memberId });
  if (error) {
    if (error.code !== "23514" && error.code !== "42501") reportError("messages.add_member", error);
    return fail(error.code === "42501" ? "Only a group admin can add people." : friendly(error));
  }
  refresh();
  return { ok: true };
}

export async function leaveConversation(conversationId: string): Promise<Result> {
  await requireMember();
  if (!idSchema.safeParse(conversationId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_conversation", { p_conversation: conversationId });
  if (error) {
    if (error.code !== "P0002") reportError("messages.leave", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true };
}

/** Moves the viewer's own read marker to now. Touches nothing else. */
export async function markRead(conversationId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(conversationId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
  if (error) {
    reportError("messages.mark_read", error);
    return fail(GENERIC_ERROR);
  }
  return { ok: true };
}

export async function deleteMessage(messageId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(messageId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_id", user.id)
    .select("id");
  if (error) {
    reportError("messages.delete", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("That message no longer exists, or it isn't yours to delete.");
  refresh();
  return { ok: true };
}
