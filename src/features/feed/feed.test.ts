// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

import {
  commentSchema,
  CURSOR_PATTERN,
  editPostSchema,
  feedRequestSchema,
  postSchema,
} from "@/features/feed/schemas";
import { categoryLabel, POST_CATEGORIES } from "@/features/feed/options";
import { cleanTerms, validField } from "@/features/home/search";

const ID = "33333333-3333-4333-8333-333333333333";

describe("post validation", () => {
  it("trims the text and accepts every category", () => {
    for (const c of POST_CATEGORIES) {
      expect(postSchema.parse({ category: c.value, body: "  Hi  " })).toEqual({
        category: c.value,
        body: "Hi",
      });
    }
  });

  it("accepts clinical shorthand such as < and > (text is rendered escaped, never as markup)", () => {
    expect(postSchema.safeParse({ category: "questions", body: "Is HbA1c < 6.5% typical?" }).success).toBe(true);
  });

  it("rejects empty, whitespace-only and over-long text and unknown categories", () => {
    expect(postSchema.safeParse({ category: "questions", body: "" }).success).toBe(false);
    expect(postSchema.safeParse({ category: "questions", body: " \n\t " }).success).toBe(false);
    expect(postSchema.safeParse({ category: "questions", body: "x".repeat(3000) }).success).toBe(true);
    expect(postSchema.safeParse({ category: "questions", body: "x".repeat(3001) }).success).toBe(false);
    expect(postSchema.safeParse({ category: "gossip", body: "hi" }).success).toBe(false);
  });

  it("requires a uuid to edit a post", () => {
    expect(editPostSchema.safeParse({ id: ID, category: "questions", body: "x" }).success).toBe(true);
    expect(editPostSchema.safeParse({ id: "1", category: "questions", body: "x" }).success).toBe(false);
  });

  it("limits comments to 1000 characters", () => {
    expect(commentSchema.safeParse({ postId: ID, body: "x".repeat(1000) }).success).toBe(true);
    expect(commentSchema.safeParse({ postId: ID, body: "x".repeat(1001) }).success).toBe(false);
    expect(commentSchema.safeParse({ postId: ID, body: "  " }).success).toBe(false);
  });
});

describe("feed cursor", () => {
  it("accepts the exact shape the database produces", () => {
    for (const ok of [
      `2026-10-30T12:00:00.123456+00:00|${ID}`,
      `2026-10-30T12:00:00Z|${ID}`,
      `2026-10-30T12:00:00.5-04:00|${ID}`,
    ])
      expect(CURSOR_PATTERN.test(ok)).toBe(true);
  });

  it.each([
    "",
    "garbage",
    `2026-10-30|${ID}`,
    `2026-10-30T12:00:00Z|not-a-uuid`,
    `2026-10-30T12:00:00Z",id.gt.0,or=(a.eq.1|${ID}`,
    `2026-10-30T12:00:00Z|${ID},id.gt.0`,
    `2026-10-30T12:00:00Z|${ID}\n`,
  ])("rejects %j (it is interpolated into a filter)", (bad) => {
    expect(feedRequestSchema.safeParse({ cursor: bad }).success).toBe(false);
  });

  it("validates category and author filters", () => {
    expect(feedRequestSchema.safeParse({ category: "questions", authorId: ID }).success).toBe(true);
    expect(feedRequestSchema.safeParse({ category: "x" }).success).toBe(false);
    expect(feedRequestSchema.safeParse({ authorId: "me" }).success).toBe(false);
  });
});

describe("category labels", () => {
  it("falls back for unknown values", () => {
    expect(categoryLabel("questions")).toBe("Questions");
    expect(categoryLabel("legacy")).toBe("Discussion");
  });
});

describe("member search input", () => {
  it("splits into at most three clean terms and strips filter syntax", () => {
    expect(cleanTerms("  Amina   Rahman ")).toEqual(["Amina", "Rahman"]);
    expect(cleanTerms("a,b)or(id.eq.1")).toEqual(["a", "b", "or"]);
    expect(cleanTerms("%_*\\\"'")).toEqual([]);
    expect(cleanTerms("one two three four five")).toHaveLength(3);
    expect(cleanTerms(undefined)).toEqual([]);
  });

  it("accepts only known fields", () => {
    expect(validField("nursing")).toBe("nursing");
    expect(validField("astrology")).toBeUndefined();
    expect(validField(undefined)).toBeUndefined();
  });
});
