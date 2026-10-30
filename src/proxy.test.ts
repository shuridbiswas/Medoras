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
  const response = await proxy(new NextRequest(`https://medyra.test${path}`));
  const location = response.headers.get("location");
  return location
    ? new URL(location).pathname + new URL(location).search
    : null;
};

beforeEach(() => {
  session = { claims: null, configured: true };
});

describe("the default page (/)", () => {
  it("sends visitors who are not signed in to the welcome page", async () => {
    expect(await run("/")).toBe("/welcome");
    expect(await run("/?category=questions")).toBe("/welcome");
  });

  it("sends visitors to the welcome page when auth is not configured at all", async () => {
    session = { claims: null, configured: false };
    expect(await run("/")).toBe("/welcome");
  });

  it("lets signed-in members through to the home feed", async () => {
    session = { claims: { sub: "u1" }, configured: true };
    expect(await run("/")).toBeNull();
    expect(await run("/?category=questions")).toBeNull();
  });

  it("never redirects the welcome page itself (no loop), signed in or out", async () => {
    expect(await run("/welcome")).toBeNull();
    session = { claims: { sub: "u1" }, configured: true };
    expect(await run("/welcome")).toBeNull();
  });
});

describe("proxy route protection", () => {
  it("redirects signed-out visitors away from private routes", async () => {
    expect(await run("/onboarding")).toBe("/login?next=%2Fonboarding");
    expect(await run("/profile/amina_r")).toBe(
      "/login?next=%2Fprofile%2Famina_r",
    );
    expect(await run("/profile/edit")).toBe("/login?next=%2Fprofile%2Fedit");
    expect(await run("/settings")).toBe("/login?next=%2Fsettings");
  });

  it("protects the search page and the not-yet-built module pages", async () => {
    for (const path of ["/search", "/communities", "/mentorship", "/careers", "/saved", "/feedback"]) {
      expect(await run(path)).toBe(`/login?next=${encodeURIComponent(path)}`);
    }
    expect(await run("/search?q=amina")).toBe("/login?next=%2Fsearch");
  });

  it("treats /reset-password without a session as an invalid link", async () => {
    expect(await run("/reset-password")).toBe(
      "/forgot-password?error=link_invalid",
    );
  });

  it("flags missing configuration instead of looping", async () => {
    session = { claims: null, configured: false };
    expect(await run("/settings")).toBe("/login?error=not_configured");
  });

  it("lets signed-out visitors use the guest pages", async () => {
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      expect(await run(path)).toBeNull();
    }
  });

  it("sends signed-in members away from the guest pages to the home page", async () => {
    session = { claims: { sub: "u1" }, configured: true };
    for (const path of ["/login", "/signup", "/forgot-password"]) {
      expect(await run(path)).toBe("/");
    }
  });

  it("lets signed-in members through to private routes", async () => {
    session = { claims: { sub: "u1" }, configured: true };
    expect(await run("/onboarding")).toBeNull();
    expect(await run("/reset-password")).toBeNull();
    expect(await run("/profile/amina_r")).toBeNull();
    expect(await run("/profile/edit")).toBeNull();
    expect(await run("/settings")).toBeNull();
    for (const path of ["/search", "/communities", "/mentorship", "/careers", "/saved", "/feedback"]) {
      expect(await run(path)).toBeNull();
    }
  });

  it("runs on the root and the auth-related routes only (not on /welcome or public pages)", () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining([
        "/",
        "/profile/:path*",
        "/settings/:path*",
        "/search/:path*",
        "/communities/:path*",
        "/mentorship/:path*",
        "/careers/:path*",
        "/saved/:path*",
        "/feedback/:path*",
        "/onboarding/:path*",
        "/login",
        "/signup",
      ]),
    );
    expect(config.matcher).not.toContain("/welcome");
    expect(config.matcher).not.toContain("/home/:path*");
  });
});
