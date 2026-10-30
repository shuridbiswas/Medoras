// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, { value: string; options?: Record<string, unknown> }>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)!.value } : undefined),
    set: (name: string, value: string, options?: Record<string, unknown>) => void jar.set(name, { value, options }),
    delete: (name: string) => void jar.delete(name),
  }),
}));

const SECRET = "s".repeat(40);
const tf = await import("@/lib/auth/two-factor");

const USER = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  jar.clear();
  process.env.TWO_FACTOR_SECRET = SECRET;
});

describe("isTwoFactorConfigured", () => {
  const ok = { TWO_FACTOR_SECRET: SECRET, RESEND_API_KEY: "re_x", EMAIL_FROM: "Medyra <a@b.c>" };
  it("needs the signing secret, an API key and a sender", () => {
    expect(tf.isTwoFactorConfigured(ok)).toBe(true);
    expect(tf.isTwoFactorConfigured({ ...ok, TWO_FACTOR_SECRET: undefined })).toBe(false);
    expect(tf.isTwoFactorConfigured({ ...ok, RESEND_API_KEY: "" })).toBe(false);
    expect(tf.isTwoFactorConfigured({ ...ok, EMAIL_FROM: undefined })).toBe(false);
  });
  it("rejects a short secret", () => {
    expect(tf.isTwoFactorConfigured({ ...ok, TWO_FACTOR_SECRET: "short" })).toBe(false);
    expect(tf.isTwoFactorConfigured({ ...ok, TWO_FACTOR_SECRET: "x".repeat(31) })).toBe(false);
  });
});

describe("generateCode", () => {
  it("is always six digits, including leading zeros, and varies", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const code = tf.generateCode();
      expect(code).toMatch(/^\d{6}$/);
      codes.add(code);
    }
    expect(codes.size).toBeGreaterThan(250);
  });
});

describe("signed tokens", () => {
  it("round-trip", () => {
    expect(tf.read(tf.sign({ a: 1, b: "x" }))).toEqual({ a: 1, b: "x" });
  });

  it("are rejected when edited, truncated, unsigned or signed with another secret", () => {
    const token = tf.sign({ u: USER });
    const [body, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "someone-else" })).toString("base64url");
    expect(tf.read(`${forged}.${signature}`)).toBeNull();
    expect(tf.read(`${body}.${signature.slice(0, -2)}AA`)).toBeNull();
    expect(tf.read(body)).toBeNull();
    expect(tf.read("")).toBeNull();
    expect(tf.read(undefined)).toBeNull();
    expect(tf.read("garbage.garbage")).toBeNull();
    process.env.TWO_FACTOR_SECRET = "z".repeat(40);
    expect(tf.read(token)).toBeNull();
  });

  it("are never accepted when there is no secret", () => {
    const token = tf.sign({ u: USER });
    delete process.env.TWO_FACTOR_SECRET;
    expect(tf.read(token)).toBeNull();
  });
});

describe("code digests", () => {
  it("match only the same member, session and code", () => {
    const digest = tf.codeDigest(USER, SESSION, "123456");
    expect(tf.codesMatch(digest, USER, SESSION, "123456")).toBe(true);
    expect(tf.codesMatch(digest, USER, SESSION, "123457")).toBe(false);
    expect(tf.codesMatch(digest, "other", SESSION, "123456")).toBe(false);
    expect(tf.codesMatch(digest, USER, "other", "123456")).toBe(false);
    expect(tf.codesMatch("short", USER, SESSION, "123456")).toBe(false);
  });

  it("do not reveal the code", () => {
    expect(tf.codeDigest(USER, SESSION, "123456")).not.toContain("123456");
  });
});

describe("challenge cookie", () => {
  it("is HttpOnly, SameSite=Lax, short-lived, and contains no code", async () => {
    await tf.startChallenge(USER, SESSION, "654321");
    const { value, options } = jar.get(tf.CHALLENGE_COOKIE)!;
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
    expect(value).not.toContain("654321");
    expect(Buffer.from(value.split(".")[0], "base64url").toString()).not.toContain("654321");
  });

  it("is read back only for the same member and session, and only until it expires", async () => {
    await tf.startChallenge(USER, SESSION, "654321");
    const now = Date.now();
    expect(await tf.readChallenge(USER, SESSION, now)).toMatchObject({ u: USER, s: SESSION });
    expect(await tf.readChallenge("someone-else", SESSION, now)).toBeNull();
    expect(await tf.readChallenge(USER, "another-session", now)).toBeNull();
    expect(await tf.readChallenge(USER, SESSION, now + 11 * 60_000)).toBeNull();
  });

  it("is ignored if it was tampered with", async () => {
    await tf.startChallenge(USER, SESSION, "654321");
    const original = jar.get(tf.CHALLENGE_COOKIE)!.value;
    jar.set(tf.CHALLENGE_COOKIE, { value: original.replace(/.$/, (c) => (c === "A" ? "B" : "A")) });
    expect(await tf.readChallenge(USER, SESSION)).toBeNull();
  });
});

describe("verified cookie", () => {
  it("is not set until a code is confirmed", async () => {
    expect(await tf.isVerified(USER, SESSION)).toBe(false);
  });

  it("marks only this member's session, then clears the challenge", async () => {
    await tf.startChallenge(USER, SESSION, "654321");
    await tf.markVerified(USER, SESSION);
    expect(jar.has(tf.CHALLENGE_COOKIE)).toBe(false);
    expect(jar.get(tf.VERIFIED_COOKIE)!.options).toMatchObject({ httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 3600 });
    expect(await tf.isVerified(USER, SESSION)).toBe(true);
    // A different sign-in session (a new login) or a different member is not confirmed.
    expect(await tf.isVerified(USER, "new-session")).toBe(false);
    expect(await tf.isVerified("other", SESSION)).toBe(false);
  });

  it("expires", async () => {
    await tf.markVerified(USER, SESSION);
    expect(await tf.isVerified(USER, SESSION, Date.now() + 8 * 24 * 3600_000)).toBe(false);
  });

  it("cannot be forged by someone who does not know the secret", async () => {
    process.env.TWO_FACTOR_SECRET = "attacker-secret-attacker-secret-attacker";
    const forged = tf.sign({ t: "v", u: USER, s: SESSION, e: Date.now() + 1e9 });
    process.env.TWO_FACTOR_SECRET = SECRET;
    jar.set(tf.VERIFIED_COOKIE, { value: forged });
    expect(await tf.isVerified(USER, SESSION)).toBe(false);
  });

  it("is cleared together with the challenge", async () => {
    await tf.markVerified(USER, SESSION);
    await tf.startChallenge(USER, SESSION, "111111");
    await tf.clearTwoFactorCookies();
    expect(jar.size).toBe(0);
  });
});
