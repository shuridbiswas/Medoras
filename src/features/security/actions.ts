"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRecentAuth, requireUser } from "@/lib/auth/session";
import { mfaMode } from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { sendToMember } from "@/lib/email/send";
import { securityNotificationEmail, type SecurityEvent } from "@/lib/email/templates";
import type { User } from "@supabase/supabase-js";
import {
  factorIdSchema,
  reauthSchema,
  recoveryCodeSchema,
  totpCodeSchema,
  type SecurityFormState,
} from "@/features/security/schemas";
import { generateRecoveryCodes, hashRecoveryCode } from "@/features/security/recovery";

/**
 * Account-security actions. None of them ever logs or returns a secret except the two values the
 * member must see once: the authenticator setup secret and the recovery codes.
 *
 * Sensitive changes (removing an authenticator, new recovery codes) need a recent sign-in. When
 * the sign-in is older they return { reauth: true } and the page sends the member to /reauth.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const BAD_CODE = "That code didn't work. Check the clock on your phone and try again.";
const REAUTH = "For your security, please confirm your password first.";

type Fail = { ok: false; error: string; reauth?: boolean };
type Result<T extends object = object> = ({ ok: true } & T) | Fail;

const fail = (error: string, reauth = false): Fail => (reauth ? { ok: false, error, reauth } : { ok: false, error });

/** Best effort: a failure to email never blocks the change. */
async function notify(user: User, event: SecurityEvent) {
  await sendToMember(
    user,
    securityNotificationEmail({ firstName: String(user.user_metadata?.first_name ?? ""), event }),
    "security",
  );
}

async function limited(userId: string): Promise<string | null> {
  const result = await checkRateLimit("mfa", userId);
  return result.ok ? null : result.message;
}

/** Starts adding an authenticator app. Returns what the member needs to scan or type in. */
export async function startTotpEnrollment(): Promise<Result<{ factorId: string; qrCode: string; secret: string }>> {
  const user = await requireUser({ mfa: "allow-enrollment" });
  const tooMany = await limited(user.id);
  if (tooMany) return fail(tooMany);

  const supabase = await createClient();
  // An abandoned, never-verified setup would block a new one with the same name; clear it first.
  const existing = await supabase.auth.mfa.listFactors();
  for (const factor of existing.data?.all ?? []) {
    if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Authenticator app",
  });
  if (error || !data) {
    reportError("mfa.enroll", error);
    return fail(
      error?.message?.toLowerCase().includes("enabled")
        ? "Authenticator apps are not turned on for this project yet. Ask the Medyra team."
        : GENERIC_ERROR,
    );
  }
  return { ok: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Finishes setup: the member proves the app works by entering a current code. */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<Result> {
  const user = await requireUser({ mfa: "allow-enrollment" });
  const id = factorIdSchema.safeParse(factorId);
  const parsed = totpCodeSchema.safeParse(code);
  if (!id.success || !parsed.success) return fail(parsed.success ? GENERIC_ERROR : (parsed.error.issues[0]?.message ?? GENERIC_ERROR));
  const tooMany = await limited(user.id);
  if (tooMany) return fail(tooMany);

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id.data, code: parsed.data });
  if (error) return fail(BAD_CODE);

  await notify(user, "mfa_added");
  revalidatePath("/settings/security");
  return { ok: true };
}

/** The sign-in challenge. On success the member continues to where they were going. */
export async function verifyMfaChallenge(
  _prev: SecurityFormState,
  formData: FormData,
): Promise<SecurityFormState> {
  const user = await requireUser({ mfa: "skip" });
  const next = formData.get("next");
  const parsed = totpCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? BAD_CODE };
  }
  const tooMany = await limited(user.id);
  if (tooMany) return { status: "error", message: tooMany };

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp?.[0];
  if (!factor) return { status: "error", message: "No authenticator app is set up. Use a recovery code instead." };

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: parsed.data });
  if (error) return { status: "error", message: BAD_CODE };
  redirect(safeNextPath(typeof next === "string" ? next : null));
}

/** Removes an authenticator. Needs a recent sign-in, and never the last one while MFA is required. */
export async function removeFactor(factorId: string): Promise<Result> {
  const user = await requireUser({ mfa: "allow-enrollment" });
  const id = factorIdSchema.safeParse(factorId);
  if (!id.success) return fail(GENERIC_ERROR);
  if (!isRecentAuth(user)) return fail(REAUTH, true);

  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp ?? [];
  if (mfaMode() === "required" && verified.length <= 1 && verified.some((f) => f.id === id.data)) {
    return fail("MFA is required on Medyra. Add a second authenticator before removing this one.");
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: id.data });
  if (error) {
    reportError("mfa.unenroll", error);
    return fail(GENERIC_ERROR);
  }
  await notify(user, "mfa_removed");
  revalidatePath("/settings/security");
  return { ok: true };
}

/**
 * Creates a fresh set of recovery codes (replacing any old ones). Only hashes are stored; the
 * codes themselves are returned once. The database refuses this unless the session passed MFA.
 */
export async function createRecoveryCodes(): Promise<Result<{ codes: string[] }>> {
  const user = await requireUser({ mfa: "enforce" });
  if (!isRecentAuth(user)) return fail(REAUTH, true);

  const codes = generateRecoveryCodes();
  const supabase = await createClient();
  const removed = await supabase.from("mfa_recovery_codes").delete().eq("user_id", user.id);
  if (removed.error) {
    reportError("mfa_recovery_codes.delete", removed.error);
    return fail(GENERIC_ERROR);
  }
  const { error } = await supabase
    .from("mfa_recovery_codes")
    .insert(codes.map((code) => ({ user_id: user.id, code_hash: hashRecoveryCode(code) })));
  if (error) {
    reportError("mfa_recovery_codes.insert", error);
    return fail(GENERIC_ERROR);
  }
  revalidatePath("/settings/security");
  return { ok: true, codes };
}

/**
 * Lost your device? A recovery code removes the authenticator so the member can sign in and set
 * up a new one. Wrong codes are rate-limited in the database as well.
 */
export async function redeemRecoveryCode(
  _prev: SecurityFormState,
  formData: FormData,
): Promise<SecurityFormState> {
  const user = await requireUser({ mfa: "skip" });
  const parsed = recoveryCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const tooMany = await limited(user.id);
  if (tooMany) return { status: "error", message: tooMany };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_mfa_recovery_code", { p_code: parsed.data });
  if (error) {
    return {
      status: "error",
      message: /too many/i.test(error.message) ? "Too many attempts. Please try again later." : GENERIC_ERROR,
    };
  }
  if (!data) return { status: "error", message: "That recovery code didn't work, or it was already used." };

  await notify(user, "mfa_recovery_used");
  redirect("/settings/security?setup=1&recovered=1");
}

/** Confirms the member's password again, which counts as a fresh sign-in. */
export async function reauthenticate(
  _prev: SecurityFormState,
  formData: FormData,
): Promise<SecurityFormState> {
  const user = await requireUser({ mfa: "allow-enrollment" });
  const parsed = reauthSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success || !user.email) {
    return { status: "error", message: "Enter your password." };
  }
  const tooMany = await limited(user.id);
  if (tooMany) return { status: "error", message: tooMany };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (error) return { status: "error", message: "That password isn't right." };

  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null, "/settings/security"));
}

export async function signOutOtherDevices(): Promise<Result> {
  await requireUser({ mfa: "allow-enrollment" });
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return fail(GENERIC_ERROR);
  return { ok: true };
}

export async function signOutEverywhere(): Promise<void> {
  await requireUser({ mfa: "allow-enrollment" });
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
