// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const POST = "33333333-3333-4333-8333-333333333333";
const NOTICE = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let signedIn = true;
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();
const memberOptions: unknown[] = [];

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async (options?: unknown) => {
    memberOptions.push(options);
    if (!signedIn) redirectMock("/login");
    return { user: { id: ME }, profile: { id: ME } };
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/safety/actions");
const queries = await import("@/features/safety/queries");

const valid = { targetType: "post", targetId: POST, reason: "harassment", details: "  Mean to a student  " };

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  signedIn = true;
  limit = { ok: true };
  memberOptions.length = 0;
  rpc.mockResolvedValue({ data: "report-id", error: null });
});

describe("submitReport", () => {
  it("files the report through the database function, as the signed-in member", async () => {
    expect(await actions.submitReport(valid)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("submit_report", {
      p_target_type: "post",
      p_target_id: POST,
      p_reason: "harassment",
      p_details: "Mean to a student",
    });
    // The reporter is never part of the payload: the database takes it from the session.
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain(ME);
  });

  it("sends empty details as null", async () => {
    await actions.submitReport({ ...valid, details: "   " });
    expect(rpc.mock.calls[0][1].p_details).toBeNull();
  });

  it("rejects unknown targets, reasons, bad ids and over-long details without calling the database", async () => {
    for (const bad of [
      { ...valid, targetType: "message" },
      { ...valid, reason: "dislike" },
      { ...valid, targetId: "nope" },
      { ...valid, details: "x".repeat(1001) },
      {},
      null,
    ]) {
      expect(await actions.submitReport(bad)).toMatchObject({ ok: false });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("treats a repeat of a report still under review as done", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
    expect(await actions.submitReport(valid)).toEqual({ ok: true });
  });

  it("explains the cases a member can fix and hides everything else", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "You cannot report your own content." } });
    expect(await actions.submitReport(valid)).toEqual({ ok: false, error: "You can't report your own content." });
    rpc.mockResolvedValue({ data: null, error: { code: "P0002", message: "That content is no longer available." } });
    expect(await actions.submitReport(valid)).toEqual({ ok: false, error: "That content is no longer available." });
    rpc.mockResolvedValue({ data: null, error: { code: "23514", message: "You are sending reports too quickly. Please try again later." } });
    expect(await actions.submitReport(valid)).toEqual({ ok: false, error: "You are sending reports too quickly. Please try again later." });
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "relation reports secret detail" } });
    expect(await actions.submitReport(valid)).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("stops at the app rate limit and sends signed-out visitors to login", async () => {
    limit = { ok: false, message: "Slow down." };
    expect(await actions.submitReport(valid)).toEqual({ ok: false, error: "Slow down." });
    expect(rpc).not.toHaveBeenCalled();
    limit = { ok: true };
    signedIn = false;
    expect(await redirectOf(() => actions.submitReport(valid))).toBe("/login");
  });
});

describe("setMute", () => {
  it("mutes as the signed-in member, idempotently", async () => {
    expect(await actions.setMute(OTHER, true)).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "member_mutes", kind: "insert", payload: { muter_id: ME, muted_id: OTHER } });
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await actions.setMute(OTHER, true)).toEqual({ ok: true });
  });

  it("unmutes only the member's own mute", async () => {
    await actions.setMute(OTHER, false);
    const [op] = db.writes();
    expect(op.kind).toBe("delete");
    expect(op.filters).toContainEqual(["muter_id", ME]);
    expect(op.filters).toContainEqual(["muted_id", OTHER]);
  });

  it("refuses to mute oneself or a malformed id, and reports failures plainly", async () => {
    expect(await actions.setMute(ME, true)).toEqual({ ok: false, error: "You can't mute yourself." });
    expect(await actions.setMute("nope", true)).toMatchObject({ ok: false });
    expect(db.ops).toHaveLength(0);
    db = makeDb(() => ({ error: { code: "XX000", message: "secret" } }));
    expect(await actions.setMute(OTHER, true)).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });
});

describe("submitAppeal", () => {
  const form = (over: Record<string, string> = {}) => makeFormData({ noticeId: NOTICE, message: "  I disagree because...  ", ...over });

  it("files the appeal for the signed-in member, and a suspended member is allowed to", async () => {
    const result = await actions.submitAppeal({ status: "idle" }, form());
    expect(result.status).toBe("success");
    expect(db.writes()[0]).toMatchObject({
      table: "appeals",
      kind: "insert",
      payload: { notice_id: NOTICE, member_id: ME, message: "I disagree because..." },
    });
    expect(memberOptions[0]).toEqual({ allowSuspended: true });
  });

  it("ignores a member id in the form", async () => {
    await actions.submitAppeal({ status: "idle" }, form({ member_id: OTHER, memberId: OTHER }));
    expect((db.writes()[0].payload as { member_id: string }).member_id).toBe(ME);
  });

  it("validates the message and the notice id", async () => {
    expect(await actions.submitAppeal({ status: "idle" }, form({ message: "   " }))).toMatchObject({ status: "error" });
    expect(await actions.submitAppeal({ status: "idle" }, form({ message: "x".repeat(2001) }))).toMatchObject({ status: "error" });
    expect(await actions.submitAppeal({ status: "idle" }, form({ noticeId: "nope" }))).toMatchObject({ status: "error" });
    expect(db.ops).toHaveLength(0);
  });

  it("explains a second appeal or an appeal of someone else's notice", async () => {
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await actions.submitAppeal({ status: "idle" }, form())).toEqual({ status: "error", message: "You have already appealed this decision." });
    db = makeDb(() => ({ error: { code: "42501" } }));
    expect(await actions.submitAppeal({ status: "idle" }, form())).toEqual({ status: "error", message: "That decision can't be appealed." });
    db = makeDb(() => ({ error: { code: "XX000", message: "secret" } }));
    expect(await actions.submitAppeal({ status: "idle" }, form())).toEqual({ status: "error", message: "Something went wrong. Please try again." });
  });
});

describe("queries", () => {
  it("combines blocked and muted members once each", async () => {
    db = makeDb((op) => {
      if (op.table === "member_blocks") return { data: [{ blocked_id: OTHER }] };
      if (op.table === "member_mutes") return { data: [{ muted_id: OTHER }, { muted_id: POST }] };
      return undefined;
    });
    expect((await queries.getHiddenAuthorIds(ME)).sort()).toEqual([OTHER, POST].sort());
    const blocks = db.ops.find((o) => o.table === "member_blocks")!;
    expect(blocks.filters).toContainEqual(["blocker_id", ME]);
  });

  it("returns nothing hidden when the lookups fail, so the feed still loads", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await queries.getHiddenAuthorIds(ME)).toEqual([]);
  });

  it("pairs each notice with the member's appeal, if any, and shows no internal notes", async () => {
    db = makeDb((op) => {
      if (op.table === "member_notices")
        return {
          data: [
            { id: "n1", member_id: ME, kind: "warning", message: "Please be kind.", created_at: "2026-11-02T10:00:00Z" },
            { id: "n2", member_id: ME, kind: "suspended", message: "Suspended.", created_at: "2026-11-01T10:00:00Z" },
          ],
        };
      if (op.table === "appeals") return { data: [{ notice_id: "n2", status: "open", decision_note: null }] };
      return undefined;
    });
    const notices = await queries.listMyNotices(ME);
    expect(notices.map((n) => [n.id, n.appeal?.status ?? null])).toEqual([["n1", null], ["n2", "open"]]);
    expect(JSON.stringify(notices)).not.toMatch(/moderator|internal/i);
    expect(db.ops.map((o) => o.table)).not.toContain("moderation_actions");
  });

  it("returns no notices on a read failure instead of an error page", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await queries.listMyNotices(ME)).toEqual([]);
  });
});
