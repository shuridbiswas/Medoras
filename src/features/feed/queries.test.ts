// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";

let db = makeDb();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));

const { getFeedPage, getComments, encodeCursor } = await import(
  "@/features/feed/queries"
);

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

const author = (id: string, first = "Amina") => ({
  id,
  username: `user_${first.toLowerCase()}`,
  first_name: first,
  last_name: "R",
  headline: "Student",
  avatar_path: null,
});

const row = (n: number, authorId = OTHER) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  category: "questions",
  body: `Post ${n}`,
  created_at: `2026-10-${String(30 - n).padStart(2, "0")}T12:00:00.123456+00:00`,
  edited_at: null,
  author: author(authorId),
  likes: [{ count: n }],
  comments: [{ count: 1 }],
});

const postsOp = () => db.ops.find((o) => o.table === "posts")!;

beforeEach(() => {
  db = makeDb();
});

describe("getFeedPage", () => {
  it("returns posts newest-first as stored, with accurate counts and ownership", async () => {
    db = makeDb((op) => {
      if (op.table === "posts") return { data: [row(1, ME), row(2)] };
      return { data: [{ post_id: row(2).id }] };
    });
    const page = await getFeedPage(ME, {}, 15);
    expect(page.nextCursor).toBeNull();
    expect(page.posts.map((p) => p.body)).toEqual(["Post 1", "Post 2"]);
    expect(page.posts[0]).toMatchObject({ likeCount: 1, commentCount: 1, isOwn: true, likedByMe: false });
    expect(page.posts[1]).toMatchObject({ likeCount: 2, isOwn: false, likedByMe: true });
  });

  it("asks for one extra row to learn whether another page exists", async () => {
    db = makeDb((op) =>
      op.table === "posts" ? { data: [row(1), row(2), row(3)] } : { data: [] },
    );
    const page = await getFeedPage(ME, {}, 2);
    expect(postsOp().limit).toBe(3);
    expect(page.posts).toHaveLength(2);
    expect(page.nextCursor).toBe(encodeCursor(row(2)));
  });

  it("has no next cursor when the page is not full", async () => {
    db = makeDb((op) => (op.table === "posts" ? { data: [row(1), row(2)] } : { data: [] }));
    expect((await getFeedPage(ME, {}, 2)).nextCursor).toBeNull();
  });

  it("continues strictly after the cursor, breaking timestamp ties by id", async () => {
    const cursor = `2026-10-28T12:00:00.123456+00:00|${row(2).id}`;
    await getFeedPage(ME, { cursor }, 15);
    const or = postsOp().filters.find(([k]) => k === "or")?.[1] as string;
    expect(or).toBe(
      `created_at.lt."2026-10-28T12:00:00.123456+00:00",and(created_at.eq."2026-10-28T12:00:00.123456+00:00",id.lt.${row(2).id})`,
    );
  });

  it("filters by category and by author when asked", async () => {
    await getFeedPage(ME, { category: "questions", authorId: OTHER });
    expect(postsOp().filters).toEqual([
      ["category", "questions"],
      ["author_id", OTHER],
    ]);
    // Looking at one member's page never hides that member.
    expect(db.ops.map((o) => o.table)).not.toContain("member_blocks");
  });

  it("does not look up likes or saves when there are no posts", async () => {
    await getFeedPage(ME, {});
    expect(db.ops.map((o) => o.table)).toEqual(["member_blocks", "member_mutes", "posts"]);
  });

  it("keeps members the viewer blocked or muted out of the main feed", async () => {
    db = makeDb((op) => {
      if (op.table === "member_blocks") return { data: [{ blocked_id: OTHER }] };
      if (op.table === "member_mutes") return { data: [{ muted_id: "99999999-9999-4999-8999-999999999999" }, { muted_id: OTHER }] };
      return { data: [] };
    });
    await getFeedPage(ME, {});
    expect(postsOp().filters).toContainEqual(["author_id not", `(${OTHER},99999999-9999-4999-8999-999999999999)`]);
  });

  it("leaves the feed unfiltered when nobody is hidden", async () => {
    await getFeedPage(ME, {});
    expect(postsOp().filters.some(([k]) => k === "author_id not")).toBe(false);
  });

  it("marks posts the viewer saved, from the viewer's own saves only", async () => {
    db = makeDb((op) => {
      if (op.table === "posts") return { data: [row(1), row(2)] };
      if (op.table === "saved_items") return { data: [{ item_id: row(2).id }] };
      return { data: [] };
    });
    const page = await getFeedPage(ME, {}, 15);
    expect(page.posts.map((p) => p.savedByMe)).toEqual([false, true]);
    const saves = db.ops.find((o) => o.table === "saved_items")!;
    expect(saves.filters).toContainEqual(["user_id", ME]);
    expect(saves.filters).toContainEqual(["item_type", "post"]);
  });

  it("limits the Following view to posts by the members the viewer follows", async () => {
    db = makeDb((op) => {
      if (op.table === "follows") return { data: [{ followee_id: OTHER }] };
      if (op.table === "posts") return { data: [row(1)] };
      return { data: [] };
    });
    await getFeedPage(ME, { scope: "following" });
    expect(db.ops[0]).toMatchObject({ table: "follows" });
    expect(db.ops[0].filters).toContainEqual(["follower_id", ME]);
    const posts = db.ops.find((o) => o.table === "posts")!;
    expect(posts.filters).toContainEqual(["author_id", [OTHER]]);
  });

  it("shows an empty Following view without querying posts when the viewer follows nobody", async () => {
    db = makeDb(() => ({ data: [] }));
    expect(await getFeedPage(ME, { scope: "following" })).toEqual({ posts: [], nextCursor: null });
    expect(db.ops.map((o) => o.table)).toEqual(["follows"]);
  });

  it("reports a failure when the follow list cannot be read", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await getFeedPage(ME, { scope: "following" })).toMatchObject({ posts: [], failed: true });
  });

  it("reports a failure instead of pretending the feed is empty", async () => {
    db = makeDb(() => ({ error: { message: "boom" }, data: null }));
    expect(await getFeedPage(ME, {})).toMatchObject({ posts: [], failed: true });
  });

  it("drops posts whose author can't be read", async () => {
    db = makeDb((op) =>
      op.table === "posts" ? { data: [{ ...row(1), author: null }, row(2)] } : { data: [] },
    );
    expect((await getFeedPage(ME, {})).posts.map((p) => p.body)).toEqual(["Post 2"]);
  });
});

describe("getComments", () => {
  it("returns the post's comments with ownership", async () => {
    db = makeDb(() => ({
      data: [
        { id: "c1", post_id: "p", body: "Mine", created_at: "2026-10-30T10:00:00Z", author: author(ME) },
        { id: "c2", post_id: "p", body: "Theirs", created_at: "2026-10-30T11:00:00Z", author: author(OTHER, "Sam") },
      ],
    }));
    const { comments } = await getComments(ME, "p");
    expect(comments.map((c) => [c.body, c.isOwn])).toEqual([
      ["Mine", true],
      ["Theirs", false],
    ]);
    expect(db.ops.find((o) => o.table === "post_comments")!.filters).toEqual([["post_id", "p"]]);
  });

  it("leaves out comments by members the viewer blocked or muted", async () => {
    db = makeDb((op) => {
      if (op.table === "member_mutes") return { data: [{ muted_id: OTHER }] };
      if (op.table === "post_comments")
        return {
          data: [
            { id: "c1", post_id: "p", body: "Mine", created_at: "2026-10-30T10:00:00Z", author: author(ME) },
            { id: "c2", post_id: "p", body: "Muted", created_at: "2026-10-30T11:00:00Z", author: author(OTHER, "Sam") },
          ],
        };
      return { data: [] };
    });
    const { comments } = await getComments(ME, "p");
    expect(comments.map((c) => c.body)).toEqual(["Mine"]);
  });
});
