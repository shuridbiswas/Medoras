import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/redirect";

describe("safeNextPath (open redirect protection)", () => {
  it("allows internal private destinations", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/onboarding")).toBe("/onboarding");
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/profile/amina_r")).toBe("/profile/amina_r");
    expect(safeNextPath("/settings")).toBe("/settings");
    expect(safeNextPath("/search?q=amina")).toBe("/search");
    expect(safeNextPath("/network/requests")).toBe("/network/requests");
    expect(safeNextPath("/notifications")).toBe("/notifications");
    expect(safeNextPath("/saved")).toBe("/saved");
    expect(safeNextPath("/post/3d8f6f1e-6c1b-4a3b-9c52-1f0e2a7d9b11")).toBe(
      "/post/3d8f6f1e-6c1b-4a3b-9c52-1f0e2a7d9b11",
    );
  });

  it("drops the query string and fragment", () => {
    expect(safeNextPath("/?token=abc#x")).toBe("/");
    expect(safeNextPath("/search?q=a#x")).toBe("/search");
  });

  it.each([
    "https://evil.example",
    "http://evil.example/",
    "//evil.example",
    "//evil.example/",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/\r\nSet-Cookie: x=1",
    "/home", // the old address is not a destination any more; "/" is
    "/home/settings",
    "/welcome",
    "/login",
    "/homework",
    "/../etc/passwd",
    "home",
    "",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("falls back for missing values and honours a custom fallback", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined, "/onboarding")).toBe("/onboarding");
    expect(safeNextPath("https://evil.example", "/onboarding")).toBe(
      "/onboarding",
    );
  });
});
