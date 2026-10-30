import { describe, expect, it } from "vitest";
import { FIELDS, MEMBER_TYPES } from "../../src/features/onboarding/options.ts";
import { FEED_PAGE_SIZE, POST_CATEGORIES } from "../../src/features/feed/options.ts";
import { EN } from "./content-en.ts";
import { FR } from "./content-fr.ts";
import { THEMES } from "./content-types.ts";
import {
  buildPlan, describePlan, FICTIONAL_MARKERS, HEAVY_POSTER, SEED_VALUE, TARGETS, validatePlan,
} from "./plan.ts";
import { exactLength } from "./prng.ts";
import { avatarPng, coverPng } from "./png.ts";
import { assertDevOnly, SeedSafetyError } from "./safety.ts";
import { literal } from "./sql.ts";
import { agreeFrench, similarity } from "./text.ts";
import { isSeedEmail, parseKeepList } from "./wipe.ts";

const NOW = new Date("2026-11-02T15:00:00.000Z");
const plan = buildPlan(NOW);
const summary = describePlan(plan);
const DAY = 24 * 60 * 60 * 1000;

describe("generated Quebec plan", () => {
  it("satisfies every database constraint", () => {
    expect(validatePlan(plan, NOW)).toEqual([]);
  });

  it("is deterministic for the same seed and clock", () => {
    expect(JSON.stringify(buildPlan(NOW))).toBe(JSON.stringify(plan));
    expect(JSON.stringify(buildPlan(NOW, SEED_VALUE + 1))).not.toBe(JSON.stringify(plan));
  }, 60_000);

  it("has 50 members: 46 complete, 4 incomplete without a username", () => {
    expect(plan.members).toHaveLength(TARGETS.members);
    expect(summary.completed).toBe(46);
    const incomplete = plan.members.filter((m) => !m.complete);
    expect(incomplete).toHaveLength(4);
    expect(incomplete.every((m) => m.username === null && m.bio === null)).toBe(true);
  });

  it("follows the requested mix of roles and cities", () => {
    expect(summary.byRole).toEqual({ student: 18, professional: 17, educator: 5, researcher: 5, independent: 5 });
    expect(summary.byCity).toEqual({
      "Montréal": 22, Laval: 6, Longueuil: 5, "Châteauguay": 3, Brossard: 3, Terrebonne: 2,
      Repentigny: 2, "Saint-Jérôme": 2, "Vaudreuil-Dorion": 2, Sherbrooke: 1, "Québec": 2,
    });
    for (const m of plan.members.filter((x) => x.complete)) {
      expect(m.country).toBe("CA");
      expect(m.locationLabel).toMatch(/, QC$/);
    }
  });

  it("uses only real enum values and keeps usernames unique, ASCII and unreserved", () => {
    const fields = FIELDS.map((f) => f.value as string);
    const types = MEMBER_TYPES.map((t) => t.value as string);
    const names = new Set<string>();
    for (const m of plan.members) {
      expect(types).toContain(m.memberType);
      m.fields.forEach((f) => expect(fields).toContain(f));
      if (m.username) {
        expect(m.username).toMatch(/^[a-z0-9_]{3,30}$/);
        expect(names.has(m.username)).toBe(false);
        names.add(m.username);
      }
    }
  });

  it("has natural Quebec names, accent edge cases and a very long name", () => {
    expect(plan.members.some((m) => /[éèêëàâîïôùûç]/i.test(`${m.firstName}${m.lastName}`))).toBe(true);
    expect(plan.members.some((m) => `${m.firstName} ${m.lastName}`.length >= 50)).toBe(true);
  });

  it("marks every bio as fictional in the bio's own language", () => {
    for (const m of plan.members.filter((x) => x.bio)) {
      expect(FICTIONAL_MARKERS.some((mark) => m.bio!.endsWith(mark))).toBe(true);
      expect(m.bio!.endsWith(m.lang === "fr" ? "(Profil fictif de test)" : "(Fictional test profile)")).toBe(true);
    }
    expect(plan.members.some((m) => m.bio?.length === 1000)).toBe(true);
    expect(plan.members.some((m) => !m.bio && m.complete)).toBe(true);
  });

  it("has mentors, mentorship seekers, images and sections in realistic shares", () => {
    expect(summary.openToMentor).toBeGreaterThanOrEqual(7);
    expect(summary.openToMentor).toBeLessThanOrEqual(10);
    expect(summary.lookingForMentorship).toBe(10);
    expect(summary.avatars / 46).toBeGreaterThan(0.6);
    expect(summary.avatars / 46).toBeLessThan(0.78);
    expect(summary.covers / 46).toBeGreaterThan(0.3);
    expect(summary.covers / 46).toBeLessThan(0.45);
    for (const m of plan.members.filter((x) => x.complete)) {
      expect(m.tags.length).toBeGreaterThanOrEqual(3);
      expect(m.education.length).toBeGreaterThan(0);
    }
  });

  it("uses real institutions only as context and never invents licence or employee numbers", () => {
    const text = JSON.stringify(plan.members);
    expect(text).toMatch(/Université de Montréal/);
    expect(text).toMatch(/CHUM/);
    expect(text).not.toMatch(/licen[cs]e? ?(no|number|#)|permis n|employee id|matricule/i);
  });
});

describe("posts, comments and likes", () => {
  it("creates 250 posts over all seven categories, 70 of them questions", () => {
    expect(plan.posts).toHaveLength(250);
    expect(summary.questions).toBe(70);
    for (const c of POST_CATEGORIES) expect(summary.postsByCategory[c.value] ?? 0).toBeGreaterThan(0);
    expect(Object.keys(summary.postsByCategory)).toHaveLength(7);
  });

  it("keeps the language split within 3 points of 65/35 for posts and comments", () => {
    for (const [counts, total] of [[summary.postsByLanguage, plan.posts.length], [summary.commentsByLanguage, plan.comments.length]] as const) {
      expect(Math.abs(counts.fr / total - 0.65)).toBeLessThanOrEqual(0.03);
      expect(Math.abs(counts.en / total - 0.35)).toBeLessThanOrEqual(0.03);
    }
  });

  it("has a heavy poster that pages at 15, one 3000-character post and special-character posts", () => {
    const heavy = plan.posts.filter((p) => p.authorSlug === HEAVY_POSTER);
    expect(heavy.length).toBeGreaterThanOrEqual(45);
    expect(Math.ceil(heavy.length / FEED_PAGE_SIZE)).toBeGreaterThanOrEqual(4);
    expect(plan.posts.filter((p) => p.body.length === 3000)).toHaveLength(1);
    expect(plan.posts.filter((p) => /[<>]/.test(p.body) && /&/.test(p.body) && /["'«]/.test(p.body)).length).toBeGreaterThanOrEqual(3);
    expect(plan.posts.some((p) => /\p{Extended_Pictographic}/u.test(p.body))).toBe(true);
    expect(plan.posts.some((p) => p.editedAt)).toBe(true);
    expect(plan.posts.some((p) => p.body.length < 100)).toBe(true);
    expect(plan.posts.some((p) => p.body.length > 800)).toBe(true);
  });

  it("spreads activity over the last 120 days and keeps comments and likes after their posts", () => {
    const times = plan.posts.map((p) => Date.parse(p.createdAt));
    expect((NOW.getTime() - Math.min(...times)) / DAY).toBeGreaterThan(100);
    expect((NOW.getTime() - Math.min(...times)) / DAY).toBeLessThanOrEqual(121);
    expect((NOW.getTime() - Math.max(...times)) / DAY).toBeLessThan(10);
    const born = plan.members.filter((m) => m.complete).map((m) => (NOW.getTime() - Date.parse(m.profileCreatedAt)) / DAY);
    expect(Math.max(...born) - Math.min(...born)).toBeGreaterThan(60);
    const postsBy = new Set(plan.posts.map((p) => p.authorSlug));
    expect(postsBy.size).toBeLessThan(46); // some members are inactive
  });

  it("has 400 comments up to 1000 characters, with some at exactly 1000 and uneven threads", () => {
    expect(plan.comments).toHaveLength(400);
    expect(plan.comments.some((c) => c.body.length === 1000)).toBe(true);
    expect(Math.max(...plan.comments.map((c) => c.body.length))).toBeLessThanOrEqual(1000);
    const perPost = new Map<string, number>();
    for (const c of plan.comments) perPost.set(c.postId, (perPost.get(c.postId) ?? 0) + 1);
    expect(Math.max(...perPost.values())).toBeGreaterThanOrEqual(8);
    expect(Math.max(...perPost.values())).toBeLessThanOrEqual(12);
    expect(perPost.size).toBeLessThan(plan.posts.length); // some posts have none
  });

  it("has 600 unique likes, uneven: some posts with none, some with ten or more", () => {
    expect(plan.likes).toHaveLength(600);
    expect(new Set(plan.likes.map((l) => `${l.postId}:${l.userSlug}`)).size).toBe(600);
    const perPost = new Map<string, number>();
    for (const l of plan.likes) perPost.set(l.postId, (perPost.get(l.postId) ?? 0) + 1);
    expect(plan.posts.some((p) => !perPost.has(p.id))).toBe(true);
    expect(Math.max(...perPost.values())).toBeGreaterThanOrEqual(10);
    for (const l of plan.likes) expect(plan.posts.find((p) => p.id === l.postId)!.authorSlug).not.toBe(l.userSlug);
  });

  it("has no duplicate post or comment bodies", () => {
    for (const list of [plan.posts.map((p) => p.body), plan.comments.map((c) => c.body)]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("has no near-duplicate posts or comments (shared word trigrams)", () => {
    const worst = (texts: string[]) => {
      let max = 0;
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) max = Math.max(max, similarity(texts[i], texts[j]));
      }
      return max;
    };
    expect(worst(plan.posts.map((p) => p.body))).toBeLessThan(0.6);
    expect(worst(plan.comments.map((c) => c.body))).toBeLessThan(0.6);
  });

  it("contains no email addresses, phone numbers or links in any text", () => {
    const text = [
      ...plan.members.flatMap((m) => [m.bio, m.headline, m.journey, m.aspirations]),
      ...plan.posts.map((p) => p.body),
      ...plan.comments.map((c) => c.body),
    ].filter(Boolean) as string[];
    for (const t of text) {
      expect(t).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(t).not.toMatch(/\b\d{3}[-. ]\d{3}[-. ]\d{4}\b/);
      expect(t).not.toMatch(/https?:\/\/|www\./);
    }
  });

  it("writes natural Quebec French with correct accents and terms", () => {
    const fr = plan.posts.filter((p) => p.lang === "fr").map((p) => p.body).join(" ");
    for (const term of ["cégep", "stage", "baccalauréat", "maîtrise", "OIIQ"]) expect(fr.toLowerCase()).toContain(term.toLowerCase());
    expect(fr).not.toMatch(/\bcegep\b|\bmaitrise\b|\bbaccalaureat\b/i);
  });

  it("adjusts French agreement to the fictional author", () => {
    expect(agreeFrench("Je suis fière et fatiguée.", "m")).toBe("Je suis fier et fatigué.");
    expect(agreeFrench("Je suis fier et content.", "f")).toBe("Je suis fière et contente.");
    expect(agreeFrench("Bravo, tu peux en être fière. Je suis fière aussi.", "m", "f")).toBe("Bravo, tu peux en être fière. Je suis fier aussi.");
  });
});

describe("network rows", () => {
  it("has 40 connections (30 accepted, 10 pending) and 60 follows, all unique pairs", () => {
    expect(summary.connections).toBe(40);
    expect(summary.acceptedConnections).toBe(30);
    expect(summary.follows).toBe(60);
    expect(new Set(plan.connections.map((c) => [c.requesterSlug, c.addresseeSlug].sort().join("|"))).size).toBe(40);
    expect(new Set(plan.follows.map((f) => `${f.followerSlug}|${f.followeeSlug}`)).size).toBe(60);
  });

  it("only involves completed members", () => {
    const done = new Set(plan.members.filter((m) => m.complete).map((m) => m.slug));
    for (const c of plan.connections) expect(done.has(c.requesterSlug) && done.has(c.addresseeSlug)).toBe(true);
    for (const f of plan.follows) expect(done.has(f.followerSlug) && done.has(f.followeeSlug)).toBe(true);
  });
});

describe("corpora", () => {
  it("covers every theme in both languages with enough distinct sentences", () => {
    for (const corpus of [FR, EN]) {
      for (const theme of THEMES) {
        const t = corpus.themes[theme];
        for (const list of [t.s, t.d, t.c, t.q, t.r]) {
          expect(list.length).toBeGreaterThanOrEqual(3);
          expect(new Set(list).size).toBe(list.length);
        }
      }
    }
  });
});

describe("validation catches tampering", () => {
  it("reports constraint violations", () => {
    const broken = structuredClone(plan);
    broken.members[0].username = "Bad Name";
    broken.members[1].bio = "No marker here";
    broken.posts[0].body = "x".repeat(3001);
    broken.posts[1].category = "gossip";
    broken.likes.push({ ...broken.likes[0] });
    broken.comments[0].authorSlug = "chloe_dubois";
    broken.follows.push({ ...broken.follows[0] });
    const problems = validatePlan(broken, NOW);
    for (const pattern of [/username format/, /fictional-profile marker/, /body/, /category/, /duplicate/, /not a completed member/]) {
      expect(problems.some((p) => pattern.test(p))).toBe(true);
    }
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

  it("parses the keep list and recognises seed emails", () => {
    expect(parseKeepList(" A@x.com, b@y.com ,,")).toEqual(["a@x.com", "b@y.com"]);
    expect(parseKeepList(undefined)).toEqual([]);
    expect(isSeedEmail("seed+casey_ngu@example.com")).toBe(true);
    expect(isSeedEmail("shurid.biswas@gmail.com")).toBe(false);
    expect(isSeedEmail("seed+x@example.com.evil.io")).toBe(false);
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
