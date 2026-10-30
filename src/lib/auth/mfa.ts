/**
 * Two-step sign-in policy: after the password, a member proves they can read their email by
 * entering a 6-digit code we send there (see two-factor.ts for how the proof is kept).
 *
 * MFA_ENFORCEMENT (server-only environment variable):
 *   - "required" (default; anything but "off"): every new sign-in must be confirmed with an
 *     emailed code before the member can use the app.
 *   - "off": nothing is enforced (local development and automated tests only).
 *
 * The step only works when email delivery and a signing secret are configured (see
 * isTwoFactorConfigured). If they are not, members are NOT locked out: the step is skipped for
 * them (and /api/health shows twoFactorEmail: false). Administrators are the exception: they must
 * always pass it, so the admin area stays closed until it is configured.
 */

export type MfaMode = "off" | "required";

export function mfaMode(env: Record<string, string | undefined> = process.env): MfaMode {
  return env.MFA_ENFORCEMENT?.trim().toLowerCase() === "off" ? "off" : "required";
}

export type TwoFactorState = {
  /** Email delivery and the signing secret are set up, so a code can be sent and checked. */
  configured: boolean;
  /** This sign-in session has already been confirmed with a code. */
  verified: boolean;
};

export type MfaGate = "ok" | "challenge";

/** What a member must do next. Pure, so the policy can be tested on its own. */
export function evaluateMfa(mode: MfaMode, state: TwoFactorState): MfaGate {
  if (mode === "off") return "ok";
  if (!state.configured) return "ok";
  return state.verified ? "ok" : "challenge";
}

/** Code and limit settings, shared by the server code and the pages that describe them. */
export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_WRONG_CODES = 5;
export const WRONG_CODE_WINDOW_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;
export const MAX_CODES_PER_HOUR = 5;
/** How long one confirmation lasts at most (it also ends when the sign-in session ends). */
export const VERIFIED_DAYS = 7;

/** A sign-in newer than this counts as a fresh authentication for sensitive actions. */
export const RECENT_AUTH_MINUTES = 10;

export function isRecentSignIn(
  lastSignInAt: string | null | undefined,
  now: number = Date.now(),
  minutes: number = RECENT_AUTH_MINUTES,
): boolean {
  if (!lastSignInAt) return false;
  const at = Date.parse(lastSignInAt);
  return Number.isFinite(at) && now - at >= 0 && now - at <= minutes * 60_000;
}

/** "amina@example.com" becomes "a•••a@example.com" so the page can say where the code went. */
export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "your email address";
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] ?? ""}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}
