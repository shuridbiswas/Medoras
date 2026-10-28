// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";

let db = makeDb();

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));

const { getProfileByUsername, USERNAME_PATTERN } =
  await import("@/features/profile/queries");

beforeEach(() => {
  db = makeDb();
});

describe("getProfileByUsername (missing and malformed usernames)", () => {
  it.each([
    "",
    "ab",
    "has space",
    "UPPER-dash",
    "x".repeat(31),
    "a;drop table",
    "../etc",
    "%00",
    "émile",
  ])("returns null for %j without querying the database", async (username) => {
    expect(await getProfileByUsername(username)).toBeNull();
    expect(db.ops).toHaveLength(0);
  });

  it("returns null when the username does not exist or is hidden by row level security", async () => {
    db = makeDb(() => ({ data: null }));
    expect(await getProfileByUsername("nobody_here")).toBeNull();
    expect(db.ops).toHaveLength(1);
    expect(db.ops[0].filters).toEqual([["username", "nobody_here"]]);
  });

  it("normalizes case and loads education, experience and skills for an existing profile", async () => {
    db = makeDb((op) => {
      if (op.table === "profiles")
        return { data: { id: "u1", username: "amina_r" } };
      return { data: [] };
    });
    const result = await getProfileByUsername("  Amina_R ");
    expect(result?.profile.id).toBe("u1");
    expect(db.ops.map((o) => o.table).sort()).toEqual([
      "profile_education",
      "profile_experience",
      "profile_skills",
      "profiles",
    ]);
    expect(
      db.ops
        .filter((o) => o.table !== "profiles")
        .every((o) => o.filters[0][1] === "u1"),
    ).toBe(true);
  });

  it("uses the same pattern as the database constraint", () => {
    expect(USERNAME_PATTERN.test("amina_r")).toBe(true);
    expect(USERNAME_PATTERN.test("Amina")).toBe(false);
  });
});
