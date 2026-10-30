import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  VERIFIED_DAYS,
} from "@/lib/auth/mfa";

/**
 * Email sign-in codes, without storing any code anywhere.
 *
 * Supabase has no "email second factor", so Medyra does it itself and keeps the proof in two
 * signed, HttpOnly cookies. Both are signed with TWO_FACTOR_SECRET (server-only), which a member
 * does not have, so neither can be forged or edited in the browser:
 *
 *   medyra-2fa-c  the challenge: a keyed digest of the code that was emailed, tied to the member
 *                 and the sign-in session, valid for 10 minutes.
 *   medyra-2fa    the proof: "this member, in this sign-in session, entered the code", valid until
 *                 the session ends (or 7 days). A new sign-in has a new session id, so it needs a
 *                 new code.
 *
 * Wrong guesses are counted in the database (two_factor_events), where a member can add rows
 * but never remove them, so guessing is limited to 5 tries per 15 minutes.
 */

export const VERIFIED_COOKIE = "medyra-2fa";
export const CHALLENGE_COOKIE = "medyra-2fa-c";

type Env = Record<string, string | undefined>;

/** Both the signing secret (32+ characters) and email delivery must exist, or the step is skipped. */
export function isTwoFactorConfigured(env: Env = process.env): boolean {
  return (
    (env.TWO_FACTOR_SECRET?.length ?? 0) >= 32 &&
    Boolean(env.RESEND_API_KEY) &&
    Boolean(env.EMAIL_FROM)
  );
}

const secret = () => process.env.TWO_FACTOR_SECRET ?? "";
const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const mac = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function sign(payload: object): string {
  const body = b64(JSON.stringify(payload));
  return `${body}.${mac(body)}`;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** The payload, or null if the token is malformed, tampered with, or was not signed with our secret. */
export function read<T extends object>(token: string | undefined): T | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), mac(body))) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** Keyed digest of a code for one member and session. Useless without the secret. */
export function codeDigest(userId: string, sessionId: string, code: string): string {
  return mac(`code:${userId}:${sessionId}:${code}`);
}

export const codesMatch = (expectedDigest: string, userId: string, sessionId: string, code: string) =>
  safeEqual(expectedDigest, codeDigest(userId, sessionId, code));

const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: maxAgeSeconds,
});

type Verified = { t: "v"; u: string; s: string; e: number };
export type Challenge = { t: "c"; u: string; s: string; h: string; e: number };

export async function isVerified(userId: string, sessionId: string, now = Date.now()): Promise<boolean> {
  const jar = await cookies();
  const payload = read<Verified>(jar.get(VERIFIED_COOKIE)?.value);
  return Boolean(payload && payload.t === "v" && payload.u === userId && payload.s === sessionId && payload.e > now);
}

export async function markVerified(userId: string, sessionId: string): Promise<void> {
  const jar = await cookies();
  const seconds = VERIFIED_DAYS * 24 * 60 * 60;
  jar.set(VERIFIED_COOKIE, sign({ t: "v", u: userId, s: sessionId, e: Date.now() + seconds * 1000 } satisfies Verified), cookieOptions(seconds));
  jar.delete(CHALLENGE_COOKIE);
}

export async function startChallenge(userId: string, sessionId: string, code: string): Promise<void> {
  const jar = await cookies();
  const seconds = CODE_TTL_MINUTES * 60;
  const challenge: Challenge = {
    t: "c",
    u: userId,
    s: sessionId,
    h: codeDigest(userId, sessionId, code),
    e: Date.now() + seconds * 1000,
  };
  jar.set(CHALLENGE_COOKIE, sign(challenge), cookieOptions(seconds));
}

export async function readChallenge(userId: string, sessionId: string, now = Date.now()): Promise<Challenge | null> {
  const jar = await cookies();
  const payload = read<Challenge>(jar.get(CHALLENGE_COOKIE)?.value);
  if (!payload || payload.t !== "c" || payload.u !== userId || payload.s !== sessionId || payload.e <= now) return null;
  return payload;
}

export async function clearTwoFactorCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(VERIFIED_COOKIE);
  jar.delete(CHALLENGE_COOKIE);
}
