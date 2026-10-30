// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildPlan, HEAVY_POSTER, NON_POSTERS, SEED_VALUE, TARGETS, validatePlan } from "./plan.ts";
import { BIO_SUFFIX } from "./content.ts";
import { avatarPng, coverPng } from "./png.ts";
import { exactLength } from "./prng.ts";
import { assertDevOnly, SeedSafetyError } from "./safety.ts";
import { literal } from "./sql.ts";

const NOW = new Date("2026-10-30T12:00:00.000Z");
const plan = buildPlan(NOW);

describe("seed plan", () => {
  it("passes every database-constraint check", () => {
    expect(validatePlan(plan, NOW)).toEqual([]);
  });

  it("is deterministic for a fixed seed and reference time, and changes with the seed", () => {
    expect(JSON.stringify(buildPlan(NOW))).toBe(JSON.stringify(plan));
    expect(JSON.stringify(buildPlan(NOW, SEED_VALUE + 1))).not.toBe(JSON.stringify(plan));
  });

  it("creates 30 members: 26 completed and 4 incomplete (hidden from others)", () => {
    expect(plan.members).toHaveLength(30);
    expect(plan.members.filter((m) => m.complete)).toHaveLength(26);
    const incomplete = plan.members.filter((m) => !m.complete);
    expect(incomplete).toHaveLength(4);
    expect(incomplete.every((m) => m.username === null && m.fields.length === 0)).toBe(true);
  });

  it("only uses fictional example.com seed emails and valid unique usernames", () => {
    for (const m of plan.members) expect(m.email).toMatch(/^seed\+[a-z0-9_]+@example\.com$/);
    const names = plan.members.map((m) => m.username).filter(Boolean);
    expect(new Set(names).size).toBe(names.length);
  });

  it("covers every member type, field, and career stage", () => {
    const completed = plan.members.filter((m) => m.complete);
    expect(new Set(completed.map((m) => m.memberType)).size).toBe(8);
    expect(new Set(completed.flatMap((m) => m.fields)).size).toBe(11);
    expect(new Set(completed.map((m) => m.careerStage)).size).toBe(6);
  });

  it("includes the requested edge cases", () => {
    const by = (slug: string) => plan.members.find((m) => m.slug === slug)!;
    expect(by("alexandrina_long").firstName.length + by("alexandrina_long").lastName.length).toBeGreaterThan(55);
    expect(by("zoe_angstrom").firstName).toBe("Zoë");
    expect(by("sage_n").bio).toBeNull();
    expect(by("dana_okafor").bio).toHaveLength(1000);
    expect(by("dana_okafor").bio!.endsWith(BIO_SUFFIX)).toBe(true);
    expect(by("bruno_c").headline).toBeNull();
    expect(plan.members.some((m) => m.complete && m.locationLabel === null)).toBe(true);
    expect(plan.members.some((m) => m.complete && !m.avatar)).toBe(true);
    for (const m of plan.members) if (m.bio) expect(m.bio.endsWith(BIO_SUFFIX)).toBe(true);
  });

  it("flags about eight mentors and gives avatars/covers to roughly 70% / 40%", () => {
    const completed = plan.members.filter((m) => m.complete);
    expect(completed.filter((m) => m.openToMentor)).toHaveLength(8);
    const avatars = completed.filter((m) => m.avatar).length / completed.length;
    const covers = completed.filter((m) => m.cover).length / completed.length;
    expect(avatars).toBeGreaterThan(0.6);
    expect(avatars).toBeLessThan(0.8);
    expect(covers).toBeGreaterThan(0.3);
    expect(covers).toBeLessThan(0.5);
  });

  it("creates 150 posts across all 7 categories with one heavy poster", () => {
    expect(plan.posts).toHaveLength(TARGETS.posts);
    expect(new Set(plan.posts.map((p) => p.category)).size).toBe(7);
    const byAuthor = new Map<string, number>();
    for (const p of plan.posts) byAuthor.set(p.authorSlug, (byAuthor.get(p.authorSlug) ?? 0) + 1);
    expect(byAuthor.get(HEAVY_POSTER)).toBeGreaterThanOrEqual(45);
    expect(Math.max(...[...byAuthor].filter(([s]) => s !== HEAVY_POSTER).map(([, n]) => n))).toBeLessThan(14);
    // Members who never post, to test an empty Activity tab.
    for (const slug of NON_POSTERS) expect(byAuthor.has(slug)).toBe(false);
  });

  it("includes long, multi-paragraph, escaping, edited, and generic-question posts", () => {
    expect(plan.posts.some((p) => p.body.length === 3000)).toBe(true);
    expect(plan.posts.filter((p) => p.body.includes("\n\n")).length).toBeGreaterThanOrEqual(6);
    for (const needle of ["<b>not bold</b>", "<script>", "&", '"', "'", "😊", "<"]) {
      expect(plan.posts.some((p) => p.body.includes(needle))).toBe(true);
    }
    expect(plan.posts.filter((p) => p.editedAt).length).toBeGreaterThan(5);
    const questions = plan.posts.filter((p) => p.category === "questions");
    expect(questions.length).toBeGreaterThan(10);
    expect(questions.every((p) => /no identifying details/i.test(p.body))).toBe(true);
  });

  it("spreads posts over the last 30 days and never into the future", () => {
    const oldest = Math.min(...plan.posts.map((p) => Date.parse(p.createdAt)));
    const newest = Math.max(...plan.posts.map((p) => Date.parse(p.createdAt)));
    expect(NOW.getTime() - oldest).toBeLessThanOrEqual(30 * 24 * 3_600_000);
    expect(NOW.getTime() - oldest).toBeGreaterThan(20 * 24 * 3_600_000);
    expect(newest).toBeLessThan(NOW.getTime());
  });

  it("creates about 250 comments and 500 likes with no duplicate likes", () => {
    expect(plan.comments.length).toBeGreaterThanOrEqual(TARGETS.comments[0]);
    expect(plan.comments.length).toBeLessThanOrEqual(TARGETS.comments[1]);
    expect(plan.likes.length).toBeGreaterThanOrEqual(TARGETS.likes[0]);
    expect(plan.likes.length).toBeLessThanOrEqual(TARGETS.likes[1]);
    expect(new Set(plan.likes.map((l) => `${l.postId}:${l.userSlug}`)).size).toBe(plan.likes.length);
    expect(plan.comments.filter((c) => c.body.length === 1000).length).toBeGreaterThanOrEqual(3);
    // Some posts have no engagement at all.
    const engaged = new Set([...plan.comments.map((c) => c.postId), ...plan.likes.map((l) => l.postId)]);
    expect(plan.posts.some((p) => !engaged.has(p.id))).toBe(true);
    // Comments per post stay between 1 and 12 where present.
    const perPost = new Map<string, number>();
    for (const c of plan.comments) perPost.set(c.postId, (perPost.get(c.postId) ?? 0) + 1);
    expect(Math.max(...perPost.values())).toBeLessThanOrEqual(30);
  });

  it("contains no email addresses, phone numbers or links in any text", () => {
    const text = [
      ...plan.members.flatMap((m) => [m.bio, m.headline, m.journey, m.aspirations, m.locationLabel ?? ""]),
      ...plan.posts.map((p) => p.body),
      ...plan.comments.map((c) => c.body),
    ].filter(Boolean) as string[];
    for (const t of text) {
      expect(t).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(t).not.toMatch(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/);
      expect(t).not.toMatch(/https?:\/\//);
    }
  });

  it("detects constraint violations when the plan is tampered with", () => {
    const broken = structuredClone(plan);
    broken.members[0].username = "Bad Name";
    broken.posts[0].body = "x".repeat(3001);
    broken.posts[1].category = "gossip";
    broken.likes.push({ ...broken.likes[0] });
    broken.comments[0].authorSlug = "pending_riley";
    const problems = validatePlan(broken, NOW);
    expect(problems.some((p) => /username format/.test(p))).toBe(true);
    expect(problems.some((p) => /body/.test(p))).toBe(true);
    expect(problems.some((p) => /category/.test(p))).toBe(true);
    expect(problems.some((p) => /duplicate/.test(p))).toBe(true);
    expect(problems.some((p) => /not a completed member/.test(p))).toBe(true);
  });
});

describe("helpers", () => {
  it("exactLength trims to the exact size and refuses to pad", () => {
    expect(exactLength("a".repeat(50), 10)).toHaveLength(10);
    expect(exactLength("abc", 3)).toBe("abc");
    expect(() => exactLength("ab", 5)).toThrow();
  });

  it("escapes SQL string literals", () => {
    expect(literal("it's")).toBe("'it''s'");
    expect(literal(null)).toBe("null");
    expect(literal("a\\b")).toBe("'a\\b'");
  });

  it("creates valid PNG files within the storage size limits", () => {
    for (const [png, w, h, max] of [
      [avatarPng(1), 256, 256, 2 * 1024 * 1024],
      [coverPng(2), 1200, 300, 5 * 1024 * 1024],
    ] as const) {
      expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(png.readUInt32BE(16)).toBe(w);
      expect(png.readUInt32BE(20)).toBe(h);
      expect(png.subarray(-8, -4).toString("ascii")).toBe("IEND");
      expect(png.length).toBeLessThan(max);
    }
  });
});

describe("safety guard", () => {
  const env = (over: Record<string, string | undefined>) => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SEED_ALLOWED_PROJECT_REF: "abcdefgh",
    NODE_ENV: "development",
    ...over,
  });

  it("accepts only the allowed development project", () => {
    expect(assertDevOnly(env({}))).toMatchObject({ ref: "abcdefgh" });
  });

  it.each([
    ["no allowed ref configured", { SEED_ALLOWED_PROJECT_REF: undefined }],
    ["a different project", { SEED_ALLOWED_PROJECT_REF: "zzzzzzzz" }],
    ["production mode", { NODE_ENV: "production" }],
    ["a missing URL", { NEXT_PUBLIC_SUPABASE_URL: undefined }],
    ["a missing key", { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined }],
    ["a non-Supabase URL", { NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.example.com" }],
    ["a ref that only appears inside the host", { NEXT_PUBLIC_SUPABASE_URL: "https://xabcdefghx.supabase.co" }],
  ])("refuses %s", (_label, over) => {
    expect(() => assertDevOnly(env(over))).toThrow(SeedSafetyError);
  });
});
