// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const C2 = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({ requireMember: async () => ({ user: { id: ME }, profile: { id: ME } }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/messaging/actions");
const queries = await import("@/features/messaging/queries");
const schemas = await import("@/features/messaging/schemas");
const types = await import("@/features/messaging/types");

const person = (id: string, first: string) => ({ id, username: first.toLowerCase(), first_name: first, last_name: "X", headline: null, avatar_path: null });

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  limit = { ok: true };
  rpc.mockResolvedValue({ data: C, error: null });
});

describe("starting and sending", () => {
  it("starts a conversation through the database function, as the session's member", async () => {
    expect(await actions.startConversation(OTHER, "  Hello  ")).toEqual({ ok: true, conversationId: C });
    expect(rpc).toHaveBeenCalledWith("start_direct_conversation", { p_other: OTHER, p_body: "Hello" });
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain(ME);
  });

  it("passes the database's refusal through unchanged and hides other errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "You can't message this member." } });
    expect(await actions.startConversation(OTHER, "Hi")).toEqual({ ok: false, error: "You can't message this member." });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "relation internal missing" } });
    expect(await actions.startConversation(OTHER, "Hi")).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(await actions.startConversation("nope", "Hi")).toMatchObject({ ok: false });
    expect(await actions.startConversation(OTHER, "   ")).toMatchObject({ ok: false });
    expect(await actions.startConversation(OTHER, "x".repeat(4001))).toMatchObject({ ok: false });
    limit = { ok: false, message: "Slow down." };
    expect(await actions.startConversation(OTHER, "Hi")).toEqual({ ok: false, error: "Slow down." });
  });

  it("sends as the signed-in member and explains the request limit and refusals", async () => {
    expect(await actions.sendMessage(C, "  Thanks  ")).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "messages", kind: "insert", payload: { conversation_id: C, sender_id: ME, body: "Thanks" } });

    db = makeDb(() => ({ error: { code: "23514", message: "This person has not accepted your message request yet." } }));
    expect(await actions.sendMessage(C, "Third")).toEqual({ ok: false, error: "This person has not accepted your message request yet." });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.sendMessage(C, "Hi")).toEqual({ ok: false, error: "You can't send messages in this conversation." });
    expect(await actions.sendMessage("bad", "Hi")).toMatchObject({ ok: false });
  });

  it("answers requests, makes groups of valid size, and manages membership through the database", async () => {
    expect(await actions.respondToRequest(C, false)).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("respond_to_message_request", { p_conversation: C, p_accept: false });

    expect(await actions.createGroup("  Study group ", [OTHER])).toEqual({ ok: true, conversationId: C });
    expect(rpc).toHaveBeenLastCalledWith("create_group_conversation", { p_title: "Study group", p_members: [OTHER] });
    expect(await actions.createGroup("", [OTHER])).toMatchObject({ ok: false });
    expect(await actions.createGroup("Group", [])).toMatchObject({ ok: false });
    expect(await actions.createGroup("Group", Array.from({ length: 20 }, () => OTHER))).toMatchObject({ ok: false });

    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Not allowed" } });
    expect(await actions.addGroupMember(C, OTHER)).toEqual({ ok: false, error: "Only a group admin can add people." });
    expect(await actions.leaveConversation(C)).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("leave_conversation", { p_conversation: C });
  });

  it("moves only the member's own read marker, and deletes only their own messages", async () => {
    await actions.markRead(C);
    const write = db.writes()[0];
    expect(write).toMatchObject({ table: "conversation_participants", kind: "update" });
    expect(Object.keys(write.payload as object)).toEqual(["last_read_at"]);
    expect(write.filters).toEqual(expect.arrayContaining([["conversation_id", C], ["user_id", ME]]));

    await actions.deleteMessage(C2);
    expect(db.writes().at(-1)!.filters).toEqual(expect.arrayContaining([["id", C2], ["sender_id", ME]]));
    db = makeDb(() => ({ data: [] }));
    expect(await actions.deleteMessage(C2)).toEqual({ ok: false, error: "That message no longer exists, or it isn't yours to delete." });
  });
});

describe("reading", () => {
  const mine = (id: string, status: "active" | "pending", last: string) => ({
    status,
    last_read_at: "2026-11-01T10:00:00Z",
    conversation: { id, kind: "direct", title: null, last_message_at: last },
  });

  it("builds the inbox with unread counts, previews and the viewer's own sent messages not counted", async () => {
    db = makeDb((op) => {
      if (op.table === "conversation_participants" && op.filters.some(([k]) => k === "user_id" && op.filters.length === 2)) {
        return { data: [mine(C, "active", "2026-11-02T10:00:00Z"), mine(C2, "pending", "2026-11-02T11:00:00Z")] };
      }
      if (op.table === "conversation_participants") return { data: [{ conversation_id: C, member: person(OTHER, "Bob") }] };
      if (op.table === "messages")
        return {
          data: [
            { conversation_id: C, body: "Latest", created_at: "2026-11-02T10:00:00Z", sender_id: OTHER },
            { conversation_id: C, body: "Mine", created_at: "2026-11-02T09:00:00Z", sender_id: ME },
            { conversation_id: C, body: "Old", created_at: "2026-10-30T09:00:00Z", sender_id: OTHER },
          ],
        };
      return undefined;
    });
    const inbox = await queries.listConversations(ME, { tab: "inbox", q: "" });
    expect(inbox.requestCount).toBe(1);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]).toMatchObject({ id: C, unread: 1, last: { body: "Latest", mine: false } });
    expect(types.conversationTitle(inbox.items[0])).toBe("Bob X");
  });

  it("shows only requests under the Requests tab, and finds conversations by message text or name", async () => {
    const rows = [mine(C, "active", "2026-11-02T10:00:00Z"), mine(C2, "pending", "2026-11-02T11:00:00Z")];
    db = makeDb((op) => {
      if (op.table === "conversation_participants" && op.filters.length === 2) return { data: rows };
      if (op.table === "conversation_participants") return { data: [] };
      if (op.table === "messages" && op.filters.some(([k, v]) => k === "body ilike" && v === "%forest%")) return { data: [{ conversation_id: C }] };
      return { data: [] };
    });
    const requests = await queries.listConversations(ME, { tab: "requests", q: "" });
    expect(requests.items.map((i) => i.id)).toEqual([C2]);
    const found = await queries.listConversations(ME, { tab: "inbox", q: "forest" });
    expect(found.items.map((i) => i.id)).toEqual([C]);
    const none = await queries.listConversations(ME, { tab: "inbox", q: "zzz" });
    // The text search ran against the messages table with the term as data.
    expect(db.ops.some((o) => o.table === "messages" && o.filters.some(([k, v]) => k === "body ilike" && v === "%zzz%"))).toBe(true);
    expect(none.items).toEqual([]);
  });

  it("returns nothing for a conversation the viewer is not part of", async () => {
    db = makeDb(() => ({ data: null }));
    expect(await queries.getThread(ME, C)).toBeNull();
  });

  it("marks a direct conversation as awaiting a reply while the other side is pending", async () => {
    db = makeDb((op) => {
      if (op.table === "conversation_participants" && op.filters.some(([k]) => k === "user_id"))
        return { data: { status: "active", role: "admin", conversation: { id: C, kind: "direct", title: null } } };
      if (op.table === "conversation_participants") return { data: [{ status: "pending", member: person(OTHER, "Bob") }] };
      if (op.table === "messages")
        return { data: [{ id: "m2", body: "Second", created_at: "2026-11-02T10:05:00Z", sender_id: ME, sender: person(ME, "Me") }, { id: "m1", body: "First", created_at: "2026-11-02T10:00:00Z", sender_id: ME, sender: person(ME, "Me") }] };
      return undefined;
    });
    const thread = await queries.getThread(ME, C);
    expect(thread).toMatchObject({ awaitingReply: true, status: "active" });
    // Messages arrive newest first from the database and are shown oldest first.
    expect(thread!.messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect(thread!.messages.every((m) => m.mine)).toBe(true);
  });
});

describe("inbox filters", () => {
  it("drops unknown tabs and malformed recipient ids", () => {
    expect(schemas.parseInboxParams({ tab: "spam", q: "a%b,c", to: "nope" })).toEqual({ tab: "inbox", q: "a b c", to: undefined });
    expect(schemas.parseInboxParams({ tab: "requests", to: OTHER })).toMatchObject({ tab: "requests", to: OTHER });
  });
});
