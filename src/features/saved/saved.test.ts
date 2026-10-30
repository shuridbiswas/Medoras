// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, type Op } from "@/test/db-mock";
import { redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const P1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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

const { setSaved } = await import("@/features/saved/actions");
const { getSavedPosts, SAVED_PAGE_SIZE } = await import("@/features/saved/queries");

const has = (op: Op, column: string, value: unknown) =>
  op.filters.some(([c, v]) => c === column && v === value);

const author = {
  id: "u2",
  username: "sam_k",
  first_name: "Sam",
  last_name: "K",
  headline: null,
  avatar_path: null,
};
const postRow = (id: string) => ({
  id,
  category: "questions",
  body: `Body ${id}`,
  created_at: "2026-10-28T12:00:00+00:00",
  edited_at: null,
  author,
  likes: [{ count: 0 }],
  comments: [{ count: 0 }],
});

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
  limit = { ok: true };
});

describe("setSaved", () => {
  it("saves a post for the signed-in member as a post item", async () => {
    expect(await setSaved(P1, true)).toEqual({ ok: true, saved: true });
    expect(db.writes()).toEqual([
      expect.objectContaining({
        table: "saved_items",
        kind: "insert",
        payload: { user_id: ME, item_type: "post", item_id: P1 },
      }),
    ]);
  });

  it("is idempotent when the post is already saved", async () => {
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await setSaved(P1, true)).toEqual({ ok: true, saved: true });
  });

  it("removes only the member's own save", async () => {
    expect(await setSaved(P1, false)).toEqual({ ok: true, saved: false });
    const [op] = db.writes();
    expect(op.kind).toBe("delete");
    expect(has(op, "user_id", ME)).toBe(true);
    expect(has(op, "item_type", "post")).toBe(true);
    expect(has(op, "item_id", P1)).toBe(true);
  });

  it("says the post is gone when it no longer exists, and hides other database errors", async () => {
    db = makeDb(() => ({ error: { code: "42501", message: "row-level security" } }));
    expect(await setSaved(P1, true)).toEqual({ ok: false, error: "That post is no longer available." });
    db = makeDb(() => ({ error: { code: "XX000", message: "internal detail" } }));
    expect(await setSaved(P1, true)).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("rejects bad ids, signed-out visitors and rate-limited members without saving anything", async () => {
    expect(await setSaved("nope", true)).toMatchObject({ ok: false });
    limit = { ok: false, message: "Slow down." };
    expect(await setSaved(P1, true)).toEqual({ ok: false, error: "Slow down." });
    limit = { ok: true };
    signedIn = false;
    expect(await redirectOf(() => setSaved(P1, true))).toBe("/login");
    expect(db.ops).toHaveLength(0);
  });
});

describe("getSavedPosts", () => {
  it("lists the viewer's saved posts most recently saved first, keeping that order", async () => {
    db = makeDb((op) => {
      if (op.table === "saved_items" && op.filters.some(([c]) => c === "select options"))
        return { data: [{ item_id: P2 }, { item_id: P1 }], count: 2 };
      if (op.table === "posts") return { data: [postRow(P1), postRow(P2)] };
      if (op.table === "saved_items") return { data: [{ item_id: P1 }, { item_id: P2 }] };
      return { data: [] };
    });
    const result = await getSavedPosts(ME, 1);
    expect(result.posts.map((p) => p.id)).toEqual([P2, P1]);
    expect(result.posts.every((p) => p.savedByMe)).toBe(true);
    expect(result.total).toBe(2);
    const list = db.ops[0];
    expect(has(list, "user_id", ME)).toBe(true);
    expect(has(list, "item_type", "post")).toBe(true);
  });

  it("pages ten at a time", async () => {
    db = makeDb(() => ({ data: [], count: 0 }));
    await getSavedPosts(ME, 3);
    expect(db.ops[0].filters).toContainEqual(["range", [2 * SAVED_PAGE_SIZE, 3 * SAVED_PAGE_SIZE - 1]]);
  });

  it("flags a failure instead of pretending nothing is saved", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await getSavedPosts(ME, 1)).toEqual({ posts: [], total: 0, failed: true });
  });
});
