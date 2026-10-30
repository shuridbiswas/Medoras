import { describe, expect, it } from "vitest";
import { evaluateMfa, isRecentSignIn, maskEmail, mfaMode } from "@/lib/auth/mfa";

describe("mfaMode", () => {
  it("defaults to required, so a missing or odd setting never weakens security", () => {
    expect(mfaMode({})).toBe("required");
    expect(mfaMode({ MFA_ENFORCEMENT: "" })).toBe("required");
    expect(mfaMode({ MFA_ENFORCEMENT: "banana" })).toBe("required");
    expect(mfaMode({ MFA_ENFORCEMENT: "challenge" })).toBe("required"); // an old value from the authenticator design
  });

  it("is off only when explicitly set, ignoring case and spaces", () => {
    expect(mfaMode({ MFA_ENFORCEMENT: "off" })).toBe("off");
    expect(mfaMode({ MFA_ENFORCEMENT: " OFF " })).toBe("off");
  });
});

describe("evaluateMfa", () => {
  const cases = [
    // mode, configured, verified, expected
    ["required", true, false, "challenge"],
    ["required", true, true, "ok"],
    ["required", false, false, "ok"], // not set up: members are never locked out
    ["required", false, true, "ok"],
    ["off", true, false, "ok"],
    ["off", false, false, "ok"],
  ] as const;

  it.each(cases)("%s, configured=%s, verified=%s -> %s", (mode, configured, verified, expected) => {
    expect(evaluateMfa(mode, { configured, verified })).toBe(expected);
  });
});

describe("isRecentSignIn", () => {
  const now = Date.parse("2026-11-02T12:00:00Z");
  it("accepts a sign-in within the window", () => {
    expect(isRecentSignIn("2026-11-02T11:55:00Z", now)).toBe(true);
    expect(isRecentSignIn("2026-11-02T11:50:00Z", now)).toBe(true); // exactly ten minutes
  });
  it("rejects old, missing, malformed and future timestamps", () => {
    expect(isRecentSignIn("2026-11-02T11:49:59Z", now)).toBe(false);
    expect(isRecentSignIn(null, now)).toBe(false);
    expect(isRecentSignIn(undefined, now)).toBe(false);
    expect(isRecentSignIn("not a date", now)).toBe(false);
    expect(isRecentSignIn("2026-11-02T12:05:00Z", now)).toBe(false);
  });
  it("honours a custom window", () => {
    expect(isRecentSignIn("2026-11-02T11:00:00Z", now, 90)).toBe(true);
  });
});

describe("maskEmail", () => {
  it("shows enough to recognise the address, not all of it", () => {
    expect(maskEmail("amina.rahman@example.com")).toBe("a•••n@example.com");
    expect(maskEmail("ab@example.com")).toBe("a•••@example.com");
  });
  it("copes with missing or malformed input", () => {
    expect(maskEmail(null)).toBe("your email address");
    expect(maskEmail("no-at-sign")).toBe("your email address");
  });
});
