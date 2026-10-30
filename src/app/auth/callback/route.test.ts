// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabase } from "@/test/mocks";

let supabase = makeSupabase();
let configured = true;

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
}));
vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => configured,
}));

const { GET } = await import("@/app/auth/callback/route");

const call = async (query: string) => {
  const response = await GET(
    new NextRequest(`https://medyra.test/auth/callback?${query}`),
  );
  const location = new URL(
    response.headers.get("location") ?? "",
    "https://medyra.test",
  );
  return {
    status: response.status,
    location: location.pathname + location.search,
    origin: location.origin,
  };
};

beforeEach(() => {
  supabase = makeSupabase();
  configured = true;
});

describe("/auth/callback", () => {
  it("verifies an email link and sends the member to onboarding", async () => {
    const result = await call("token_hash=abc&type=email&next=/onboarding");
    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      type: "email",
      token_hash: "abc",
    });
    expect(result.location).toBe("/onboarding");
  });

  it("verifies a recovery link and sends the member to choose a new password", async () => {
    const result = await call("token_hash=abc&type=recovery&next=/");
    expect(result.location).toBe("/reset-password");
  });

  it("exchanges a PKCE code for a session", async () => {
    const result = await call("code=pkce123&next=/onboarding");
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
      "pkce123",
    );
    expect(result.location).toBe("/onboarding");
  });

  it("sends invalid or expired links back with a clear error", async () => {
    supabase = makeSupabase({
      verifyOtp: { code: "otp_expired", message: "expired" },
    });
    expect((await call("token_hash=old&type=email")).location).toBe(
      "/login?error=link_invalid",
    );
    expect((await call("token_hash=old&type=recovery")).location).toBe(
      "/forgot-password?error=link_invalid",
    );
    supabase = makeSupabase({ exchangeCode: { message: "bad code" } });
    expect((await call("code=bad")).location).toBe("/login?error=link_invalid");
    expect((await call("")).location).toBe("/login?error=link_invalid");
  });

  it("refuses unsupported link types", async () => {
    const result = await call("token_hash=abc&type=magiclink");
    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(result.location).toBe("/login?error=link_invalid");
  });

  it("never redirects off-site, whatever `next` says", async () => {
    for (const next of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
    ]) {
      const result = await call(
        `token_hash=abc&type=email&next=${encodeURIComponent(next)}`,
      );
      expect(result.origin).toBe("https://medyra.test");
      expect(result.location).toBe("/onboarding");
    }
  });

  it("reports missing configuration", async () => {
    configured = false;
    expect((await call("token_hash=abc&type=email")).location).toBe(
      "/login?error=not_configured",
    );
  });
});
