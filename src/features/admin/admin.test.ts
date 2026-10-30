// @vitest-environment node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const REPORT = "33333333-3333-4333-8333-333333333333";
const MEMBER = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let isAdmin = true;
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();
const order: string[] = [];

class NotFound extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    order.push("client");
    return { ...db.client, rpc: (...a: unknown[]) => (order.push("rpc"), rpc(...a)) };
  },
}));
vi.mock("@/lib/auth/session", () => ({
  requireAdmin: async () => {
    order.push("requireAdmin");
    if (!isAdmin) throw new NotFound();
    return { user: { id: ME }, profile: { id: ME } };
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/admin/actions");
const queries = await import("@/features/admin/queries");
const schemas = await import("@/features/admin/schemas");

const idle = { status: "idle" as const };

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  isAdmin = true;
  limit = { ok: true };
  order.length = 0;
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("admin-only access", () => {
  it("rejects a non-administrator from every action before touching the database", async () => {
    isAdmin = false;
    const form = makeFormData({ reportId: REPORT, decision: "dismiss" });
    for (const run of [
      () => actions.claimReport(REPORT),
      () => actions.moderateReport(idle, form),
      () => actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "suspended", message: "x" })),
      () => actions.decideAppeal(idle, makeFormData({ appealId: REPORT, decision: "upheld", note: "x" })),
      () => actions.executeDeletion(REPORT),
      () => actions.setRetention(idle, makeFormData({ key: "audit_logs", days: "10" })),
    ]) {
      await expect(run()).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(rpc).not.toHaveBeenCalled();
    expect(order.every((o) => o === "requireAdmin")).toBe(true);
  });

  it("checks the administrator first in every successful action", async () => {
    await actions.claimReport(REPORT);
    expect(order[0]).toBe("requireAdmin");
  });

  it("every admin page asks for an administrator (guard against a page forgetting)", () => {
    const root = path.resolve(import.meta.dirname, "../../app/admin");
    const pages: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry === "page.tsx" || entry === "layout.tsx") pages.push(full);
      }
    };
    walk(root);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    for (const file of pages) expect(readFileSync(file, "utf8"), file).toContain("requireAdmin()");
  });

  it("is protected by the proxy and never indexed", () => {
    const proxy = readFileSync(path.resolve(import.meta.dirname, "../../proxy.ts"), "utf8");
    expect(proxy).toContain('"/admin"');
    expect(proxy).toContain('"/admin/:path*"');
    for (const page of ["page.tsx", "reports/page.tsx", "users/page.tsx"]) {
      expect(readFileSync(path.resolve(import.meta.dirname, "../../app/admin", page), "utf8")).toContain("follow: false");
    }
  });
});

describe("moderateReport", () => {
  it("records a decision through the database function with the member message", async () => {
    const result = await actions.moderateReport(
      idle,
      makeFormData({ reportId: REPORT, decision: "remove_content", note: " internal ", memberMessage: " Removed because... " }),
    );
    expect(result).toEqual({ status: "success", message: "Decision recorded." });
    expect(rpc).toHaveBeenCalledWith("moderate_report", {
      p_report: REPORT,
      p_decision: "remove_content",
      p_note: "internal",
      p_member_message: "Removed because...",
    });
  });

  it("allows a dismissal without a message, but nothing else", async () => {
    expect((await actions.moderateReport(idle, makeFormData({ reportId: REPORT, decision: "dismiss" }))).status).toBe("success");
    for (const decision of ["warn", "remove_content", "suspend"]) {
      expect(await actions.moderateReport(idle, makeFormData({ reportId: REPORT, decision }))).toEqual({
        status: "error",
        message: "Write the message the member will see.",
      });
    }
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("rejects an unknown decision, a bad id and over-long text", async () => {
    for (const bad of [
      { reportId: REPORT, decision: "ban" },
      { reportId: "nope", decision: "dismiss" },
      { reportId: REPORT, decision: "warn", memberMessage: "x".repeat(1001) },
    ]) {
      expect((await actions.moderateReport(idle, makeFormData(bad))).status).toBe("error");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows staff the database's readable reasons and hides everything else", async () => {
    const run = () => actions.moderateReport(idle, makeFormData({ reportId: REPORT, decision: "dismiss" }));
    rpc.mockResolvedValue({ data: null, error: { message: "That report is not open." } });
    expect(await run()).toEqual({ status: "error", message: "That report is not open." });
    rpc.mockResolvedValue({ data: null, error: { message: "Not allowed" } });
    expect(await run()).toEqual({ status: "error", message: "You are not allowed to do that." });
    rpc.mockResolvedValue({ data: null, error: { message: "relation public.reports secret internal detail" } });
    expect(await run()).toEqual({ status: "error", message: "Something went wrong. Please try again." });
  });

  it("stops at the rate limit", async () => {
    limit = { ok: false, message: "Slow down." };
    expect(await actions.moderateReport(idle, makeFormData({ reportId: REPORT, decision: "dismiss" }))).toEqual({
      status: "error",
      message: "Slow down.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("other staff actions", () => {
  it("claims a report", async () => {
    expect(await actions.claimReport(REPORT)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("claim_report", { p_report: REPORT });
    expect(await actions.claimReport("nope")).toMatchObject({ ok: false });
  });

  it("suspends or restores a member and always requires a message for them", async () => {
    expect(
      await actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "suspended", reason: "spam", message: "You are suspended." })),
    ).toEqual({ status: "success", message: "Member suspended." });
    expect(rpc).toHaveBeenCalledWith("set_member_status", { p_member: MEMBER, p_status: "suspended", p_reason: "spam", p_message: "You are suspended." });
    expect(
      await actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "active", message: "Welcome back." })),
    ).toEqual({ status: "success", message: "Member restored." });
    expect((await actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "suspended", message: "  " }))).status).toBe("error");
    expect((await actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "banned", message: "x" }))).status).toBe("error");
  });

  it("passes on the refusal to suspend an administrator", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "That member cannot be suspended from here." } });
    expect(
      await actions.setMemberStatus(idle, makeFormData({ memberId: MEMBER, status: "suspended", message: "x" })),
    ).toEqual({ status: "error", message: "That member cannot be suspended from here." });
  });

  it("decides an appeal with a note", async () => {
    expect(await actions.decideAppeal(idle, makeFormData({ appealId: REPORT, decision: "overturned", note: "Our mistake." }))).toEqual({
      status: "success",
      message: "Appeal decided.",
    });
    expect(rpc).toHaveBeenCalledWith("decide_appeal", { p_appeal: REPORT, p_decision: "overturned", p_note: "Our mistake." });
    expect((await actions.decideAppeal(idle, makeFormData({ appealId: REPORT, decision: "upheld", note: "" }))).status).toBe("error");
  });

  it("carries out a deletion only through the database function", async () => {
    expect(await actions.executeDeletion(REPORT)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("admin_execute_deletion", { p_request: REPORT });
    rpc.mockResolvedValue({ data: null, error: { message: "The cooling-off period has not ended." } });
    expect(await actions.executeDeletion(REPORT)).toEqual({ ok: false, error: "The cooling-off period has not ended." });
  });

  it("changes retention only within sensible limits", async () => {
    expect((await actions.setRetention(idle, makeFormData({ key: "audit_logs", days: "900" }))).status).toBe("success");
    expect(rpc).toHaveBeenCalledWith("set_retention_days", { p_key: "audit_logs", p_days: 900 });
    for (const bad of [{ key: "audit_logs", days: "0" }, { key: "audit_logs", days: "99999" }, { key: "audit_logs", days: "1.5" }, { key: "nope", days: "5" }, { key: "audit_logs", days: "abc" }]) {
      expect((await actions.setRetention(idle, makeFormData(bad))).status).toBe("error");
    }
  });
});

describe("queries", () => {
  const filter = (op: { filters: [string, unknown][] }, column: string) => op.filters.find(([c]) => c === column)?.[1];

  it("filters the report queue by status and pages it", async () => {
    db = makeDb(() => ({ data: [], count: 0 }));
    await queries.listReports("open", 2);
    expect(filter(db.ops[0], "status")).toBe("open");
    expect(db.ops[0].filters).toContainEqual(["range", [20, 39]]);
    db = makeDb(() => ({ data: [], count: 0 }));
    await queries.listReports("resolved", 1);
    expect(filter(db.ops[0], "status")).toEqual(["actioned", "dismissed"]);
    db = makeDb(() => ({ data: [], count: 0 }));
    await queries.listReports("all", 1);
    expect(db.ops[0].filters.some(([c]) => c === "status")).toBe(false);
  });

  it("flags a failure to load the queue instead of showing it empty", async () => {
    db = makeDb(() => ({ error: { message: "boom" } }));
    expect(await queries.listReports("open", 1)).toEqual({ reports: [], total: 0, failed: true });
  });

  it("searches members by sanitised name terms and joins their status", async () => {
    db = makeDb((op) => {
      if (op.table === "profiles") return { data: [{ id: MEMBER, username: "sam", first_name: "Sam", last_name: "K", created_at: "2026-11-01", member_type: null }], count: 1 };
      if (op.table === "member_status") return { data: [{ user_id: MEMBER, status: "suspended", reason: "spam" }] };
      return undefined;
    });
    const result = await queries.searchUsers("sam%_ k", 1);
    expect(result.users[0]).toMatchObject({ id: MEMBER, status: "suspended", reason: "spam" });
    const ors = db.ops[0].filters.filter(([c]) => c === "or").map(([, v]) => String(v));
    expect(ors).toEqual([
      "username.ilike.%sam%,first_name.ilike.%sam%,last_name.ilike.%sam%",
      "username.ilike.%k%,first_name.ilike.%k%,last_name.ilike.%k%",
    ]);
  });

  it("treats members without a status row as active", async () => {
    db = makeDb((op) => (op.table === "profiles" ? { data: [{ id: MEMBER, username: "sam", first_name: "Sam", last_name: "K", created_at: "x", member_type: null }], count: 1 } : { data: [] }));
    expect((await queries.searchUsers(undefined, 1)).users[0].status).toBe("active");
  });

  it("summarises counts, falling back to zero on errors", async () => {
    db = makeDb(() => ({ count: 3 }));
    expect(await queries.getAdminSummary()).toEqual({ open: 3, reviewing: 3, appeals: 3, suspended: 3, deletions: 3 });
    db = makeDb(() => ({ error: { message: "boom" }, count: null }));
    expect(await queries.getAdminSummary()).toEqual({ open: 0, reviewing: 0, appeals: 0, suspended: 0, deletions: 0 });
  });

  it("names deleted members plainly", () => {
    expect(queries.personName(null)).toBe("Deleted member");
    expect(queries.personName({ first_name: "Sam", last_name: "K" })).toBe("Sam K");
  });
});

describe("schemas", () => {
  it("parses report filters, defaulting to the open queue", () => {
    expect(schemas.parseReportFilter("resolved")).toBe("resolved");
    expect(schemas.parseReportFilter("nope")).toBe("open");
    expect(schemas.parseReportFilter(undefined)).toBe("open");
  });
});
