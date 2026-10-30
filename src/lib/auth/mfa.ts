/**
 * Multi-factor authentication policy (Supabase Auth TOTP).
 *
 * MFA_ENFORCEMENT (server-only environment variable) controls how strict Medyra is:
 *   - "required"  (default) every member needs an authenticator app. Members without one are sent to a
 *                 setup page (they are never locked out: they can enroll, or sign out). Members with
 *                 one must pass it at sign-in.
 *   - "challenge" members who have enrolled must pass it at sign-in; nobody is forced to enroll.
 *                 Use this to roll MFA out gradually, or as the emergency switch if the project's
 *                 TOTP setting is turned off.
 *   - "off"       nothing is enforced (local development and automated tests only).
 *
 * Administrators always need a second factor, whatever this is set to (see requireAdmin).
 */

export type MfaMode = "off" | "challenge" | "required";

export function mfaMode(env: Record<string, string | undefined> = process.env): MfaMode {
  const value = env.MFA_ENFORCEMENT?.trim().toLowerCase();
  return value === "off" || value === "challenge" || value === "required" ? value : "required";
}

export type AssuranceLevel = "aal1" | "aal2";

export type MfaState = {
  /** The member has at least one verified authenticator. */
  enrolled: boolean;
  /** What this session has proven so far. */
  level: AssuranceLevel;
};

export type MfaGate = "ok" | "challenge" | "enroll";

/** What a member must do next under `mode`. Pure, so the policy can be tested on its own. */
export function evaluateMfa(mode: MfaMode, state: MfaState): MfaGate {
  if (mode === "off") return "ok";
  if (state.enrolled) return state.level === "aal2" ? "ok" : "challenge";
  return mode === "required" ? "enroll" : "ok";
}

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
