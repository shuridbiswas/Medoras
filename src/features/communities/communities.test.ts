// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";
const R = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => ({ user: { id: ME }, profile: { id: ME } }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/communities/actions");
const schemas = await import("@/features/communities/schemas");
const queries = await import("@/features/communities/queries");
const idle = { status: "idle" as const };

const form = (over: Record<string, string | undefined> = {}) =>
  makeFormData({
    name: "Nursing educators",
    description: "A place for people who teach nursing students.",
    kind: "profession",
    visibility: "private",
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  limit = { ok: true };
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("slugs and filters", () => {
  it("builds readable, URL-safe addresses", () => {
    expect(schemas.slugify("Nursing Educators")).toBe("nursing-educators");
    expect(schemas.slugify("  École de santé publique – Québec! ")).toBe("ecole-de-sante-publique-quebec");
    expect(schemas.slugify("AB")).toBe("ab-community");
    expect(schemas.slugify("x".repeat(100)).length).toBeLessThanOrEqual(40);
    expect(schemas.slugify("Nursing Educators")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("drops unknown directory filters instead of failing", () => {
    expect(schemas.parseDirectoryParams({ q: "nurs%e,(x)", kind: "cult", visibility: "secret", scope: "everything", page: "abc" })).toEqual({
      q: "nurs e x",
      kind: undefined,
      visibility: undefined,
      scope: "all",
      page: 1,
    });
    expect(schemas.parseDirectoryParams({ kind: "research", visibility: "private", scope: "mine", page: "4" })).toMatchObject({
      kind: "research",
      visibility: "private",
      scope: "mine",
      page: 4,
    });
  });
});

describe("createCommunity", () => {
  it("creates it as the signed-in member and goes to its page", async () => {
    const target = await redirectOf(() => actions.createCommunity(idle, form({ institution: "Mercy College", country: "ca" })));
    expect(target).toBe("/communities/nursing-educators");
    expect(db.writes()[0]).toMatchObject({
      table: "communities",
      kind: "insert",
      payload: {
        slug: "nursing-educators",
        visibility: "private",
        institution: "Mercy College",
        country: "CA",
        created_by: ME,
      },
    });
  });

  it("never takes the creator from the form", async () => {
    await redirectOf(() => actions.createCommunity(idle, form({ created_by: OTHER, createdBy: OTHER })));
    expect((db.writes()[0].payload as { created_by: string }).created_by).toBe(ME);
  });

  it("returns field errors for bad input and a limit message when the database says slow down", async () => {
    const bad = await actions.createCommunity(idle, form({ name: "ab", description: "short", kind: "cult", country: "ZZ" }));
    expect(bad.status).toBe("error");
    expect(Object.keys(bad.fieldErrors ?? {}).sort()).toEqual(["country", "description", "kind", "name"]);
    expect(db.writes()).toHaveLength(0);

    db = makeDb(() => ({ error: { code: "23514", message: "You are creating communities too quickly. Please try again tomorrow." } }));
    expect(await actions.createCommunity(idle, form())).toEqual({
      status: "error",
      message: "You are creating communities too quickly. Please try again tomorrow.",
    });
    limit = { ok: false, message: "Slow down." };
    expect(await actions.createCommunity(idle, form())).toEqual({ status: "error", message: "Slow down." });
  });

  it("tries a distinct address when the name is taken", async () => {
    let attempts = 0;
    db = makeDb((op) => (op.kind === "insert" && attempts++ === 0 ? { error: { code: "23505", message: "duplicate" } } : undefined));
    const target = await redirectOf(() => actions.createCommunity(idle, form()));
    expect(target).toMatch(/^\/communities\/nursing-educators-[0-9a-f]{4}$/);
    expect(db.writes()).toHaveLength(2);
  });
});

describe("membership", () => {
  it("joins as the signed-in member, treating a repeat as success and hiding why a join is refused", async () => {
    expect(await actions.joinCommunity(C)).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "community_members", payload: { community_id: C, user_id: ME } });
    db = makeDb(() => ({ error: { code: "23505", message: "dup" } }));
    expect(await actions.joinCommunity(C)).toEqual({ ok: true });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.joinCommunity(C)).toEqual({ ok: false, error: "You can't join this community." });
    expect(await actions.joinCommunity("nope")).toMatchObject({ ok: false });
  });

  it("leaves, and tells the owner they cannot", async () => {
    expect(await actions.leaveCommunity(C)).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "community_members", kind: "delete" });
    expect(db.writes()[0].filters).toEqual(expect.arrayContaining([["user_id", ME]]));
    db = makeDb(() => ({ data: [] }));
    expect(await actions.leaveCommunity(C)).toEqual({ ok: false, error: "The owner can't leave a community." });
  });

  it("asks to join with a trimmed message and withdraws only its own pending request", async () => {
    expect(await actions.requestToJoin(C, "  I teach there  ")).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "community_requests", payload: { community_id: C, user_id: ME, message: "I teach there" } });
    expect(await actions.requestToJoin(C, "x".repeat(501))).toMatchObject({ ok: false });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.requestToJoin(C, "")).toEqual({ ok: false, error: "You can't ask to join this community." });

    db = makeDb();
    await actions.withdrawRequest(C);
    expect(db.writes()[0].filters).toEqual(expect.arrayContaining([["user_id", ME], ["status", "pending"]]));
  });
});

describe("moderation actions go through the audited database functions", () => {
  it("decides requests, changes roles and removes members and posts with validated arguments", async () => {
    expect(await actions.decideRequest(R, true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("decide_join_request", { p_request: R, p_approve: true });

    expect(await actions.setMemberRole(C, OTHER, "moderator")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("set_community_role", { p_community: C, p_user: OTHER, p_role: "moderator" });
    expect(await actions.setMemberRole(C, OTHER, "owner")).toMatchObject({ ok: false });

    expect(await actions.setMemberBan(C, OTHER, true, "spam")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("community_set_ban", { p_community: C, p_user: OTHER, p_banned: true, p_reason: "spam" });
    expect(await actions.setMemberBan(C, OTHER, true, "because")).toMatchObject({ ok: false });

    expect(await actions.removeCommunityPost(R, "off_topic")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("community_remove_post", { p_post: R, p_reason: "off_topic" });
    expect(await actions.removeCommunityPost(R, "")).toMatchObject({ ok: false });
    // The acting moderator is never an argument; the database reads it from the session.
    for (const call of rpc.mock.calls) expect(JSON.stringify(call[1])).not.toContain(ME);
  });

  it("reports a refusal from the database without saying why", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Not allowed" } });
    expect(await actions.decideRequest(R, true)).toEqual({ ok: false, error: "You don't have permission to do that." });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "That request is no longer open." } });
    expect(await actions.decideRequest(R, false)).toEqual({ ok: false, error: "That request is no longer open." });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "relation secret missing" } });
    expect(await actions.decideRequest(R, false)).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    limit = { ok: false, message: "Slow down." };
    expect(await actions.decideRequest(R, true)).toEqual({ ok: false, error: "Slow down." });
  });

  it("updates settings only when a row changed, and publishes announcements as the member", async () => {
    expect(await actions.updateCommunity(idle, form({ communityId: C }))).toMatchObject({ status: "success" });
    expect(db.writes()[0]).toMatchObject({ table: "communities", kind: "update" });
    expect((db.writes()[0].payload as Record<string, unknown>).slug).toBeUndefined();
    expect((db.writes()[0].payload as Record<string, unknown>).created_by).toBeUndefined();

    db = makeDb(() => ({ data: [] }));
    expect(await actions.updateCommunity(idle, form({ communityId: C }))).toEqual({
      status: "error",
      message: "Only the owner can change these settings.",
    });

    db = makeDb();
    expect(await actions.createAnnouncement(idle, makeFormData({ communityId: C, title: "Meeting", body: "Friday at noon" }))).toMatchObject({ status: "success" });
    expect(db.writes()[0]).toMatchObject({ table: "community_announcements", payload: { community_id: C, author_id: ME, title: "Meeting", body: "Friday at noon" } });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.createAnnouncement(idle, makeFormData({ communityId: C, title: "Meeting", body: "x" }))).toEqual({
      status: "error",
      message: "Only moderators can post announcements.",
    });
    db = makeDb(() => ({ data: [] }));
    expect(await actions.deleteAnnouncement(R)).toEqual({ ok: false, error: "You don't have permission to do that." });
  });
});

describe("reading communities", () => {
  const row = {
    id: C,
    slug: "nursing-educators",
    name: "Nursing educators",
    description: "A place for people who teach nursing students.",
    kind: "profession",
    visibility: "private",
    institution: null,
    region_label: null,
    country: null,
    created_at: "2026-11-03T10:00:00Z",
    members: [{ count: 12 }],
    rules: "Be kind.",
    created_by: OTHER,
  };

  it("hides the member count of a private community from outsiders and shows the viewer's own state", async () => {
    db = makeDb((op) => (op.table === "communities" ? { data: row } : op.table === "community_requests" ? { data: [{ community_id: C }] } : undefined));
    const outsider = await queries.getCommunityBySlug(ME, "nursing-educators");
    expect(outsider).toMatchObject({ memberCount: null, role: null, requestPending: true, rules: "Be kind." });

    db = makeDb((op) => (op.table === "communities" ? { data: row } : op.table === "community_members" ? { data: [{ community_id: C, role: "moderator" }] } : undefined));
    expect(await queries.getCommunityBySlug(ME, "nursing-educators")).toMatchObject({ memberCount: 12, role: "moderator" });

    db = makeDb(() => ({ data: null }));
    expect(await queries.getCommunityBySlug(ME, "nope")).toBeNull();
  });

  it("limits a 'mine' list to the viewer's own memberships and returns nothing when there are none", async () => {
    db = makeDb((op) => (op.table === "community_members" && op.filters.some(([k]) => k === "user_id") ? { data: [] } : undefined));
    expect(await queries.listCommunities(ME, { q: "", scope: "mine", page: 1 })).toEqual({ items: [], total: 0 });

    db = makeDb((op) => {
      if (op.table === "community_members" && op.filters.length === 1) return { data: [{ community_id: C }] };
      if (op.table === "communities") return { data: [row], count: 1 };
      return undefined;
    });
    const mine = await queries.listCommunities(ME, { q: "nurs", scope: "mine", page: 1 });
    expect(mine.total).toBe(1);
    const filters = db.ops.find((o) => o.table === "communities")!.filters;
    expect(filters).toContainEqual(["id", [C]]);
    expect(filters.find(([k]) => k === "or")?.[1]).toBe("name.ilike.%nurs%,description.ilike.%nurs%,institution.ilike.%nurs%");
  });
});
