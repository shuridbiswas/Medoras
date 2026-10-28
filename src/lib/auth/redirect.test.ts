import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath (open redirect protection)", () => {
  it("allows internal private destinations", () => {
    expect(safeNextPath("/home")).toBe("/home");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/home/settings")).toBe("/home/settings");
  });

  it("drops the query string and fragment", () => {
    expect(safeNextPath("/home?token=abc#x")).toBe("/home");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/home",
    "//evil.example",
    "//evil.example/home",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/home\r\nSet-Cookie: x=1",
    "/login",
    "/homework",
    "/../etc/passwd",
    "home",
    "",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBe("/home");
  });

  it("falls back for missing values and honours a custom fallback", () => {
    expect(safeNextPath(null)).toBe("/home");
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
    expect(safeNextPath("https://evil.example", "/onboarding")).toBe(
      "/onboarding",
    );
  });
});
