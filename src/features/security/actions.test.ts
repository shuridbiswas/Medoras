// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const user = { id: ME, email: "amina.rahman@example.com", user_metadata: { first_name: "Amina" } };

let db = makeDb();
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
let configured = true;
let sessionId: string | null = SESSION;
let sendStatus: "sent" | "skipped" | "failed" = "sent";
let challenge: { h: string } | null = null;
const calls: string[] = [];
let counts: { send: number; failure: number } = { send: 0, failure: 0 };
const requireUserArgs: unknown[] = [];
const auth = { signInWithPassword: vi.fn(), signOut: vi.fn() };
const sendToMember = vi.fn();
const startChallenge = vi.fn(async (...args: unknown[]) => void args);
const markVerified = vi.fn(async (...args: unknown[]) => void args);

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, auth }) }));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async (options?: unknown) => {
    requireUserArgs.push(options);
    return user;
  },
  getSessionId: async () => sessionId,
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendToMember: (...a: unknown[]) => sendToMember(...a) }));
vi.mock("@/lib/auth/two-factor", () => ({
  isTwoFactorConfigured: () => configured,
  generateCode: () => "482910",
  startChallenge: (...a: unknown[]) => (calls.push("startChallenge"), startChallenge(...a)),
  markVerified: (...a: unknown[]) => markVerified(...a),
  readChallenge: async () => challenge,
  codesMatch: (digest: string, _u: string, _s: string, code: string) => digest === `digest:${code}`,
}));

const actions = await import("@/features/security/actions");
const idle = { status: "idle" as const };

function eventsDb(over: Partial<typeof counts> = {}) {
  counts = { send: 0, failure: 0, ...over };
  db = makeDb((op) => {
    if (op.table === "two_factor_events" && op.kind === "select") {
      const kind = op.filters.find(([c]) => c === "kind")?.[1] as "send" | "failure";
      const since = op.filters.find(([c]) => c === "at>=")?.[1];
      return since ? { count: counts[kind] } : undefined;
    }
    return undefined;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  requireUserArgs.length = 0;
  limit = { ok: true };
  configured = true;
  sessionId = SESSION;
  sendStatus = "sent";
  challenge = { h: "digest:482910" };
  sendToMember.mockImplementation(async () => ({ status: sendStatus }));
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  eventsDb();
});

describe("sendEmailCode", () => {
  it("emails a code to the member's own address, then records the challenge and the send", async () => {
    const result = await actions.sendEmailCode();
    expect(result).toEqual({ ok: true, sentTo: "a•••n@example.com", minutes: 10 });
    expect(requireUserArgs[0]).toEqual({ mfa: "skip" });
    expect(sendToMember).toHaveBeenCalledTimes(1);
    const [recipient, message, category] = sendToMember.mock.calls[0];
    expect(recipient).toBe(user); // only ever the signed-in member
    expect(category).toBe("security");
    expect(message.subject).toContain("482910");
    expect(message.text).toContain("482910");
    expect(startChallenge).toHaveBeenCalledWith(ME, SESSION, "482910");
    expect(db.writes()).toEqual([expect.objectContaining({ table: "two_factor_events", kind: "insert", payload: { user_id: ME, kind: "send" } })]);
  });

  it("never returns the code to the caller", async () => {
    const result = await actions.sendEmailCode();
    expect(JSON.stringify(result)).not.toContain("482910");
  });

  it("does not create a challenge or log a send when the email could not be sent", async () => {
    for (const status of ["skipped", "failed"] as const) {
      sendStatus = status;
      eventsDb();
      const result = await actions.sendEmailCode();
      expect(result).toEqual({ ok: false, error: "We couldn't send the email right now. Please try again in a few minutes." });
    }
    expect(startChallenge).not.toHaveBeenCalled();
    expect(db.writes()).toHaveLength(0);
  });

  it("enforces a one-minute cooldown and five codes an hour", async () => {
    eventsDb({ send: 1 });
    expect(await actions.sendEmailCode()).toMatchObject({ ok: false, error: expect.stringMatching(/wait a minute/i) });
    expect(sendToMember).not.toHaveBeenCalled();
  });

  it("refuses once the hourly limit is reached", async () => {
    // First count (last minute) is zero; the hourly count is five.
    let n = 0;
    db = makeDb((op) => (op.table === "two_factor_events" && op.kind === "select" ? { count: n++ === 0 ? 0 : 5 } : undefined));
    expect(await actions.sendEmailCode()).toMatchObject({ ok: false, error: expect.stringMatching(/too many codes/i) });
    expect(sendToMember).not.toHaveBeenCalled();
  });

  it("refuses rather than sending freely when the log cannot be read", async () => {
    db = makeDb((op) => (op.table === "two_factor_events" ? { error: { message: "boom" }, count: null } : undefined));
    expect(await actions.sendEmailCode()).toEqual({ ok: false, error: "Something went wrong. Please try again." });
    expect(sendToMember).not.toHaveBeenCalled();
  });

  it("says so when email codes are not set up, and stops at the app rate limit", async () => {
    configured = false;
    expect(await actions.sendEmailCode()).toMatchObject({ ok: false, error: expect.stringMatching(/aren't set up/i) });
    configured = true;
    limit = { ok: false, message: "Slow down." };
    expect(await actions.sendEmailCode()).toEqual({ ok: false, error: "Slow down." });
    expect(sendToMember).not.toHaveBeenCalled();
  });

  it("cannot proceed without a readable session", async () => {
    sessionId = null;
    expect(await actions.sendEmailCode()).toMatchObject({ ok: false });
    expect(sendToMember).not.toHaveBeenCalled();
  });
});

describe("verifyEmailCode", () => {
  const form = (over: Record<string, string> = {}) => makeFormData({ code: "482910", next: "/network", ...over });

  it("confirms the sign-in and continues to a safe page when the code is right", async () => {
    const target = await redirectOf(() => actions.verifyEmailCode(idle, form()));
    expect(target).toBe("/network");
    expect(markVerified).toHaveBeenCalledWith(ME, SESSION);
    expect(db.writes()).toHaveLength(0);
  });

  it("never follows an unsafe next address", async () => {
    for (const next of ["https://evil.example", "//evil.example", "javascript:alert(1)"]) {
      expect(await redirectOf(() => actions.verifyEmailCode(idle, form({ next })))).toBe("/");
    }
  });

  it("rejects a wrong code, logs the failure, and does not confirm", async () => {
    const result = await actions.verifyEmailCode(idle, form({ code: "000000" }));
    expect(result).toEqual({ status: "error", message: "That code didn't work. Check the newest email and try again." });
    expect(markVerified).not.toHaveBeenCalled();
    expect(db.writes()).toEqual([expect.objectContaining({ table: "two_factor_events", payload: { user_id: ME, kind: "failure" } })]);
  });

  it("locks guessing after five wrong codes in 15 minutes, even for the right code", async () => {
    eventsDb({ failure: 5 });
    const result = await actions.verifyEmailCode(idle, form());
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/too many wrong codes/i) });
    expect(markVerified).not.toHaveBeenCalled();
  });

  it("explains an expired or missing challenge without counting it as a guess", async () => {
    challenge = null;
    expect(await actions.verifyEmailCode(idle, form())).toMatchObject({ status: "error", message: expect.stringMatching(/expired/i) });
    expect(db.writes()).toHaveLength(0);
  });

  it("rejects malformed codes before touching anything", async () => {
    for (const code of ["", "12345", "1234567", "abcdef", "12 345"]) {
      expect((await actions.verifyEmailCode(idle, form({ code }))).status).toBe("error");
    }
    expect(markVerified).not.toHaveBeenCalled();
    expect(db.ops).toHaveLength(0);
  });

  it("refuses when email codes are not set up, or the log cannot be read", async () => {
    configured = false;
    expect((await actions.verifyEmailCode(idle, form())).status).toBe("error");
    configured = true;
    db = makeDb((op) => (op.table === "two_factor_events" ? { error: { message: "boom" }, count: null } : undefined));
    expect((await actions.verifyEmailCode(idle, form())).status).toBe("error");
    expect(markVerified).not.toHaveBeenCalled();
  });
});

describe("re-authentication and sessions", () => {
  it("confirms the password against the member's own email and returns to a safe page", async () => {
    const target = await redirectOf(() =>
      actions.reauthenticate(idle, makeFormData({ password: "hunter2hunter2", next: "/settings/security" })),
    );
    expect(target).toBe("/settings/security");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "amina.rahman@example.com", password: "hunter2hunter2" });
  });

  it("does not follow an unsafe next address", async () => {
    const target = await redirectOf(() => actions.reauthenticate(idle, makeFormData({ password: "x", next: "https://evil.example" })));
    expect(target).toBe("/settings/security");
  });

  it("rejects a wrong or empty password without leaking detail", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    expect(await actions.reauthenticate(idle, makeFormData({ password: "nope" }))).toEqual({ status: "error", message: "That password isn't right." });
    expect(await actions.reauthenticate(idle, makeFormData({}))).toMatchObject({ status: "error" });
  });

  it("signs out other devices, or every device and then goes to /login", async () => {
    expect(await actions.signOutOtherDevices()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(await redirectOf(() => actions.signOutEverywhere())).toBe("/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
