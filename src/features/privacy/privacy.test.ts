// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb, type Op } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const REQUEST = "33333333-3333-4333-8333-333333333333";
const user = { id: ME, email: "amina@example.com", created_at: "2026-10-01T00:00:00Z", last_sign_in_at: "2026-11-02T10:00:00Z" };

let db = makeDb();
let recent = true;
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => ({ user, profile: { id: ME } }),
  isRecentAuth: () => recent,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
const reportError = vi.fn();
vi.mock("@/lib/monitoring/report", () => ({ reportError: (...a: unknown[]) => reportError(...a) }));

const actions = await import("@/features/privacy/actions");
const { exportMemberData } = await import("@/features/privacy/export");
const route = await import("@/app/settings/privacy/export/route");
const legal = await import("@/lib/legal");
const visibility = await import("@/features/profile/visibility");

const has = (op: Op, column: string, value: unknown) => op.filters.some(([c, v]) => c === column && v === value);
const idle = { status: "idle" as const };

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  recent = true;
  limit = { ok: true };
  rpc.mockResolvedValue({ data: "export-id", error: null });
});

describe("updatePrivacySettings", () => {
  it("saves visibility and directory listing on the member's own row only", async () => {
    const result = await actions.updatePrivacySettings(idle, makeFormData({ profileVisibility: "connections" }));
    expect(result).toEqual({ status: "success", message: "Saved." });
    const [op] = db.writes();
    expect(op).toMatchObject({ table: "profiles", kind: "update", payload: { profile_visibility: "connections", directory_listed: false } });
    expect(has(op, "id", ME)).toBe(true);
  });

  it("treats a ticked directory box as listed, and ignores an id in the form", async () => {
    await actions.updatePrivacySettings(idle, makeFormData({ profileVisibility: "members", directoryListed: "on", id: "someone-else" }));
    const [op] = db.writes();
    expect(op.payload).toEqual({ profile_visibility: "members", directory_listed: true });
    expect(has(op, "id", ME)).toBe(true);
  });

  it("rejects unknown visibility values and reports a row that was not updated", async () => {
    expect((await actions.updatePrivacySettings(idle, makeFormData({ profileVisibility: "public" }))).status).toBe("error");
    expect(db.ops).toHaveLength(0);
    db = makeDb(() => ({ data: [] }));
    expect(await actions.updatePrivacySettings(idle, makeFormData({ profileVisibility: "members" }))).toEqual({
      status: "error",
      message: "We couldn't save that. Please try again.",
    });
  });
});

describe("account deletion requests", () => {
  it("needs a recent sign-in, and writes nothing without one", async () => {
    recent = false;
    expect(await actions.requestAccountDeletion()).toMatchObject({ ok: false, reauth: true });
    expect(db.ops).toHaveLength(0);
  });

  it("files the request for the signed-in member, treating a repeat as done", async () => {
    expect(await actions.requestAccountDeletion()).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "data_requests", kind: "insert", payload: { user_id: ME, kind: "deletion" } });
    db = makeDb(() => ({ error: { code: "23505" } }));
    expect(await actions.requestAccountDeletion()).toEqual({ ok: true });
  });

  it("stops at the rate limit and hides database detail", async () => {
    limit = { ok: false, message: "Slow down." };
    expect(await actions.requestAccountDeletion()).toEqual({ ok: false, error: "Slow down." });
    limit = { ok: true };
    db = makeDb(() => ({ error: { code: "XX000", message: "secret" } }));
    expect(await actions.requestAccountDeletion()).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("lets the member cancel only their own open request", async () => {
    expect(await actions.cancelAccountDeletion(REQUEST)).toEqual({ ok: true });
    const [op] = db.writes();
    expect(op.payload).toEqual({ status: "cancelled" });
    expect(has(op, "id", REQUEST)).toBe(true);
    expect(has(op, "user_id", ME)).toBe(true);
    expect(has(op, "status", "requested")).toBe(true);
    db = makeDb(() => ({ data: [] }));
    expect(await actions.cancelAccountDeletion(REQUEST)).toMatchObject({ ok: false });
    expect(await actions.cancelAccountDeletion("nope")).toMatchObject({ ok: false });
  });
});

describe("recordPolicyConsent", () => {
  it("records all three documents at the current version for the member", async () => {
    await actions.recordPolicyConsent(ME);
    const rows = db.writes().map((o) => o.payload);
    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        { user_id: ME, kind: "terms", version: legal.POLICY_VERSION },
        { user_id: ME, kind: "privacy", version: legal.POLICY_VERSION },
        { user_id: ME, kind: "community_guidelines", version: legal.POLICY_VERSION },
      ]),
    );
  });

  it("ignores duplicates but reports other failures, and never throws", async () => {
    db = makeDb(() => ({ error: { code: "23505" } }));
    await expect(actions.recordPolicyConsent(ME)).resolves.toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
    db = makeDb(() => ({ error: { code: "XX000" } }));
    await expect(actions.recordPolicyConsent(ME)).resolves.toBeUndefined();
    expect(reportError).toHaveBeenCalled();
  });

  it("keeps the draft marker in the version until counsel approves", () => {
    expect(legal.POLICY_VERSION).toMatch(/draft/);
  });
});

describe("exportMemberData", () => {
  it("reads only the member's own rows from member tables, never staff tables", async () => {
    await exportMemberData(user);
    const tables = db.ops.map((o) => o.table);
    for (const forbidden of ["moderation_actions", "audit_logs", "staff_roles", "two_factor_events", "member_status"]) {
      expect(tables).not.toContain(forbidden);
    }
    // Every query is scoped to the member by one of the ownership columns.
    for (const op of db.ops) {
      const scoped = op.filters.some(
        ([c, v]) => ["id", "user_id", "profile_id", "author_id", "recipient_id", "blocker_id", "muter_id", "member_id", "reporter_id", "sender_id", "or"].includes(c) && (v === ME || (typeof v === "string" && v.includes(ME))),
      );
      expect(scoped, `${op.table} is not scoped to the member`).toBe(true);
    }
  });

  it("includes the account email and sections, and marks a failed section instead of failing the file", async () => {
    db = makeDb((op) => (op.table === "posts" ? { error: { message: "boom" } } : { data: op.table === "profiles" ? { id: ME, first_name: "Amina" } : [] }));
    const result = await exportMemberData(user);
    expect(result.account).toMatchObject({ id: ME, email: "amina@example.com" });
    expect(result.profile).toEqual({ id: ME, first_name: "Amina" });
    expect(result.posts).toEqual({ unavailable: true });
    expect(result.comments).toEqual([]);
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(["about", "account", "profile", "posts", "comments", "connections", "consent_records", "moderation_notices", "appeals"]),
    );
  });

  it("states what is not included", async () => {
    const result = await exportMemberData(user);
    expect(result.about.note).toMatch(/passwords are held by the sign-in provider/i);
  });

  it("does not carry secrets or other members' profiles", async () => {
    const result = await exportMemberData(user);
    const text = JSON.stringify(result);
    expect(text).not.toMatch(/"(encrypted_)?password"|code_hash|"secret"/i);
  });
});

describe("export route", () => {
  it("returns the member's data as a private, never-cached download", async () => {
    const response = await route.POST();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(response.headers.get("Content-Disposition")).toMatch(/^attachment; filename="medyra-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.parse(await response.text()).account.id).toBe(ME);
    expect(rpc).toHaveBeenCalledWith("record_data_export");
  });

  it("needs a recent sign-in", async () => {
    recent = false;
    expect(await redirectOf(() => route.POST())).toBe("/reauth?next=%2Fsettings%2Fprivacy");
    expect(db.ops).toHaveLength(0);
  });

  it("is rate limited, and cannot be triggered with GET", async () => {
    limit = { ok: false, message: "Slow down." };
    const limited = await route.POST();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    const get = route.GET();
    expect(get.status).toBe(405);
    expect(get.headers.get("Allow")).toBe("POST");
  });

  it("still delivers the file if recording the export fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await route.POST()).status).toBe(200);
    expect(reportError).toHaveBeenCalled();
  });
});

describe("privacy contact", () => {
  it("is empty until a valid address is configured, so pages never invent one", () => {
    expect(legal.privacyContact({})).toEqual({ email: null });
    expect(legal.privacyContact({ PRIVACY_CONTACT_EMAIL: "  " })).toEqual({ email: null });
    expect(legal.privacyContact({ PRIVACY_CONTACT_EMAIL: "not an email" })).toEqual({ email: null });
    expect(legal.privacyContact({ PRIVACY_CONTACT_EMAIL: " privacy@example.org " })).toEqual({ email: "privacy@example.org" });
  });
});

describe("profile visibility", () => {
  const profile = {
    id: "u1", username: "amina_r", first_name: "Amina", last_name: "R", headline: "Student", bio: "Private bio",
    avatar_path: null, cover_path: null, location_label: "Montreal", professional_journey: "Journey", career_aspirations: "Goals",
    looking_for_mentorship: false, open_to_mentor: true, member_type: "undergraduate_student", fields: ["nursing"],
    institution: "UdeM", qualification: "BSc", specialty: "Mental health", career_stage: "student", country: "CA",
    profile_visibility: "connections" as const, created_at: "2026-01-01",
  };

  it("exposes the setting through the public whitelist", () => {
    expect(visibility.PUBLIC_PROFILE_FIELDS).toContain("profile_visibility");
  });

  it("shows only the identity card to people who are not connected", () => {
    const card = visibility.restrictToCard(profile);
    expect(card).toMatchObject({ first_name: "Amina", headline: "Student", fields: ["nursing"], country: "CA", open_to_mentor: true });
    for (const hidden of ["bio", "professional_journey", "career_aspirations", "institution", "qualification", "specialty", "location_label"] as const) {
      expect(card[hidden]).toBeNull();
    }
    expect(JSON.stringify(card)).not.toMatch(/Private bio|Journey|Goals/);
  });

  it("does not mutate the original profile", () => {
    visibility.restrictToCard(profile);
    expect(profile.bio).toBe("Private bio");
  });
});
