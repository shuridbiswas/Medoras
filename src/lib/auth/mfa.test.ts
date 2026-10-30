import { describe, expect, it } from "vitest";
import { evaluateMfa, isRecentSignIn, mfaMode } from "@/lib/auth/mfa";

describe("mfaMode", () => {
  it("defaults to required, so a missing setting never weakens security", () => {
    expect(mfaMode({})).toBe("required");
    expect(mfaMode({ MFA_ENFORCEMENT: "" })).toBe("required");
    expect(mfaMode({ MFA_ENFORCEMENT: "banana" })).toBe("required");
  });

  it("reads the three documented values, ignoring case and spaces", () => {
    expect(mfaMode({ MFA_ENFORCEMENT: "off" })).toBe("off");
    expect(mfaMode({ MFA_ENFORCEMENT: " Challenge " })).toBe("challenge");
    expect(mfaMode({ MFA_ENFORCEMENT: "REQUIRED" })).toBe("required");
  });
});

describe("evaluateMfa", () => {
  const cases = [
    // mode, enrolled, level, expected
    ["required", false, "aal1", "enroll"],
    ["required", true, "aal1", "challenge"],
    ["required", true, "aal2", "ok"],
    ["challenge", false, "aal1", "ok"],
    ["challenge", true, "aal1", "challenge"],
    ["challenge", true, "aal2", "ok"],
    ["off", false, "aal1", "ok"],
    ["off", true, "aal1", "ok"],
    ["off", true, "aal2", "ok"],
  ] as const;

  it.each(cases)("%s, enrolled=%s, level=%s -> %s", (mode, enrolled, level, expected) => {
    expect(evaluateMfa(mode, { enrolled, level })).toBe(expected);
  });

  it("never asks a member who has not enrolled for a code they cannot produce", () => {
    for (const mode of ["off", "challenge", "required"] as const) {
      expect(evaluateMfa(mode, { enrolled: false, level: "aal1" })).not.toBe("challenge");
    }
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
