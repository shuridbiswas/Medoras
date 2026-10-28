// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let session: { claims: { sub: string } | null; configured: boolean } = {
  claims: null,
  configured: true,
};

vi.mock("@/lib/supabase/proxy", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase/proxy")>(
    "@/lib/supabase/proxy",
  );
  return {
    ...actual,
    updateSession: async () => ({ response: NextResponse.next(), ...session }),
  };
});

const { proxy, config } = await import("@/proxy");

const run = async (path: string) => {
  const response = await proxy(new NextRequest(`https://medoras.test${path}`));
  const location = response.headers.get("location");
  return location
    ? new URL(location).pathname + new URL(location).search
    : null;
};

beforeEach(() => {
  session = { claims: null, configured: true };
});

describe("proxy route protection", () => {
  it("redirects signed-out visitors away from private routes", async () => {
    expect(await run("/home")).toBe("/login?next=%2Fhome");
    expect(await run("/onboarding")).toBe("/login?next=%2Fonboarding");
    expect(await run("/profile/amina_r")).toBe(
      "/login?next=%2Fprofile%2Famina_r",
    );
    expect(await run("/profile/edit")).toBe("/login?next=%2Fprofile%2Fedit");
    expect(await run("/settings")).toBe("/login?next=%2Fsettings");
    expect(await run("/home/anything/deep")).toBe(
      "/login?next=%2Fhome%2Fanything%2Fdeep",
    );
  });

  it("treats /reset-password without a session as an invalid link", async () => {
    expect(await run("/reset-password")).toBe(
      "/forgot-password?error=link_invalid",
    );
  });

  it("flags missing configuration instead of looping", async () => {
    session = { claims: null, configured: false };
    expect(await run("/home")).toBe("/login?error=not_configured");
  });

  it("lets signed-out visitors use the guest pages", async () => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      expect(await run(path)).toBeNull();
    }
  });

  it("sends signed-in members away from the guest pages", async () => {
    session = { claims: { sub: "u1" }, configured: true };
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      expect(await run(path)).toBe("/home");
    }
  });

  it("lets signed-in members through to private routes", async () => {
    session = { claims: { sub: "u1" }, configured: true };
    expect(await run("/home")).toBeNull();
    expect(await run("/onboarding")).toBeNull();
    expect(await run("/reset-password")).toBeNull();
    expect(await run("/profile/amina_r")).toBeNull();
    expect(await run("/profile/edit")).toBeNull();
    expect(await run("/settings")).toBeNull();
  });

  it("only runs on the auth-related routes", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        "/home/:path*",
        "/profile/:path*",
        "/settings/:path*",
        "/onboarding/:path*",
        "/login",
        "/signup",
      ]),
    );
  });
});
