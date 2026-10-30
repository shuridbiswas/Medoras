// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, type Op } from "@/test/db-mock";
import { redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const CONNECTION = "33333333-3333-4333-8333-333333333333";

let db = makeDb();
let signedIn = true;
let limit: { ok: true } | { ok: false; message: string } = { ok: true };

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
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
const getRelationship = vi.fn(async (_viewer: string, other: string) => ({
  state: "connected" as const,
  connectionId: CONNECTION,
  following: false,
  other,
}));
vi.mock("@/features/network/queries", () => ({
  getRelationship: (viewer: string, other: string) => getRelationship(viewer, other),
}));

const actions = await import("@/features/network/actions");

const writes = () => db.writes();
const has = (op: Op, column: string, value: unknown) =>
  op.filters.some(([c, v]) => c === column && v === value);

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
  limit = { ok: true };
});

describe("authentication", () => {
  it("sends signed-out visitors to login for every action without touching the database", async () => {
    signedIn = false;
    for (const run of [
      () => actions.sendConnectionRequest(OTHER),
      () => actions.acceptRequest(CONNECTION),
      () => actions.declineRequest(CONNECTION),
      () => actions.withdrawRequest(CONNECTION),
      () => actions.removeConnection(CONNECTION),
      () => actions.setFollow(OTHER, true),
      () => actions.setBlock(OTHER, true),
    ]) {
      expect(await redirectOf(run)).toBe("/login");
    }
    expect(db.ops).toHaveLength(0);
  });
});

describe("sendConnectionRequest", () => {
  it("sends the request as the signed-in member and reports the new relationship", async () => {
    const result = await actions.sendConnectionRequest(OTHER);
    expect(writes()).toEqual([
      expect.objectContaining({
        table: "connections",
        kind: "insert",
        payload: { requester_id: ME, addressee_id: OTHER },
      }),
    ]);
    expect(result).toMatchObject({ ok: true, relationship: { connectionId: CONNECTION } });
    expect(getRelationship).toHaveBeenCalledWith(ME, OTHER);
  });

  it("refuses a request to oneself before reaching the database", async () => {
    expect(await actions.sendConnectionRequest(ME)).toEqual({
      ok: false,
      error: "You can't connect with yourself.",
    });
    expect(db.ops).toHaveLength(0);
  });

  it("refuses malformed member ids", async () => {
    expect(await actions.sendConnectionRequest("not-a-uuid")).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });

  it("treats a duplicate request as already done instead of an error", async () => {
    db = makeDb(() => ({ error: { code: "23505", message: "duplicate key" } }));
    expect(await actions.sendConnectionRequest(OTHER)).toMatchObject({ ok: true });
  });

  it("gives the same answer whether a block or an unfinished profile is the reason", async () => {
    db = makeDb(() => ({ error: { code: "42501", message: "violates row-level security policy" } }));
    const result = await actions.sendConnectionRequest(OTHER);
    expect(result).toEqual({ ok: false, error: "You can't do that with this member." });
    expect(JSON.stringify(result)).not.toMatch(/block/i);
  });

  it("passes on the database rate limit message and hides other failures", async () => {
    db = makeDb(() => ({ error: { code: "23514", message: "You are sending requests too quickly. Please try again later." } }));
    expect(await actions.sendConnectionRequest(OTHER)).toEqual({
      ok: false,
      error: "You are sending requests too quickly. Please try again later.",
    });
    db = makeDb(() => ({ error: { code: "XX000", message: "relation connections internal detail" } }));
    expect(await actions.sendConnectionRequest(OTHER)).toEqual({
      ok: false,
      error: "Something went wrong. Please try again.",
    });
  });

  it("stops at the app rate limit", async () => {
    limit = { ok: false, message: "Slow down." };
    expect(await actions.sendConnectionRequest(OTHER)).toEqual({ ok: false, error: "Slow down." });
    expect(db.ops).toHaveLength(0);
  });
});

describe("answering and ending connections", () => {
  it("accepts only a pending request addressed to the member", async () => {
    db = makeDb((op) =>
      op.kind === "update" ? { data: [{ id: CONNECTION, requester_id: OTHER }] } : undefined,
    );
    const result = await actions.acceptRequest(CONNECTION);
    const [op] = writes();
    expect(op).toMatchObject({ table: "connections", kind: "update", payload: { status: "accepted" } });
    expect(has(op, "id", CONNECTION)).toBe(true);
    expect(has(op, "addressee_id", ME)).toBe(true);
    expect(has(op, "status", "pending")).toBe(true);
    expect(result).toMatchObject({ ok: true });
    expect(getRelationship).toHaveBeenCalledWith(ME, OTHER);
  });

  it("reports an unavailable request when nothing matched (wrong person, withdrawn, already answered)", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(await actions.acceptRequest(CONNECTION)).toEqual({
      ok: false,
      error: "That request is no longer available.",
    });
    expect(await actions.declineRequest(CONNECTION)).toMatchObject({ ok: false });
    expect(await actions.withdrawRequest(CONNECTION)).toMatchObject({ ok: false });
  });

  it("declines as the addressee, only while pending", async () => {
    db = makeDb(() => ({ data: [{ requester_id: OTHER, addressee_id: ME }] }));
    expect(await actions.declineRequest(CONNECTION)).toMatchObject({ ok: true });
    const [op] = writes();
    expect(op).toMatchObject({ table: "connections", kind: "delete" });
    expect(has(op, "id", CONNECTION)).toBe(true);
    expect(has(op, "addressee_id", ME)).toBe(true);
    expect(has(op, "status", "pending")).toBe(true);
    expect(getRelationship).toHaveBeenLastCalledWith(ME, OTHER);
  });

  it("withdraws as the requester, only while pending", async () => {
    db = makeDb(() => ({ data: [{ requester_id: ME, addressee_id: OTHER }] }));
    expect(await actions.withdrawRequest(CONNECTION)).toMatchObject({ ok: true });
    const [op] = writes();
    expect(op).toMatchObject({ table: "connections", kind: "delete" });
    expect(has(op, "requester_id", ME)).toBe(true);
    expect(has(op, "status", "pending")).toBe(true);
    expect(getRelationship).toHaveBeenLastCalledWith(ME, OTHER);
  });

  it("removes an accepted connection only if the member is one of its two people", async () => {
    db = makeDb(() => ({ data: [{ requester_id: OTHER, addressee_id: ME }] }));
    const result = await actions.removeConnection(CONNECTION);
    const [op] = writes();
    expect(has(op, "status", "accepted")).toBe(true);
    expect(op.filters).toContainEqual(["or", `requester_id.eq.${ME},addressee_id.eq.${ME}`]);
    expect(result).toMatchObject({ ok: true });
  });

  it("says so when the connection is already gone", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(await actions.removeConnection(CONNECTION)).toEqual({
      ok: false,
      error: "That connection no longer exists.",
    });
  });

  it("rejects malformed ids without querying", async () => {
    for (const run of [
      () => actions.acceptRequest("x"),
      () => actions.declineRequest("x"),
      () => actions.withdrawRequest("x"),
      () => actions.removeConnection("x"),
    ]) {
      expect(await run()).toMatchObject({ ok: false });
    }
    expect(db.ops).toHaveLength(0);
  });
});

describe("setFollow", () => {
  it("follows as the signed-in member and is idempotent", async () => {
    expect(await actions.setFollow(OTHER, true)).toMatchObject({ ok: true });
    expect(writes()[0]).toMatchObject({
      table: "follows",
      kind: "insert",
      payload: { follower_id: ME, followee_id: OTHER },
    });
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await actions.setFollow(OTHER, true)).toMatchObject({ ok: true });
  });

  it("unfollows only the member's own follow", async () => {
    await actions.setFollow(OTHER, false);
    const [op] = writes();
    expect(op.kind).toBe("delete");
    expect(has(op, "follower_id", ME)).toBe(true);
    expect(has(op, "followee_id", OTHER)).toBe(true);
  });

  it("refuses to follow oneself and hides blocks behind the same message as connect", async () => {
    expect(await actions.setFollow(ME, true)).toEqual({ ok: false, error: "You can't follow yourself." });
    db = makeDb(() => ({ error: { code: "42501" } }));
    expect(await actions.setFollow(OTHER, true)).toEqual({
      ok: false,
      error: "You can't do that with this member.",
    });
  });
});

describe("setBlock", () => {
  it("blocks as the signed-in member, idempotently", async () => {
    expect(await actions.setBlock(OTHER, true)).toEqual({ ok: true });
    expect(writes()[0]).toMatchObject({
      table: "member_blocks",
      kind: "insert",
      payload: { blocker_id: ME, blocked_id: OTHER },
    });
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await actions.setBlock(OTHER, true)).toEqual({ ok: true });
  });

  it("unblocks only the member's own block", async () => {
    await actions.setBlock(OTHER, false);
    const [op] = writes();
    expect(op.kind).toBe("delete");
    expect(has(op, "blocker_id", ME)).toBe(true);
    expect(has(op, "blocked_id", OTHER)).toBe(true);
  });

  it("refuses to block oneself or a malformed id", async () => {
    expect(await actions.setBlock(ME, true)).toMatchObject({ ok: false });
    expect(await actions.setBlock("nope", true)).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });

  it("reports a failure without leaking database detail", async () => {
    db = makeDb(() => ({ error: { code: "XX000", message: "secret internal detail" } }));
    const result = await actions.setBlock(OTHER, true);
    expect(result).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});
