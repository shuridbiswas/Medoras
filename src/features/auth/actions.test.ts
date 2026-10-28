// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  makeFormData,
  makeSupabase,
  redirectMock,
  redirectOf,
} from "@/test/mocks";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
let supabase = makeSupabase();
let configured = true;

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirectMock(url),
}));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => supabase,
}));
vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => configured,
  NOT_CONFIGURED_MESSAGE: "not configured",
}));
const getUser = vi.fn();
vi.mock("@/lib/auth/session", () => ({ getUser: () => getUser() }));

const actions = await import("@/features/auth/actions");
const idle = { status: "idle" as const };

const signupData = {
  firstName: "Amina",
  lastName: "Rahman",
  email: "amina@example.com",
  password: "correct-horse-9",
  confirmPassword: "correct-horse-9",
  acceptTerms: "on",
};

beforeEach(() => {
  vi.clearAllMocks();
  supabase = makeSupabase();
  configured = true;
  getUser.mockResolvedValue(null);
});

describe("signUp", () => {
  it("registers with Supabase and asks the member to check their email", async () => {
    const state = await actions.signUp(idle, makeFormData(signupData));
    expect(state).toEqual({ status: "success", email: "amina@example.com" });
    expect(supabase.auth.signUp).toHaveBeenCalledOnce();
    const args = (supabase.auth.signUp.mock.calls[0] as unknown[])[0] as {
      options: { data: unknown; emailRedirectTo: string };
      password: string;
    };
    expect(args.options.data).toEqual({
      first_name: "Amina",
      last_name: "Rahman",
    });
    expect(args.options.emailRedirectTo).toMatch(
      /\/auth\/callback\?next=\/onboarding$/,
    );
  });

  it("shows the same success screen for an already-registered email (no account enumeration)", async () => {
    supabase = makeSupabase({
      signUp: {
        code: "user_already_exists",
        message: "User already registered",
      },
    });
    const state = await actions.signUp(idle, makeFormData(signupData));
    expect(state).toEqual({ status: "success", email: "amina@example.com" });
  });

  it("returns field errors without calling Supabase for invalid input", async () => {
    const state = await actions.signUp(
      idle,
      makeFormData({
        ...signupData,
        password: "short",
        confirmPassword: "nope",
        acceptTerms: undefined,
      }),
    );
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.password).toBeDefined();
    expect(state.fieldErrors?.acceptTerms).toBeDefined();
    expect(state.values).toEqual({
      firstName: "Amina",
      lastName: "Rahman",
      email: "amina@example.com",
    });
    expect(JSON.stringify(state)).not.toContain("correct-horse");
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("surfaces Supabase's weak password rule on the password field", async () => {
    supabase = makeSupabase({
      signUp: {
        code: "weak_password",
        message: "Password is too easy to guess.",
      },
    });
    const state = await actions.signUp(idle, makeFormData(signupData));
    expect(state.fieldErrors?.password).toEqual([
      "Password is too easy to guess.",
    ]);
  });

  it("reports email rate limiting and unknown failures without leaking details", async () => {
    supabase = makeSupabase({
      signUp: { code: "over_email_send_rate_limit", message: "x" },
    });
    expect(
      (await actions.signUp(idle, makeFormData(signupData))).message,
    ).toMatch(/too many emails/i);
    supabase = makeSupabase({
      signUp: { code: "unexpected_failure", message: "db exploded" },
    });
    const state = await actions.signUp(idle, makeFormData(signupData));
    expect(state.message).toBe("Something went wrong. Please try again.");
  });

  it("explains setup is missing instead of pretending to work", async () => {
    configured = false;
    const state = await actions.signUp(idle, makeFormData(signupData));
    expect(state.status).toBe("error");
    expect(state.message).toBe("not configured");
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("signIn", () => {
  const login = {
    email: "amina@example.com",
    password: "whatever-1",
    remember: "on",
  };

  it("signs in and redirects to /home", async () => {
    const to = await redirectOf(() =>
      actions.signIn(idle, makeFormData(login)),
    );
    expect(to).toBe("/home");
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "amina@example.com",
      password: "whatever-1",
    });
    expect(cookieStore.delete).toHaveBeenCalledWith("medoras-session-only");
  });

  it("makes the session browser-only when 'keep me signed in' is unticked", async () => {
    await redirectOf(() =>
      actions.signIn(idle, makeFormData({ ...login, remember: undefined })),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      "medoras-session-only",
      "1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("follows a safe next path but never an external one", async () => {
    expect(
      await redirectOf(() =>
        actions.signIn(idle, makeFormData({ ...login, next: "/onboarding" })),
      ),
    ).toBe("/onboarding");
    expect(
      await redirectOf(() =>
        actions.signIn(
          idle,
          makeFormData({ ...login, next: "https://evil.example" }),
        ),
      ),
    ).toBe("/home");
    expect(
      await redirectOf(() =>
        actions.signIn(
          idle,
          makeFormData({ ...login, next: "//evil.example" }),
        ),
      ),
    ).toBe("/home");
  });

  it("gives one generic message for invalid credentials", async () => {
    supabase = makeSupabase({
      signIn: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      },
    });
    const state = await actions.signIn(idle, makeFormData(login));
    expect(state).toMatchObject({
      status: "error",
      message: "Incorrect email or password.",
    });
    expect(state.values).toEqual({ email: "amina@example.com" });
  });

  it("offers to resend the verification email for unverified accounts", async () => {
    supabase = makeSupabase({
      signIn: { code: "email_not_confirmed", message: "Email not confirmed" },
    });
    const state = await actions.signIn(idle, makeFormData(login));
    expect(state.needsVerification).toBe(true);
    expect(state.email).toBe("amina@example.com");
  });

  it("validates input before contacting Supabase", async () => {
    const state = await actions.signIn(
      idle,
      makeFormData({ email: "bad", password: "" }),
    );
    expect(state.fieldErrors?.email).toBeDefined();
    expect(state.fieldErrors?.password).toBeDefined();
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("password recovery", () => {
  it("sends a reset email and always reports success, even for unknown addresses", async () => {
    const state = await actions.requestPasswordReset(
      idle,
      makeFormData({ email: "who@example.com" }),
    );
    expect(state).toEqual({ status: "success", email: "who@example.com" });
    const [email, options] = supabase.auth.resetPasswordForEmail.mock
      .calls[0] as unknown as [string, { redirectTo: string }];
    expect(email).toBe("who@example.com");
    expect(options.redirectTo).toMatch(
      /\/auth\/callback\?next=\/reset-password$/,
    );

    supabase = makeSupabase({
      resetForEmail: { code: "user_not_found", message: "nope" },
    });
    expect(
      (
        await actions.requestPasswordReset(
          idle,
          makeFormData({ email: "who@example.com" }),
        )
      ).status,
    ).toBe("success");
  });

  it("updates the password for a member with a recovery session, then signs out other devices", async () => {
    getUser.mockResolvedValue({ id: "u1" });
    const to = await redirectOf(() =>
      actions.updatePassword(
        idle,
        makeFormData({
          password: "brand-new-pass1",
          confirmPassword: "brand-new-pass1",
        }),
      ),
    );
    expect(to).toBe("/home");
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "brand-new-pass1",
    });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("refuses to update a password without a valid session (expired or forged link)", async () => {
    const to = await redirectOf(() =>
      actions.updatePassword(
        idle,
        makeFormData({
          password: "brand-new-pass1",
          confirmPassword: "brand-new-pass1",
        }),
      ),
    );
    expect(to).toBe("/forgot-password?error=link_invalid");
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("reports reuse of the same password and validates mismatches", async () => {
    getUser.mockResolvedValue({ id: "u1" });
    supabase = makeSupabase({
      updateUser: { code: "same_password", message: "same" },
    });
    const reused = await actions.updatePassword(
      idle,
      makeFormData({
        password: "brand-new-pass1",
        confirmPassword: "brand-new-pass1",
      }),
    );
    expect(reused.fieldErrors?.password?.[0]).toMatch(/haven't used/);
    const mismatch = await actions.updatePassword(
      idle,
      makeFormData({
        password: "brand-new-pass1",
        confirmPassword: "different",
      }),
    );
    expect(mismatch.fieldErrors?.confirmPassword).toBeDefined();
  });
});

describe("resendVerification and signOut", () => {
  it("resends the signup email with a neutral message", async () => {
    const state = await actions.resendVerification(
      idle,
      makeFormData({ email: "amina@example.com" }),
    );
    expect(state.status).toBe("success");
    expect(supabase.auth.resend).toHaveBeenCalledWith(
      expect.objectContaining({ type: "signup", email: "amina@example.com" }),
    );
  });

  it("signs out, clears the session-only flag and returns to the welcome page", async () => {
    const to = await redirectOf(() => actions.signOut());
    expect(to).toBe("/");
    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("medoras-session-only");
  });
});
