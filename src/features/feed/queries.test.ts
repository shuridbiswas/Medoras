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
    expect(db.ops[0].limit).toBe(3);
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
    const or = db.ops[0].filters.find(([k]) => k === "or")?.[1] as string;
    expect(or).toBe(
      `created_at.lt."2026-10-28T12:00:00.123456+00:00",and(created_at.eq."2026-10-28T12:00:00.123456+00:00",id.lt.${row(2).id})`,
    );
  });

  it("filters by category and by author when asked", async () => {
    await getFeedPage(ME, { category: "questions", authorId: OTHER });
    expect(db.ops[0].filters).toEqual([
      ["category", "questions"],
      ["author_id", OTHER],
    ]);
  });

  it("does not look up likes when there are no posts", async () => {
    await getFeedPage(ME, {});
    expect(db.ops.map((o) => o.table)).toEqual(["posts"]);
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
    expect(db.ops[0].filters).toEqual([["post_id", "p"]]);
  });
});
