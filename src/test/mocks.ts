import { vi } from "vitest";

/** Shared test doubles for Supabase-backed server code. */

export class RedirectError extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT:${url}`);
  }
}

export const redirectMock = vi.fn((url: string) => {
  throw new RedirectError(url);
});

export function makeFormData(
  entries: Record<string, string | string[] | File | undefined>,
) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => formData.append(key, v));
    else formData.append(key, value);
  }
  return formData;
}

/** Resolve with the redirect URL a server action threw, or null if it returned normally. */
export async function redirectOf(
  run: () => Promise<unknown>,
): Promise<string | null> {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectError) return error.url;
    throw error;
  }
  return null;
}

type AuthError = { code?: string; message: string } | null;

export function makeSupabase(
  overrides: {
    signUp?: AuthError;
    /** True when the project has email confirmation off, so signUp returns a session. */
    signUpSession?: boolean;
    signIn?: AuthError;
    resetForEmail?: AuthError;
    updateUser?: AuthError;
    resend?: AuthError;
    verifyOtp?: AuthError;
    exchangeCode?: AuthError;
    user?: { id: string; email_confirmed_at?: string | null } | null;
  } = {},
) {
  const ok = { error: null };
  return {
    auth: {
      signUp: vi.fn(async () => ({
        data: overrides.signUpSession ? { session: { access_token: "t" } } : {},
        error: overrides.signUp ?? null,
      })),
      signInWithPassword: vi.fn(async () => ({
        data: {},
        error: overrides.signIn ?? null,
      })),
      resetPasswordForEmail: vi.fn(async () => ({
        data: {},
        error: overrides.resetForEmail ?? null,
      })),
      updateUser: vi.fn(async () => ({
        data: {},
        error: overrides.updateUser ?? null,
      })),
      resend: vi.fn(async () => ({
        data: {},
        error: overrides.resend ?? null,
      })),
      verifyOtp: vi.fn(async () => ({
        data: {},
        error: overrides.verifyOtp ?? null,
      })),
      exchangeCodeForSession: vi.fn(async () => ({
        data: {},
        error: overrides.exchangeCode ?? null,
      })),
      signOut: vi.fn(async () => ok),
      getUser: vi.fn(async () => ({
        data: { user: overrides.user ?? null },
        error: overrides.user ? null : { message: "no session" },
      })),
    },
  };
}
