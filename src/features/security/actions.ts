"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionId, requireUser } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { sendToMember } from "@/lib/email/send";
import { twoFactorCodeEmail } from "@/lib/email/templates";
import {
  CODE_TTL_MINUTES,
  MAX_CODES_PER_HOUR,
  MAX_WRONG_CODES,
  RESEND_COOLDOWN_SECONDS,
  WRONG_CODE_WINDOW_MINUTES,
  maskEmail,
} from "@/lib/auth/mfa";
import {
  codesMatch,
  generateCode,
  isTwoFactorConfigured,
  markVerified,
  readChallenge,
  startChallenge,
} from "@/lib/auth/two-factor";
import { emailCodeSchema, reauthSchema, type SecurityFormState } from "@/features/security/schemas";

/**
 * Account-security actions. A code is generated here, emailed to the member's own verified
 * address, and kept only as a keyed digest inside a signed cookie (see two-factor.ts); it is never
 * returned to the browser, logged, or stored in the database. Sending and wrong guesses are
 * limited per member in the database, where a member cannot erase the record.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const BAD_CODE = "That code didn't work. Check the newest email and try again.";
const REAUTH_PASSWORD = "That password isn't right.";

type Fail = { ok: false; error: string };
type Result<T extends object = object> = ({ ok: true } & T) | Fail;
const fail = (error: string): Fail => ({ ok: false, error });

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function countEvents(kind: "send" | "failure", sinceMinutes: number, userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("two_factor_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", kind)
    .gte("at", minutesAgo(sinceMinutes));
  // If the log cannot be read, refuse rather than allow unlimited attempts.
  if (error) throw new Error("two_factor_events_unavailable");
  return count ?? 0;
}

async function logEvent(kind: "send" | "failure", userId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("two_factor_events").insert({ user_id: userId, kind });
  if (error) reportError("two_factor_events.insert", error);
}

/** Emails a fresh 6-digit code to the signed-in member's own address. */
export async function sendEmailCode(): Promise<Result<{ sentTo: string; minutes: number }>> {
  const user = await requireUser({ mfa: "skip" });
  if (!isTwoFactorConfigured()) return fail("Email codes aren't set up on this server yet.");
  const sessionId = await getSessionId();
  if (!sessionId || !user.email) return fail(GENERIC_ERROR);

  const limited = await checkRateLimit("mfa", user.id);
  if (!limited.ok) return fail(limited.message);

  try {
    // One code per minute, five per hour.
    if ((await countEvents("send", RESEND_COOLDOWN_SECONDS / 60, user.id)) > 0) {
      return fail("A code was just sent. Please wait a minute before asking for another.");
    }
    if ((await countEvents("send", 60, user.id)) >= MAX_CODES_PER_HOUR) {
      return fail("Too many codes requested. Please try again in a while.");
    }
  } catch (error) {
    reportError("two_factor.limits", error);
    return fail(GENERIC_ERROR);
  }

  const code = generateCode();
  const result = await sendToMember(
    user,
    twoFactorCodeEmail({ firstName: String(user.user_metadata?.first_name ?? ""), code, minutes: CODE_TTL_MINUTES }),
    "security",
  );
  if (result.status !== "sent") {
    return fail("We couldn't send the email right now. Please try again in a few minutes.");
  }

  // Only after the email left: the challenge cookie and the log entry.
  await startChallenge(user.id, sessionId, code);
  await logEvent("send", user.id);
  return { ok: true, sentTo: maskEmail(user.email), minutes: CODE_TTL_MINUTES };
}

/** Checks the code. On success the sign-in is confirmed and the member continues where they were going. */
export async function verifyEmailCode(
  _prev: SecurityFormState,
  formData: FormData,
): Promise<SecurityFormState> {
  const user = await requireUser({ mfa: "skip" });
  const next = formData.get("next");
  const parsed = emailCodeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { status: "error", message: parsed.error.issues[0]?.message ?? BAD_CODE };
  if (!isTwoFactorConfigured()) return { status: "error", message: "Email codes aren't set up on this server yet." };
  const sessionId = await getSessionId();
  if (!sessionId) return { status: "error", message: GENERIC_ERROR };

  try {
    if ((await countEvents("failure", WRONG_CODE_WINDOW_MINUTES, user.id)) >= MAX_WRONG_CODES) {
      return { status: "error", message: "Too many wrong codes. Please wait 15 minutes and request a new code." };
    }
  } catch (error) {
    reportError("two_factor.limits", error);
    return { status: "error", message: GENERIC_ERROR };
  }

  const challenge = await readChallenge(user.id, sessionId);
  if (!challenge) {
    return { status: "error", message: "That code has expired. Ask for a new one." };
  }
  if (!codesMatch(challenge.h, user.id, sessionId, parsed.data)) {
    await logEvent("failure", user.id);
    return { status: "error", message: BAD_CODE };
  }

  await markVerified(user.id, sessionId);
  redirect(safeNextPath(typeof next === "string" ? next : null));
}

/** Confirms the member's password again, which counts as a fresh sign-in. */
export async function reauthenticate(
  _prev: SecurityFormState,
  formData: FormData,
): Promise<SecurityFormState> {
  const user = await requireUser();
  const parsed = reauthSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success || !user.email) return { status: "error", message: "Enter your password." };
  const limited = await checkRateLimit("mfa", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.password });
  if (error) return { status: "error", message: REAUTH_PASSWORD };

  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null, "/settings/security"));
}

export async function signOutOtherDevices(): Promise<Result> {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) return fail(GENERIC_ERROR);
  return { ok: true };
}

export async function signOutEverywhere(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login");
}
