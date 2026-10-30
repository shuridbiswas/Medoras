// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const calls: { table: string; payload: Record<string, unknown> }[] = [];
let profileError: { code: string } | null = null;
let pending: "ok" | "completed" | "signed-out" = "ok";

const storage = {
  upload: vi.fn(async () => ({ error: null })),
  remove: vi.fn(async () => ({ error: null })),
};
const supabase = {
  storage: { from: () => storage },
  from: (table: string) => ({
    update: (payload: Record<string, unknown>) => {
      calls.push({ table, payload });
      return {
        eq: async () => ({ error: table === "profiles" ? profileError : null }),
      };
    },
  }),
};

vi.mock("server-only", () => ({}));
const sendToMember = vi.fn(async () => ({ status: "skipped" as const, reason: "not_configured" as const }));
vi.mock("@/lib/email/send", () => ({
  sendToMember: (...args: unknown[]) => (sendToMember as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
}));
vi.mock("@/lib/auth/session", () => ({
  requireOnboardingPending: async () => {
    if (pending === "signed-out") redirectMock("/login");
    if (pending === "completed") redirectMock("/home");
    return {
      user: { id: "u1", email: "amina@example.com" },
      profile: { avatar_path: null, first_name: "Amina" },
      preferences: null,
    };
  },
}));

const { completeOnboarding } = await import("@/features/onboarding/actions");
const idle = { status: "idle" as const };

const form = {
  memberType: "recent_graduate",
  fields: ["nursing"],
  institution: "McGill",
  qualification: "BScN",
  specialty: "",
  careerStage: "new_graduate",
  country: "CA",
  city: "Montreal",
  purposes: ["find_mentor", "find_jobs"],
  username: "Amina_R",
  headline: "New grad nurse",
  bio: "",
};

beforeEach(() => {
  calls.length = 0;
  profileError = null;
  pending = "ok";
  vi.clearAllMocks();
});

describe("completeOnboarding", () => {
  it("saves preferences first, then marks the profile complete, then redirects home", async () => {
    const to = await redirectOf(() =>
      completeOnboarding(idle, makeFormData(form)),
    );
    expect(to).toBe("/home");
    expect(calls.map((c) => c.table)).toEqual([
      "onboarding_preferences",
      "profiles",
    ]);
    expect(calls[0].payload).toEqual({
      purposes: ["find_mentor", "find_jobs"],
      city: "Montreal",
    });
    expect(calls[1].payload).toMatchObject({
      username: "amina_r",
      member_type: "recent_graduate",
      country: "CA",
      onboarding_completed: true,
    });
  });

  it("sends the welcome email to the member's own address after onboarding succeeds", async () => {
    await redirectOf(() => completeOnboarding(idle, makeFormData(form)));
    expect(sendToMember).toHaveBeenCalledTimes(1);
    const [recipient, message, category] = sendToMember.mock.calls[0] as unknown as [
      { id: string; email: string },
      { subject: string; text: string },
      string,
    ];
    expect(recipient).toMatchObject({ id: "u1", email: "amina@example.com" });
    expect(message.subject).toBe("Welcome to Medyra");
    expect(message.text).toContain("/profile/amina_r");
    expect(category).toBe("transactional");
  });

  it("sends no welcome email when onboarding fails", async () => {
    profileError = { code: "23505" };
    await completeOnboarding(idle, makeFormData(form));
    expect(sendToMember).not.toHaveBeenCalled();
  });

  it("never lets the client choose another member's id or skip validation", async () => {
    const state = await completeOnboarding(
      idle,
      makeFormData({ ...form, memberType: "superadmin" }),
    );
    expect(state.status).toBe("error");
    expect(state.step).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("returns the member to the step that owns an invalid field", async () => {
    const state = await completeOnboarding(
      idle,
      makeFormData({ ...form, username: "no", country: "" }),
    );
    expect(state.fieldErrors?.username).toBeDefined();
    expect(state.step).toBe(2);
  });

  it("reports a taken username on the username field", async () => {
    profileError = { code: "23505" };
    const state = await completeOnboarding(idle, makeFormData(form));
    expect(state).toMatchObject({ status: "error", step: 4 });
    expect(state.fieldErrors?.username?.[0]).toMatch(/already taken/);
  });

  it("rejects a disguised non-image upload without writing anything", async () => {
    const fake = new File(
      [new TextEncoder().encode("<svg onload=alert(1)>")],
      "me.png",
      { type: "image/png" },
    );
    const state = await completeOnboarding(
      idle,
      makeFormData({ ...form, avatar: fake }),
    );
    expect(state.fieldErrors?.avatar).toBeDefined();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });

  it("uploads a real image into the member's own folder", async () => {
    const png = new File(
      [Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])],
      "me.png",
      {
        type: "image/png",
      },
    );
    await redirectOf(() =>
      completeOnboarding(idle, makeFormData({ ...form, avatar: png })),
    );
    const [path] = storage.upload.mock.calls[0] as unknown as [string];
    expect(path).toMatch(/^u1\/[0-9a-f-]{36}\.png$/);
  });

  it("redirects away when the member is signed out or already onboarded", async () => {
    pending = "signed-out";
    expect(
      await redirectOf(() => completeOnboarding(idle, makeFormData(form))),
    ).toBe("/login");
    pending = "completed";
    expect(
      await redirectOf(() => completeOnboarding(idle, makeFormData(form))),
    ).toBe("/home");
    expect(calls).toHaveLength(0);
  });
});
