// @vitest-environment node
//
// Emailed-code enforcement, suspension and administrator gates in the server-side access layer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
let user: { id: string; email_confirmed_at: string; last_sign_in_at?: string } | null;
let claims: { data: { claims: { session_id?: string } } | null; error: unknown };
let tables: Record<string, { data?: unknown; error?: unknown }>;
let configured = true;
let verified = false;
let verifiedCalls: [string, string][] = [];

const client = () => ({
  auth: {
    getUser: async () => ({ data: { user }, error: user ? null : { message: "no session" } }),
    getClaims: async () => claims,
  },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: null, error: null, ...(tables[table] ?? {}) }),
      }),
    }),
  }),
});

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});
class NotFound extends Error {
  constructor() {
    super("NEXT_NOT_FOUND");
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
  notFound: () => {
    throw new NotFound();
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client() }));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));
vi.mock("@/lib/auth/two-factor", () => ({
  isTwoFactorConfigured: () => configured,
  isVerified: async (u: string, s: string) => {
    verifiedCalls.push([u, s]);
    return verified;
  },
}));

const session = await import("@/lib/auth/session");

async function outcome(run: () => Promise<unknown>) {
  try {
    return { redirect: await redirectOf(run) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

beforeEach(() => {
  process.env.MFA_ENFORCEMENT = "required";
  configured = true;
  verified = false;
  verifiedCalls = [];
  user = { id: ME, email_confirmed_at: "2026-11-01T00:00:00Z", last_sign_in_at: new Date().toISOString() };
  claims = { data: { claims: { session_id: SESSION } }, error: null };
  tables = { profiles: { data: { id: ME, onboarding_completed: true, first_name: "Amina" } } };
});

describe("emailed-code enforcement (the default)", () => {
  it("sends a member who has not confirmed this sign-in to the code page, from every gate", async () => {
    expect(await redirectOf(() => session.requireUser())).toBe("/mfa/verify");
    expect(await redirectOf(() => session.requireMember())).toBe("/mfa/verify");
    expect(await redirectOf(() => session.requireOnboardingPending())).toBe("/mfa/verify");
  });

  it("checks the confirmation for this member and this sign-in session", async () => {
    await redirectOf(() => session.requireUser());
    expect(verifiedCalls).toEqual([[ME, SESSION]]);
  });

  it("lets a member who confirmed this sign-in through", async () => {
    verified = true;
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    expect((await session.requireMember()).user.id).toBe(ME);
  });

  it("lets the code page itself through", async () => {
    expect(await redirectOf(() => session.requireUser({ mfa: "skip" }))).toBeNull();
  });

  it("still checks sign-in and email first", async () => {
    user = null;
    expect(await redirectOf(() => session.requireUser())).toBe("/login");
    user = { id: ME, email_confirmed_at: "" as unknown as string };
    expect(await redirectOf(() => session.requireUser())).toBe("/login?error=verify_email");
    expect(verifiedCalls).toHaveLength(0);
  });

  it("fails closed when the sign-in session cannot be identified", async () => {
    claims = { data: { claims: {} }, error: null };
    expect((await outcome(() => session.requireUser())).error).toBe("two_factor_state_unavailable");
    claims = { data: null, error: { message: "boom" } };
    expect((await outcome(() => session.requireUser())).error).toBe("two_factor_state_unavailable");
  });
});

describe("when email codes are not set up, or switched off", () => {
  it("does not lock members out if the server has no secret or email delivery", async () => {
    configured = false;
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    expect((await session.requireMember()).user.id).toBe(ME);
    expect(verifiedCalls).toHaveLength(0);
  });

  it("is skipped entirely when MFA_ENFORCEMENT=off", async () => {
    process.env.MFA_ENFORCEMENT = "off";
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    expect(verifiedCalls).toHaveLength(0);
  });

  it("an unrecognised setting falls back to the strict default", async () => {
    process.env.MFA_ENFORCEMENT = "maybe";
    expect(await redirectOf(() => session.requireUser())).toBe("/mfa/verify");
  });
});

describe("suspension", () => {
  beforeEach(() => {
    process.env.MFA_ENFORCEMENT = "off";
  });

  it("sends a suspended member to /suspended, where they can read the notice and appeal", async () => {
    tables.member_status = { data: { status: "suspended" } };
    expect(await redirectOf(() => session.requireMember())).toBe("/suspended");
    expect((await session.requireMember({ allowSuspended: true })).user.id).toBe(ME);
  });

  it("treats active members, members without a status row and an unreadable status as active", async () => {
    tables.member_status = { data: { status: "active" } };
    expect(await redirectOf(() => session.requireMember())).toBeNull();
    tables.member_status = { data: null };
    expect(await redirectOf(() => session.requireMember())).toBeNull();
    tables.member_status = { error: { code: "42P01" } };
    expect(await redirectOf(() => session.requireMember())).toBeNull();
  });

  it("is checked after onboarding, so unfinished members go to /onboarding first", async () => {
    tables.profiles = { data: { id: ME, onboarding_completed: false } };
    tables.member_status = { data: { status: "suspended" } };
    expect(await redirectOf(() => session.requireMember())).toBe("/onboarding");
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    tables.staff_roles = { data: { role: "admin" } };
    verified = true;
  });

  it("returns a plain 404 to anyone who is not an administrator", async () => {
    tables.staff_roles = { data: null };
    expect((await outcome(() => session.requireAdmin())).error).toBe("NEXT_NOT_FOUND");
    tables.staff_roles = { data: { role: "moderator" } };
    expect((await outcome(() => session.requireAdmin())).error).toBe("NEXT_NOT_FOUND");
  });

  it("does not reveal the admin area to signed-out visitors", async () => {
    user = null;
    expect(await redirectOf(() => session.requireAdmin())).toBe("/login");
  });

  it("requires a confirmed sign-in even when MFA_ENFORCEMENT is off", async () => {
    process.env.MFA_ENFORCEMENT = "off";
    verified = false;
    expect(await redirectOf(() => session.requireAdmin())).toBe("/mfa/verify");
  });

  it("stays closed if email codes are not set up, instead of letting administrators in without them", async () => {
    configured = false;
    expect(await redirectOf(() => session.requireAdmin())).toBe("/settings/security?admin_2fa=unavailable");
  });

  it("lets an administrator who confirmed this sign-in in", async () => {
    expect((await session.requireAdmin()).user.id).toBe(ME);
  });

  it("does not let a suspended administrator in", async () => {
    tables.member_status = { data: { status: "suspended" } };
    expect(await redirectOf(() => session.requireAdmin())).toBe("/suspended");
  });
});

describe("recent authentication", () => {
  it("sends the member to /reauth (and back) when the sign-in is old or unknown", () => {
    const old = { last_sign_in_at: new Date(Date.now() - 3_600_000).toISOString() };
    expect(() => session.requireRecentAuth(old, "/settings/security")).toThrow("REDIRECT:/reauth?next=%2Fsettings%2Fsecurity");
    expect(() => session.requireRecentAuth({ last_sign_in_at: undefined }, "/x")).toThrow("REDIRECT:/reauth");
  });

  it("lets a recent sign-in through", () => {
    expect(() => session.requireRecentAuth({ last_sign_in_at: new Date().toISOString() }, "/x")).not.toThrow();
    expect(session.isRecentAuth({ last_sign_in_at: new Date().toISOString() })).toBe(true);
    expect(session.isRecentAuth({ last_sign_in_at: "2020-01-01T00:00:00Z" })).toBe(false);
  });
});
