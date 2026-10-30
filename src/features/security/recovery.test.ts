// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeRecoveryCode,
  RECOVERY_CODE_COUNT,
} from "@/features/security/recovery";

describe("recovery codes", () => {
  it("look like xxxx-xxxx-xxxx and avoid easily confused characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateRecoveryCode()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{4}(-[abcdefghjkmnpqrstuvwxyz23456789]{4}){2}$/);
    }
  });

  it("come as ten distinct codes", () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
  });

  it("are not repeated between sets", () => {
    const a = new Set(generateRecoveryCodes());
    const b = generateRecoveryCodes();
    expect(b.some((c) => a.has(c))).toBe(false);
  });

  it("hash the same however the member types them (the database normalises the same way)", () => {
    const expected = createHash("sha256").update("abcd2345wxyz").digest("hex");
    expect(hashRecoveryCode("abcd-2345-wxyz")).toBe(expected);
    expect(hashRecoveryCode("  ABCD 2345 WXYZ ")).toBe(expected);
    expect(normalizeRecoveryCode("AB-cd.12")).toBe("abcd12");
  });

  it("hash to 64 hex characters, never the code itself", () => {
    const code = generateRecoveryCode();
    const hash = hashRecoveryCode(code);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(code.replace(/-/g, ""));
  });
});
