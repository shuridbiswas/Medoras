// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";
const COMMENT = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let signedIn = true;
const profile = {
  id: ME,
  username: "amina_r",
  first_name: "Amina",
  last_name: "Rahman",
  headline: "Psychology student",
  avatar_path: null,
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => {
    if (!signedIn) redirectMock("/login");
    return { user: { id: ME }, profile };
  },
}));

const actions = await import("@/features/feed/actions");
const idle = { status: "idle" as const };

const counts = { likes: [{ count: 3 }], comments: [{ count: 2 }] };

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
});

describe("authentication", () => {
  it("sends signed-out visitors to login for every action", async () => {
    signedIn = false;
    const form = makeFormData({ category: "questions", body: "Hi" });
    for (const run of [
      () => actions.createPost(idle, form),
      () => actions.updatePost(idle, form),
      () => actions.deletePost(POST),
      () => actions.setLike(POST, true),
      () => actions.addComment(POST, "hi"),
      () => actions.deleteComment(COMMENT, POST),
      () => actions.loadMorePosts({}),
      () => actions.loadComments(POST),
    ]) {
      expect(await redirectOf(run)).toBe("/login");
    }
    expect(db.ops).toHaveLength(0);
  });
});

describe("createPost", () => {
  it("publishes as the signed-in member, ignoring any author id in the form", async () => {
    const result = await actions.createPost(
      idle,
      makeFormData({
        category: "career_journey",
        body: "  My first placement  ",
        author_id: OTHER,
        authorId: OTHER,
      }),
    );
    expect(result.status).toBe("success");
    expect(db.writes()).toEqual([
      expect.objectContaining({
        table: "posts",
        kind: "insert",
        payload: {
          author_id: ME,
          category: "career_journey",
          body: "My first placement",
        },
      }),
    ]);
  });

  it.each([
    ["an empty body", { category: "questions", body: "   " }],
    ["an unknown category", { category: "gossip", body: "Hello" }],
    ["a missing category", { body: "Hello" }],
    ["a body over 3000 characters", { category: "questions", body: "x".repeat(3001) }],
  ])("rejects %s without touching the database", async (_label, input) => {
    const result = await actions.createPost(idle, makeFormData(input));
    expect(result.status).toBe("error");
    expect(db.ops).toHaveLength(0);
  });

  it("shows the database's rate-limit message and hides other database errors", async () => {
    db = makeDb(() => ({ error: { message: "You are posting too quickly. Please try again later." } }));
    const limited = await actions.createPost(
      idle,
      makeFormData({ category: "questions", body: "One more" }),
    );
    expect(limited.message).toMatch(/too quickly/);

    db = makeDb(() => ({ error: { message: 'relation "posts" secret internals' } }));
    const broken = await actions.createPost(
      idle,
      makeFormData({ category: "questions", body: "One more" }),
    );
    expect(broken.message).toBe("Something went wrong. Please try again.");
  });
});

describe("updatePost (own posts only)", () => {
  const form = (extra: Record<string, string> = {}) =>
    makeFormData({ id: POST, category: "questions", body: "Edited", ...extra });

  it("scopes the update to the verified author and the post id", async () => {
    const result = await actions.updatePost(idle, form({ author_id: OTHER }));
    expect(result.status).toBe("success");
    expect(result.saved?.body).toBe("Edited");
    const [write] = db.writes();
    expect(write).toMatchObject({
      table: "posts",
      kind: "update",
      payload: { category: "questions", body: "Edited" },
    });
    expect(write.filters).toEqual([
      ["id", POST],
      ["author_id", ME],
    ]);
  });

  it("refuses to edit a post that is not theirs (no rows matched)", async () => {
    db = makeDb(() => ({ data: [] }));
    const result = await actions.updatePost(idle, form());
    expect(result.status).toBe("error");
    expect(result.message).toMatch(/isn't yours/);
    expect(result.saved).toBeUndefined();
  });

  it("rejects a malformed id and an empty body before any query", async () => {
    expect((await actions.updatePost(idle, form({ id: "nope" }))).status).toBe("error");
    expect((await actions.updatePost(idle, form({ body: " " }))).status).toBe("error");
    expect(db.ops).toHaveLength(0);
  });
});

describe("deletePost (own posts only)", () => {
  it("deletes only where the author is the verified user", async () => {
    expect(await actions.deletePost(POST)).toEqual({ ok: true });
    const [write] = db.writes();
    expect(write).toMatchObject({ table: "posts", kind: "delete" });
    expect(write.filters).toEqual([
      ["id", POST],
      ["author_id", ME],
    ]);
  });

  it("reports failure when nothing was deleted (someone else's or already gone)", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(await actions.deletePost(POST)).toMatchObject({ ok: false });
  });

  it("rejects an id that is not a uuid", async () => {
    expect(await actions.deletePost("1; drop table posts")).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });
});

describe("likes", () => {
  const withCounts = () =>
    makeDb((op) => (op.table === "posts" ? { data: counts } : undefined));

  it("likes as the signed-in member and returns the real count", async () => {
    db = withCounts();
    expect(await actions.setLike(POST, true)).toEqual({ ok: true, liked: true, likeCount: 3 });
    expect(db.writes()[0]).toMatchObject({
      table: "post_likes",
      kind: "insert",
      payload: { post_id: POST, user_id: ME },
    });
  });

  it("treats a repeated like as success (idempotent)", async () => {
    db = makeDb((op) =>
      op.table === "post_likes" ? { error: { code: "23505", message: "dup" } } : { data: counts },
    );
    expect(await actions.setLike(POST, true)).toMatchObject({ ok: true, liked: true });
  });

  it("unlikes only the member's own like", async () => {
    db = withCounts();
    expect(await actions.setLike(POST, false)).toMatchObject({ ok: true, liked: false });
    const [write] = db.writes();
    expect(write).toMatchObject({ table: "post_likes", kind: "delete" });
    expect(write.filters).toEqual([
      ["post_id", POST],
      ["user_id", ME],
    ]);
  });

  it("explains a like on a post that was deleted", async () => {
    db = makeDb(() => ({ error: { code: "23503", message: "fk" } }));
    expect(await actions.setLike(POST, true)).toMatchObject({
      ok: false,
      error: expect.stringMatching(/no longer available/),
    });
  });
});

describe("comments", () => {
  it("adds a comment as the signed-in member and returns it with the new count", async () => {
    db = makeDb((op) => {
      if (op.table === "post_comments")
        return { data: { id: COMMENT, post_id: POST, body: "Well said", created_at: "2026-10-30T12:00:00Z" } };
      return { data: counts };
    });
    const result = await actions.addComment(POST, "  Well said  ");
    expect(result).toMatchObject({
      ok: true,
      commentCount: 2,
      comment: {
        id: COMMENT,
        isOwn: true,
        author: { id: ME, first_name: "Amina" },
      },
    });
    expect(db.writes()[0].payload).toEqual({ post_id: POST, author_id: ME, body: "Well said" });
  });

  it("rejects empty and over-long comments and bad post ids", async () => {
    expect(await actions.addComment(POST, "   ")).toMatchObject({ ok: false });
    expect(await actions.addComment(POST, "x".repeat(1001))).toMatchObject({ ok: false });
    expect(await actions.addComment("bad", "hi")).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });

  it("deletes only the member's own comment", async () => {
    db = makeDb((op) => (op.table === "posts" ? { data: { likes: [], comments: [] } } : undefined));
    expect(await actions.deleteComment(COMMENT, POST)).toEqual({ ok: true, commentCount: 0 });
    expect(db.writes()[0].filters).toEqual([
      ["id", COMMENT],
      ["author_id", ME],
    ]);
  });

  it("will not delete someone else's comment", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(await actions.deleteComment(COMMENT, POST)).toMatchObject({ ok: false });
  });
});

describe("pagination and comment loading", () => {
  it("rejects a malformed cursor and never builds a filter from it", async () => {
    const result = await actions.loadMorePosts({ cursor: 'x"),id.gt.0,or=(a.eq.1' });
    expect(result).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
  });

  it("rejects an unknown category and an author id that is not a uuid", async () => {
    expect(await actions.loadMorePosts({ category: "gossip" })).toMatchObject({ ok: false });
    expect(await actions.loadMorePosts({ authorId: "me" })).toMatchObject({ ok: false });
  });

  it("loads the next page for a valid request", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(
      await actions.loadMorePosts({
        cursor: `2026-10-30T12:00:00.123456+00:00|${POST}`,
        category: "questions",
      }),
    ).toEqual({ ok: true, page: { posts: [], nextCursor: null } });
  });

  it("rejects a bad post id when loading comments", async () => {
    expect(await actions.loadComments("nope")).toMatchObject({ ok: false });
  });
});
