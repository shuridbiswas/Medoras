// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const FACTOR = "33333333-3333-4333-8333-333333333333";
const user = { id: ME, email: "amina@example.com", user_metadata: { first_name: "Amina" } };

let db = makeDb();
let recent = true;
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
let mode = "required";
const requireUserArgs: unknown[] = [];

const mfa = {
  listFactors: vi.fn(),
  enroll: vi.fn(),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(),
};
const auth = { mfa, signInWithPassword: vi.fn(), signOut: vi.fn() };
const rpc = vi.fn();
const sendToMember = vi.fn(async () => ({ status: "skipped" }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...db.client, auth, rpc }),
}));
vi.mock("@/lib/auth/session", () => ({
  requireUser: async (options?: unknown) => {
    requireUserArgs.push(options);
    return user;
  },
  isRecentAuth: () => recent,
}));
vi.mock("@/lib/auth/mfa", () => ({ mfaMode: () => mode }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/email/send", () => ({ sendToMember: (...a: unknown[]) => sendToMember(...(a as [])) }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/security/actions");

const totp = (...ids: string[]) => ({ data: { all: ids.map((id) => ({ id, status: "verified" })), totp: ids.map((id) => ({ id })) } });

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  recent = true;
  limit = { ok: true };
  mode = "required";
  requireUserArgs.length = 0;
  mfa.listFactors.mockResolvedValue(totp());
  mfa.enroll.mockResolvedValue({ data: { id: FACTOR, totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" } }, error: null });
  mfa.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mfa.unenroll.mockResolvedValue({ data: {}, error: null });
  auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("enrollment", () => {
  it("starts setup with the setup page's relaxed MFA rule and returns the QR code and key once", async () => {
    const result = await actions.startTotpEnrollment();
    expect(result).toEqual({ ok: true, factorId: FACTOR, qrCode: "data:image/svg+xml;utf-8,<svg/>", secret: "JBSWY3DPEHPK3PXP" });
    expect(requireUserArgs[0]).toEqual({ mfa: "allow-enrollment" });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Authenticator app" });
  });

  it("clears an abandoned, never-verified setup before starting another", async () => {
    mfa.listFactors.mockResolvedValue({ data: { all: [{ id: "old", status: "unverified" }, { id: "keep", status: "verified" }], totp: [] } });
    await actions.startTotpEnrollment();
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "old" });
  });

  it("explains a project that has authenticator apps switched off, without leaking details", async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: "MFA enroll is not enabled for TOTP" } });
    const result = await actions.startTotpEnrollment();
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/not turned on/i) });
    mfa.enroll.mockResolvedValue({ data: null, error: { message: "internal detail xyz" } });
    expect(await actions.startTotpEnrollment()).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("stops at the rate limit", async () => {
    limit = { ok: false, message: "Slow down." };
    expect(await actions.startTotpEnrollment()).toEqual({ ok: false, error: "Slow down." });
    expect(mfa.enroll).not.toHaveBeenCalled();
  });

  it("confirms the first code, tells the member by email, and rejects bad codes", async () => {
    expect(await actions.verifyTotpEnrollment(FACTOR, " 123456 ")).toEqual({ ok: true });
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR, code: "123456" });
    expect(sendToMember).toHaveBeenCalledTimes(1);

    expect(await actions.verifyTotpEnrollment(FACTOR, "12345")).toMatchObject({ ok: false });
    expect(await actions.verifyTotpEnrollment(FACTOR, "abcdef")).toMatchObject({ ok: false });
    expect(await actions.verifyTotpEnrollment("nope", "123456")).toMatchObject({ ok: false });
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "Invalid TOTP code entered" } });
    expect(await actions.verifyTotpEnrollment(FACTOR, "123456")).toEqual({
      ok: false,
      error: "That code didn't work. Check the clock on your phone and try again.",
    });
  });
});

describe("the sign-in challenge", () => {
  it("verifies the code against the member's own authenticator and continues to a safe path", async () => {
    mfa.listFactors.mockResolvedValue(totp(FACTOR));
    const target = await redirectOf(() =>
      actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "123456", next: "/network" })),
    );
    expect(target).toBe("/network");
    expect(mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: FACTOR, code: "123456" });
    expect(requireUserArgs[0]).toEqual({ mfa: "skip" });
  });

  it("never redirects to an address outside the app", async () => {
    mfa.listFactors.mockResolvedValue(totp(FACTOR));
    for (const next of ["https://evil.example", "//evil.example", "javascript:alert(1)"]) {
      expect(
        await redirectOf(() => actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "123456", next }))),
      ).toBe("/");
    }
  });

  it("reports a wrong code without redirecting", async () => {
    mfa.listFactors.mockResolvedValue(totp(FACTOR));
    mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "bad" } });
    const result = await actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "123456" }));
    expect(result).toMatchObject({ status: "error", message: expect.stringMatching(/didn't work/) });
  });

  it("rejects malformed codes, a member with no authenticator, and too many attempts", async () => {
    expect(await actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "abc" }))).toMatchObject({ status: "error" });
    expect(await actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "123456" }))).toMatchObject({
      status: "error",
      message: expect.stringMatching(/recovery code/i),
    });
    limit = { ok: false, message: "Too many attempts." };
    expect(await actions.verifyMfaChallenge({ status: "idle" }, makeFormData({ code: "123456" }))).toEqual({
      status: "error",
      message: "Too many attempts.",
    });
    expect(mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
});

describe("removing an authenticator", () => {
  it("needs a recent sign-in", async () => {
    recent = false;
    mfa.listFactors.mockResolvedValue(totp(FACTOR, "second"));
    expect(await actions.removeFactor(FACTOR)).toMatchObject({ ok: false, reauth: true });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it("refuses to remove the only authenticator while MFA is required", async () => {
    mfa.listFactors.mockResolvedValue(totp(FACTOR));
    const result = await actions.removeFactor(FACTOR);
    expect(result).toMatchObject({ ok: false, error: expect.stringMatching(/required/i) });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it("allows it when another authenticator remains, or when MFA is optional, and emails the member", async () => {
    mfa.listFactors.mockResolvedValue(totp(FACTOR, "second"));
    expect(await actions.removeFactor(FACTOR)).toEqual({ ok: true });
    expect(sendToMember).toHaveBeenCalledTimes(1);

    mode = "challenge";
    mfa.listFactors.mockResolvedValue(totp(FACTOR));
    expect(await actions.removeFactor(FACTOR)).toEqual({ ok: true });
    expect(mfa.unenroll).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed ids", async () => {
    expect(await actions.removeFactor("nope")).toMatchObject({ ok: false });
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });
});

describe("recovery codes", () => {
  it("creates ten codes, stores only their hashes for the signed-in member, and returns the codes once", async () => {
    const result = await actions.createRecoveryCodes();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.codes).toHaveLength(10);
    const [del, ins] = db.writes();
    expect(del).toMatchObject({ table: "mfa_recovery_codes", kind: "delete" });
    expect(del.filters).toContainEqual(["user_id", ME]);
    expect(ins).toMatchObject({ table: "mfa_recovery_codes", kind: "insert" });
    const rows = ins.payload as { user_id: string; code_hash: string }[];
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.user_id === ME && /^[0-9a-f]{64}$/.test(r.code_hash))).toBe(true);
    // No plaintext code is written to the database.
    expect(JSON.stringify(ins.payload)).not.toContain(result.codes[0]);
    expect(requireUserArgs[0]).toEqual({ mfa: "enforce" });
  });

  it("needs a recent sign-in and does not touch existing codes without one", async () => {
    recent = false;
    expect(await actions.createRecoveryCodes()).toMatchObject({ ok: false, reauth: true });
    expect(db.ops).toHaveLength(0);
  });

  it("reports a database failure plainly", async () => {
    db = makeDb(() => ({ error: { code: "XX000", message: "secret detail" } }));
    expect(await actions.createRecoveryCodes()).toEqual({ ok: false, error: "Something went wrong. Please try again." });
  });

  it("redeems a code through the database function and sends the member to set up a new authenticator", async () => {
    const target = await redirectOf(() => actions.redeemRecoveryCode({ status: "idle" }, makeFormData({ code: "abcd-2345-wxyz" })));
    expect(target).toBe("/settings/security?setup=1&recovered=1");
    expect(rpc).toHaveBeenCalledWith("redeem_mfa_recovery_code", { p_code: "abcd-2345-wxyz" });
    expect(sendToMember).toHaveBeenCalledTimes(1);
    expect(requireUserArgs[0]).toEqual({ mfa: "skip" });
  });

  it("says a wrong or used code did not work, and reports lock-out", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await actions.redeemRecoveryCode({ status: "idle" }, makeFormData({ code: "abcd-2345-wxyz" }))).toMatchObject({
      status: "error",
      message: expect.stringMatching(/didn't work/),
    });
    rpc.mockResolvedValue({ data: null, error: { message: "Too many attempts. Please try again later." } });
    expect(await actions.redeemRecoveryCode({ status: "idle" }, makeFormData({ code: "abcd-2345-wxyz" }))).toEqual({
      status: "error",
      message: "Too many attempts. Please try again later.",
    });
    expect(await actions.redeemRecoveryCode({ status: "idle" }, makeFormData({ code: "x" }))).toMatchObject({ status: "error" });
  });
});

describe("re-authentication and sessions", () => {
  it("confirms the password against the member's own email and returns to a safe page", async () => {
    const target = await redirectOf(() =>
      actions.reauthenticate({ status: "idle" }, makeFormData({ password: "hunter2hunter2", next: "/settings/security" })),
    );
    expect(target).toBe("/settings/security");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "amina@example.com", password: "hunter2hunter2" });
  });

  it("does not follow an unsafe next address", async () => {
    const target = await redirectOf(() =>
      actions.reauthenticate({ status: "idle" }, makeFormData({ password: "x", next: "https://evil.example" })),
    );
    expect(target).toBe("/settings/security"); // falls back to the security page, not the attacker's address
  });

  it("rejects a wrong or empty password without leaking detail", async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: { message: "Invalid login credentials" } });
    expect(await actions.reauthenticate({ status: "idle" }, makeFormData({ password: "nope" }))).toEqual({
      status: "error",
      message: "That password isn't right.",
    });
    expect(await actions.reauthenticate({ status: "idle" }, makeFormData({}))).toMatchObject({ status: "error" });
  });

  it("signs out other devices, or every device and then goes to /login", async () => {
    expect(await actions.signOutOtherDevices()).toEqual({ ok: true });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    const target = await redirectOf(() => actions.signOutEverywhere());
    expect(target).toBe("/login");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});
