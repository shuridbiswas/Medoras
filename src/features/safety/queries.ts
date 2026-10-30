import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppealRow, MemberNoticeRow } from "@/lib/supabase/database.types";
import { NETWORK_MEMBER_COLUMNS, type NetworkMember } from "@/features/network/types";

/**
 * Members the viewer blocked or muted, for hiding their posts and comments from the viewer.
 * (The reverse, members who blocked the viewer, is enforced when they try to interact, not by
 * hiding public content.) A failure to read returns an empty list: the feed still loads.
 */
export async function getHiddenAuthorIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient();
  const [blocks, mutes] = await Promise.all([
    supabase
      .from("member_blocks")
      .select("blocked_id")
      .eq("blocker_id", viewerId)
      .overrideTypes<{ blocked_id: string }[], { merge: false }>(),
    supabase
      .from("member_mutes")
      .select("muted_id")
      .eq("muter_id", viewerId)
      .overrideTypes<{ muted_id: string }[], { merge: false }>(),
  ]);
  return [
    ...new Set([
      ...(blocks.data ?? []).map((b) => b.blocked_id),
      ...(mutes.data ?? []).map((m) => m.muted_id),
    ]),
  ];
}

export async function listMutedMembers(viewerId: string): Promise<NetworkMember[]> {
  const supabase = await createClient();
  const { data: mutes } = await supabase
    .from("member_mutes")
    .select("muted_id")
    .eq("muter_id", viewerId)
    .overrideTypes<{ muted_id: string }[], { merge: false }>();
  const ids = (mutes ?? []).map((m) => m.muted_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("profiles")
    .select(NETWORK_MEMBER_COLUMNS)
    .in("id", ids)
    .overrideTypes<NetworkMember[], { merge: false }>();
  return data ?? [];
}

export async function isMuted(viewerId: string, memberId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("member_mutes")
    .select("muted_id")
    .eq("muter_id", viewerId)
    .eq("muted_id", memberId)
    .maybeSingle();
  return Boolean(data);
}

export type NoticeWithAppeal = MemberNoticeRow & { appeal: Pick<AppealRow, "status" | "decision_note"> | null };

/** What Medyra has told this member about moderation decisions, newest first, with any appeal. */
export async function listMyNotices(userId: string, limit = 20): Promise<NoticeWithAppeal[]> {
  const supabase = await createClient();
  const { data: notices, error } = await supabase
    .from("member_notices")
    .select("id, member_id, kind, message, created_at")
    .eq("member_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .overrideTypes<MemberNoticeRow[], { merge: false }>();
  if (error || !notices) return [];

  const { data: appeals } = await supabase
    .from("appeals")
    .select("notice_id, status, decision_note")
    .eq("member_id", userId)
    .overrideTypes<{ notice_id: string; status: AppealRow["status"]; decision_note: string | null }[], { merge: false }>();
  const byNotice = new Map((appeals ?? []).map((a) => [a.notice_id, a]));
  return notices.map((n) => {
    const a = byNotice.get(n.id);
    return { ...n, appeal: a ? { status: a.status, decision_note: a.decision_note } : null };
  });
}
