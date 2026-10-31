import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ConversationKind } from "@/lib/supabase/database.types";
import { LIST_LIMIT, MESSAGES_PAGE } from "@/features/messaging/content";
import {
  conversationTitle,
  PERSON_COLUMNS,
  personName,
  type ConversationSummary,
  type Person,
  type ThreadView,
} from "@/features/messaging/types";

/**
 * Reads run under the member's own session: row level security only returns conversations the
 * member takes part in, and a conversation they declined or left is not returned at all.
 */

type MineRow = {
  status: "active" | "pending";
  last_read_at: string;
  conversation: { id: string; kind: ConversationKind; title: string | null; last_message_at: string } | null;
};

type OtherRow = { conversation_id: string; member: Person | null };
type LastRow = { conversation_id: string; body: string; created_at: string; sender_id: string | null };

export async function listConversations(
  viewerId: string,
  { tab, q }: { tab: "inbox" | "requests"; q: string },
): Promise<{ items: ConversationSummary[]; requestCount: number; failed?: boolean }> {
  const supabase = await createClient();
  const { data: mine, error } = await supabase
    .from("conversation_participants")
    .select(
      "status, last_read_at, conversation:conversations!conversation_participants_conversation_id_fkey(id, kind, title, last_message_at)",
    )
    .eq("user_id", viewerId)
    .in("status", ["active", "pending"])
    .limit(LIST_LIMIT)
    .overrideTypes<MineRow[], { merge: false }>();
  if (error || !mine) return { items: [], requestCount: 0, failed: true };

  const rows = mine.filter((r) => r.conversation !== null);
  const requestCount = rows.filter((r) => r.status === "pending").length;
  const wanted = rows.filter((r) => (tab === "requests" ? r.status === "pending" : r.status === "active"));
  const ids = wanted.map((r) => r.conversation!.id);
  if (ids.length === 0) return { items: [], requestCount };

  const [others, lasts, hits] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select(`conversation_id, member:profiles!conversation_participants_user_id_fkey(${PERSON_COLUMNS})`)
      .in("conversation_id", ids)
      .neq("user_id", viewerId)
      .in("status", ["active", "pending"])
      .overrideTypes<OtherRow[], { merge: false }>(),
    supabase
      .from("messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false })
      .limit(Math.min(ids.length * 20, 1000))
      .overrideTypes<LastRow[], { merge: false }>(),
    q
      ? supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", ids)
          .ilike("body", `%${q}%`)
          .limit(200)
          .overrideTypes<{ conversation_id: string }[], { merge: false }>()
      : Promise.resolve({ data: [] as { conversation_id: string }[] }),
  ]);

  const peopleBy = new Map<string, Person[]>();
  for (const o of others.data ?? []) {
    if (o.member) peopleBy.set(o.conversation_id, [...(peopleBy.get(o.conversation_id) ?? []), o.member]);
  }
  const recent = new Map<string, LastRow[]>();
  for (const m of lasts.data ?? []) recent.set(m.conversation_id, [...(recent.get(m.conversation_id) ?? []), m]);
  const matched = new Set((hits.data ?? []).map((h) => h.conversation_id));

  let items = wanted.map((r): ConversationSummary => {
    const c = r.conversation!;
    const messages = recent.get(c.id) ?? [];
    const last = messages[0];
    return {
      id: c.id,
      kind: c.kind,
      title: c.title,
      status: r.status,
      last_message_at: c.last_message_at,
      // Counted from the most recent messages; a very long unread backlog shows as a lower bound.
      unread: messages.filter((m) => m.sender_id !== viewerId && m.created_at > r.last_read_at).length,
      last: last ? { body: last.body, created_at: last.created_at, mine: last.sender_id === viewerId } : null,
      others: peopleBy.get(c.id) ?? [],
    };
  });

  if (q) {
    const term = q.toLowerCase();
    items = items.filter((c) => matched.has(c.id) || conversationTitle(c).toLowerCase().includes(term));
  }
  items.sort((a, b) => b.last_message_at.localeCompare(a.last_message_at));
  return { items, requestCount };
}

type ThreadRow = {
  status: "active" | "pending";
  role: "admin" | "member";
  conversation: { id: string; kind: ConversationKind; title: string | null } | null;
};
type MessageQueryRow = { id: string; body: string; created_at: string; sender_id: string | null; sender: Person | null };

export async function getThread(viewerId: string, conversationId: string): Promise<ThreadView | null> {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("status, role, conversation:conversations!conversation_participants_conversation_id_fkey(id, kind, title)")
    .eq("conversation_id", conversationId)
    .eq("user_id", viewerId)
    .in("status", ["active", "pending"])
    .maybeSingle()
    .overrideTypes<ThreadRow, { merge: false }>();
  if (!mine?.conversation) return null;

  const [others, messages] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select(`status, member:profiles!conversation_participants_user_id_fkey(${PERSON_COLUMNS})`)
      .eq("conversation_id", conversationId)
      .neq("user_id", viewerId)
      .in("status", ["active", "pending"])
      .overrideTypes<{ status: string; member: Person | null }[], { merge: false }>(),
    supabase
      .from("messages")
      .select(`id, body, created_at, sender_id, sender:profiles!messages_sender_id_fkey(${PERSON_COLUMNS})`)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGES_PAGE)
      .overrideTypes<MessageQueryRow[], { merge: false }>(),
  ]);

  const rows = others.data ?? [];
  return {
    id: mine.conversation.id,
    kind: mine.conversation.kind,
    title: mine.conversation.title,
    status: mine.status,
    isAdmin: mine.role === "admin",
    awaitingReply: mine.conversation.kind === "direct" && rows.some((o) => o.status === "pending"),
    others: rows.flatMap((o) => (o.member ? [o.member] : [])),
    messages: (messages.data ?? [])
      .map((m) => ({ id: m.id, body: m.body, created_at: m.created_at, mine: m.sender_id === viewerId, sender: m.sender }))
      .reverse(),
  };
}

/** The viewer's accepted connections, for starting a conversation or a group. */
export async function listConnectionPeople(viewerId: string): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("connections")
    .select("requester_id, addressee_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
    .limit(300)
    .overrideTypes<{ requester_id: string; addressee_id: string }[], { merge: false }>();
  const ids = (data ?? []).map((c) => (c.requester_id === viewerId ? c.addressee_id : c.requester_id));
  if (ids.length === 0) return [];
  const { data: people } = await supabase
    .from("profiles")
    .select(PERSON_COLUMNS)
    .in("id", ids)
    .order("first_name", { ascending: true })
    .overrideTypes<Person[], { merge: false }>();
  return people ?? [];
}

export async function getPerson(id: string): Promise<Person | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PERSON_COLUMNS)
    .eq("id", id)
    .eq("onboarding_completed", true)
    .maybeSingle()
    .overrideTypes<Person, { merge: false }>();
  return data ?? null;
}

export { personName };
