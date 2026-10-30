// @vitest-environment node
//
// MFA enforcement, suspension and administrator gates in the server-side access layer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirectMock, redirectOf } from "@/test/mocks";

type Aal = { data: { currentLevel: string; nextLevel: string } | null; error: unknown };

const ME = "11111111-1111-4111-8111-111111111111";
let user: { id: string; email_confirmed_at: string; last_sign_in_at?: string } | null;
let aal: Aal;
let tables: Record<string, { data?: unknown; error?: unknown }>;
let aalCalls = 0;

const client = () => ({
  auth: {
    getUser: async () => ({ data: { user }, error: user ? null : { message: "no session" } }),
    mfa: {
      getAuthenticatorAssuranceLevel: async () => {
        aalCalls++;
        return aal;
      },
    },
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

const session = await import("@/lib/auth/session");

const setAal = (currentLevel: string, nextLevel: string) => {
  aal = { data: { currentLevel, nextLevel }, error: null };
};
const NOT_ENROLLED = () => setAal("aal1", "aal1");
const ENROLLED_CHALLENGE_PENDING = () => setAal("aal1", "aal2");
const ENROLLED_PASSED = () => setAal("aal2", "aal2");

async function outcome(run: () => Promise<unknown>) {
  try {
    return { redirect: await redirectOf(run) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

beforeEach(() => {
  process.env.MFA_ENFORCEMENT = "required";
  aalCalls = 0;
  user = { id: ME, email_confirmed_at: "2026-11-01T00:00:00Z", last_sign_in_at: new Date().toISOString() };
  tables = { profiles: { data: { id: ME, onboarding_completed: true, first_name: "Amina" } } };
  NOT_ENROLLED();
});

describe("MFA enforcement (MFA_ENFORCEMENT=required, the default)", () => {
  it("sends a member without an authenticator to the setup page, from every gate", async () => {
    expect(await redirectOf(() => session.requireUser())).toBe("/settings/security?setup=1");
    expect(await redirectOf(() => session.requireMember())).toBe("/settings/security?setup=1");
    expect(await redirectOf(() => session.requireOnboardingPending())).toBe("/settings/security?setup=1");
  });

  it("lets the setup page itself through, so nobody is locked out of enrolling", async () => {
    expect(await redirectOf(() => session.requireUser({ mfa: "allow-enrollment" }))).toBeNull();
    const { profile } = await session.requireMember({ mfa: "allow-enrollment" });
    expect(profile.first_name).toBe("Amina");
  });

  it("asks an enrolled member who has not yet proven the second factor for their code", async () => {
    ENROLLED_CHALLENGE_PENDING();
    expect(await redirectOf(() => session.requireUser())).toBe("/mfa/verify");
    expect(await redirectOf(() => session.requireMember())).toBe("/mfa/verify");
    // Even the enrollment page must not be reachable without the second factor.
    expect(await redirectOf(() => session.requireUser({ mfa: "allow-enrollment" }))).toBe("/mfa/verify");
  });

  it("lets the challenge page itself through", async () => {
    ENROLLED_CHALLENGE_PENDING();
    expect(await redirectOf(() => session.requireUser({ mfa: "skip" }))).toBeNull();
  });

  it("lets an enrolled member who passed the second factor in", async () => {
    ENROLLED_PASSED();
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    expect((await session.requireMember()).user.id).toBe(ME);
  });

  it("still checks sign-in and email first", async () => {
    user = null;
    expect(await redirectOf(() => session.requireUser())).toBe("/login");
    user = { id: ME, email_confirmed_at: "" as unknown as string };
    expect(await redirectOf(() => session.requireUser())).toBe("/login?error=verify_email");
    expect(aalCalls).toBe(0);
  });

  it("fails closed when the assurance level cannot be read", async () => {
    aal = { data: null, error: { message: "boom" } };
    expect((await outcome(() => session.requireUser())).error).toBe("mfa_state_unavailable");
  });
});

describe("other enforcement levels", () => {
  it("challenge: enrolled members are challenged, nobody is forced to enroll", async () => {
    process.env.MFA_ENFORCEMENT = "challenge";
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    ENROLLED_CHALLENGE_PENDING();
    expect(await redirectOf(() => session.requireUser())).toBe("/mfa/verify");
  });

  it("off: nothing is enforced and Supabase is not even asked", async () => {
    process.env.MFA_ENFORCEMENT = "off";
    ENROLLED_CHALLENGE_PENDING();
    expect(await redirectOf(() => session.requireUser())).toBeNull();
    expect(aalCalls).toBe(0);
  });

  it("an unrecognised setting falls back to the strict default", async () => {
    process.env.MFA_ENFORCEMENT = "maybe";
    expect(await redirectOf(() => session.requireUser())).toBe("/settings/security?setup=1");
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
  });

  it("returns a plain 404 to anyone who is not an administrator", async () => {
    tables.staff_roles = { data: null };
    ENROLLED_PASSED();
    expect((await outcome(() => session.requireAdmin())).error).toBe("NEXT_NOT_FOUND");
    tables.staff_roles = { data: { role: "moderator" } };
    expect((await outcome(() => session.requireAdmin())).error).toBe("NEXT_NOT_FOUND");
  });

  it("does not reveal the admin area to signed-out visitors", async () => {
    user = null;
    expect(await redirectOf(() => session.requireAdmin())).toBe("/login");
  });

  it("requires a second factor even when MFA_ENFORCEMENT is off", async () => {
    process.env.MFA_ENFORCEMENT = "off";
    NOT_ENROLLED();
    expect(await redirectOf(() => session.requireAdmin())).toBe("/settings/security?setup=1");
    ENROLLED_CHALLENGE_PENDING();
    expect(await redirectOf(() => session.requireAdmin())).toBe("/mfa/verify");
  });

  it("lets an administrator who passed the second factor in", async () => {
    ENROLLED_PASSED();
    expect((await session.requireAdmin()).user.id).toBe(ME);
  });

  it("does not let a suspended administrator in", async () => {
    ENROLLED_PASSED();
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
