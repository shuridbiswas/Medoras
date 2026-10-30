// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabase, redirectMock, redirectOf } from "@/test/mocks";

type Row = Record<string, unknown> | null;
let user: { id: string; email_confirmed_at: string | null } | null = null;
let profile: Row = null;

function client() {
  const base = makeSupabase({ user });
  return {
    ...base,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile }) }),
      }),
    }),
  };
}

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T>(fn: T) => fn };
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => client(),
}));
vi.mock("@/lib/supabase/env", () => ({ isSupabaseConfigured: () => true }));

const session = await import("@/lib/auth/session");

beforeEach(() => {
  user = null;
  profile = null;
});

describe("server-side access control", () => {
  it("sends signed-out visitors to /login from every gate", async () => {
    expect(await redirectOf(() => session.requireUser())).toBe("/login");
    expect(await redirectOf(() => session.requireMember())).toBe("/login");
    expect(await redirectOf(() => session.requireOnboardingPending())).toBe(
      "/login",
    );
  });

  it("rejects members whose email is not verified", async () => {
    user = { id: "u1", email_confirmed_at: null };
    expect(await redirectOf(() => session.requireUser())).toBe(
      "/login?error=verify_email",
    );
  });

  it("sends members who have not finished onboarding to /onboarding", async () => {
    user = { id: "u1", email_confirmed_at: "2026-10-28T00:00:00Z" };
    profile = { id: "u1", onboarding_completed: false };
    expect(await redirectOf(() => session.requireMember())).toBe("/onboarding");
    expect(
      await redirectOf(() => session.requireOnboardingPending()),
    ).toBeNull();
  });

  it("sends onboarded members to the home page (/) instead of repeating onboarding", async () => {
    user = { id: "u1", email_confirmed_at: "2026-10-28T00:00:00Z" };
    profile = { id: "u1", onboarding_completed: true, first_name: "Amina" };
    expect(await redirectOf(() => session.requireOnboardingPending())).toBe(
      "/",
    );
    const result = await session.requireMember();
    expect(result.profile.first_name).toBe("Amina");
  });

  it("builds avatar URLs from the storage path only", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(session.avatarUrl("u1/photo one.png")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/avatars/u1/photo%20one.png",
    );
    expect(session.avatarUrl(null)).toBeNull();
  });
});
