// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, type Op } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const N1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

let db = makeDb();
let signedIn = true;

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => {
    if (!signedIn) redirectMock("/login");
    return { user: { id: ME }, profile: { id: ME } };
  },
}));

const actions = await import("@/features/notifications/actions");
const settings = await import("@/features/settings/actions");
const queries = await import("@/features/notifications/queries");
const { saveNotificationPreferences } = await import("@/features/notifications/preferences");
const format = await import("@/features/notifications/format");

const has = (op: Op, column: string, value: unknown) =>
  op.filters.some(([c, v]) => c === column && v === value);

const actor = {
  id: "u2",
  username: "sam_k",
  first_name: "Sam",
  last_name: "Kowalski",
  avatar_path: null,
};
const item = (over: Partial<import("@/features/notifications/format").NotificationItem> = {}) => ({
  id: N1,
  type: "post_comment" as const,
  entity_type: "post" as const,
  entity_id: "p1",
  created_at: "2026-10-30T10:00:00Z",
  read_at: null,
  actor,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
});

describe("describing notifications", () => {
  it("names the actor and what happened, for every type", () => {
    const sentences = (
      [
        "connection_request",
        "connection_accepted",
        "post_comment",
        "comment_reply",
        "mention",
        "community_event",
        "mentorship_event",
      ] as const
    ).map((type) => format.describeAction(type));
    expect(new Set(sentences).size).toBe(7);
    expect(format.describeAction("connection_request")).toBe("sent you a connection request");
    expect(format.describeAction("post_comment")).toBe("commented on your post");
    expect(format.actorName(actor)).toBe("Sam Kowalski");
    expect(format.actorName(null)).toBe("A member");
  });

  it("links to where it happened, always inside the app", () => {
    expect(format.notificationHref(item({ type: "connection_request", entity_type: "connection" }))).toBe(
      "/network/requests",
    );
    expect(format.notificationHref(item({ type: "connection_accepted", entity_type: "connection" }))).toBe(
      "/profile/sam_k",
    );
    expect(format.notificationHref(item())).toBe("/post/p1");
    expect(format.notificationHref(item({ type: "comment_reply" }))).toBe("/post/p1");
    expect(format.notificationHref(item({ type: "mention", entity_id: null }))).toBe("/notifications");
    expect(format.notificationHref(item({ type: "community_event", entity_type: "community" }))).toBe(
      "/notifications",
    );
    expect(
      format.notificationHref(item({ type: "connection_accepted", actor: { ...actor, username: null } })),
    ).toBe("/network/connections");
  });

  it("has no way to include post or comment text", () => {
    // The item type carries ids and names only; the sentence is built from type and actor.
    const text = `${format.actorName(actor)} ${format.describeAction("post_comment")}`;
    expect(Object.keys(item())).not.toEqual(expect.arrayContaining(["body", "preview", "text"]));
    expect(text).toBe("Sam Kowalski commented on your post");
  });
});

describe("reading notifications", () => {
  it("counts only the member's unread notifications", async () => {
    db = makeDb(() => ({ count: 4 }));
    expect(await queries.getUnreadCount(ME)).toBe(4);
    const [op] = db.ops;
    expect(has(op, "recipient_id", ME)).toBe(true);
    expect(has(op, "read_at is", null)).toBe(true);
  });

  it("shows no badge rather than an error when counting fails", async () => {
    db = makeDb(() => ({ error: { message: "boom" }, count: null }));
    expect(await queries.getUnreadCount(ME)).toBe(0);
  });

  it("lists the member's own notifications newest first with a page range", async () => {
    db = makeDb(() => ({ data: [item()], count: 41 }));
    const result = await queries.listNotifications(ME, 2);
    expect(result).toMatchObject({ total: 41, items: [{ id: N1 }] });
    const [op] = db.ops;
    expect(has(op, "recipient_id", ME)).toBe(true);
    expect(op.filters).toContainEqual(["range", [20, 39]]);
  });

  it("defaults in-app preferences to on when the member has no row", async () => {
    expect(await queries.getInAppPreferences(ME)).toEqual({ inappConnections: true, inappComments: true });
    db = makeDb(() => ({ data: { inapp_connections: false, inapp_comments: true } }));
    expect(await queries.getInAppPreferences(ME)).toEqual({ inappConnections: false, inappComments: true });
  });
});

describe("marking read and deleting", () => {
  it("marks one notification read, filtered by recipient and only while unread", async () => {
    db = makeDb((op) => (op.kind === "select" ? { count: 2 } : undefined));
    expect(await actions.markNotificationRead(N1)).toEqual({ ok: true, unread: 2 });
    const [op] = db.writes();
    expect(op).toMatchObject({ table: "notifications", kind: "update" });
    expect(Object.keys(op.payload as object)).toEqual(["read_at"]);
    expect(has(op, "id", N1)).toBe(true);
    expect(has(op, "recipient_id", ME)).toBe(true);
    expect(has(op, "read_at is", null)).toBe(true);
  });

  it("marks all of the member's notifications read, and nobody else's", async () => {
    await actions.markAllNotificationsRead();
    const [op] = db.writes();
    expect(has(op, "recipient_id", ME)).toBe(true);
    expect(has(op, "id", N1)).toBe(false);
  });

  it("deletes only the member's own notification", async () => {
    await actions.deleteNotification(N1);
    const [op] = db.writes();
    expect(op.kind).toBe("delete");
    expect(has(op, "recipient_id", ME)).toBe(true);
  });

  it("rejects bad ids, reports failures plainly and sends signed-out visitors to login", async () => {
    expect(await actions.markNotificationRead("nope")).toMatchObject({ ok: false });
    expect(await actions.deleteNotification("nope")).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
    db = makeDb(() => ({ error: { message: "internal detail" } }));
    expect(await actions.markAllNotificationsRead()).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
    signedIn = false;
    expect(await redirectOf(() => actions.markAllNotificationsRead())).toBe("/login");
  });
});

describe("notification preferences", () => {
  it("updates an existing row without ever writing the owner column", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [{ user_id: ME }] } : undefined));
    expect(await saveNotificationPreferences(ME, { inapp_comments: false })).toEqual({ error: null });
    expect(db.writes()).toHaveLength(1);
    const [op] = db.writes();
    expect(op.payload).toEqual({ inapp_comments: false });
    expect(has(op, "user_id", ME)).toBe(true);
  });

  it("creates the row for the verified user when none exists yet", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [] } : undefined));
    expect(await saveNotificationPreferences(ME, { notify_activity: false })).toEqual({ error: null });
    expect(db.writes().map((o) => o.kind)).toEqual(["update", "insert"]);
    expect(db.writes()[1].payload).toEqual({ user_id: ME, notify_activity: false });
  });

  it("retries the update when another request created the row first", async () => {
    let updates = 0;
    db = makeDb((op) => {
      if (op.kind === "update") return { data: updates++ === 0 ? [] : [{ user_id: ME }] };
      if (op.kind === "insert") return { error: { code: "23505" } };
      return undefined;
    });
    expect(await saveNotificationPreferences(ME, { inapp_connections: true })).toEqual({ error: null });
    expect(db.writes().map((o) => o.kind)).toEqual(["update", "insert", "update"]);
  });

  it("saves the in-app preferences from the form, ignoring any user id it carries", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [{ user_id: ME }] } : undefined));
    const result = await actions.updateInAppPreferences(
      { status: "idle" },
      makeFormData({ inappConnections: "on", user_id: "someone-else" }),
    );
    expect(result).toEqual({ status: "success", message: "Saved." });
    const [op] = db.writes();
    expect(op.payload).toEqual({ inapp_connections: true, inapp_comments: false });
    expect(has(op, "user_id", ME)).toBe(true);
  });

  it("saves the email preference the same way (no upsert that would write user_id)", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [{ user_id: ME }] } : undefined));
    const result = await settings.updateEmailPreferences({ status: "idle" }, makeFormData({ emailActivity: "on" }));
    expect(result.status).toBe("success");
    expect(db.writes()[0].payload).toEqual({ notify_activity: true });
  });

  it("does not leak database detail when saving fails", async () => {
    db = makeDb(() => ({ error: { code: "XX000", message: "secret detail" } }));
    const result = await actions.updateInAppPreferences({ status: "idle" }, makeFormData({}));
    expect(result).toEqual({ status: "error", message: "We couldn't save that. Please try again." });
  });
});
