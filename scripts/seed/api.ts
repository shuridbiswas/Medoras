import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SeedTarget } from "./safety.ts";

/** Thin helpers over Supabase's public HTTP APIs, using only the publishable key and a member's own session. */

export type ApiResult<T = unknown> = {
  status: number;
  json: T;
  headers: Headers;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Auth endpoints allow roughly 30 sign-ups/sign-ins per 5 minutes per IP; wait and retry on 429. */
async function withRateLimitRetry<T>(
  run: () => Promise<{ status: number } & T>,
  label: string,
): Promise<{ status: number } & T> {
  for (let attempt = 0; attempt < 14; attempt++) {
    const result = await run();
    if (result.status !== 429) return result;
    console.log(`  rate limited on ${label}; waiting 30s (attempt ${attempt + 1})`);
    await sleep(30_000);
  }
  throw new Error(`Still rate limited on ${label} after several minutes.`);
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export type Session = { id: string; token: string };

type AuthBody = {
  access_token?: string;
  user?: { id: string };
  error_code?: string;
  msg?: string;
};

async function authCall(target: SeedTarget, endpoint: string, body: unknown): Promise<ApiResult<AuthBody>> {
  return withRateLimitRetry(async () => {
    const response = await fetch(`${target.url}/auth/v1/${endpoint}`, {
      method: "POST",
      headers: { apikey: target.publishableKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, json: (await parse(response)) as AuthBody, headers: response.headers };
  }, endpoint.split("?")[0]);
}

export type SignUpResult =
  | { kind: "created"; session: Session }
  | { kind: "exists" }
  | { kind: "needs-confirmation" };

/** Registers through the supported Auth API. With email confirmation off (dev), a session comes back. */
export async function signUp(
  target: SeedTarget,
  input: { email: string; password: string; firstName: string; lastName: string },
): Promise<SignUpResult> {
  const result = await authCall(target, "signup", {
    email: input.email,
    password: input.password,
    data: { first_name: input.firstName, last_name: input.lastName },
  });
  if (result.status === 422 && /already/i.test(`${result.json?.error_code} ${result.json?.msg}`)) {
    return { kind: "exists" };
  }
  if (result.status !== 200) {
    throw new Error(`Sign-up failed for ${input.email}: HTTP ${result.status} ${result.json?.msg ?? ""}`);
  }
  if (!result.json.access_token || !result.json.user) return { kind: "needs-confirmation" };
  return { kind: "created", session: { id: result.json.user.id, token: result.json.access_token } };
}

export async function signIn(target: SeedTarget, email: string, password: string): Promise<Session | null> {
  const result = await authCall(target, "token?grant_type=password", { email, password });
  if (result.status !== 200 || !result.json.access_token || !result.json.user) return null;
  return { id: result.json.user.id, token: result.json.access_token };
}

export function memberClient(target: SeedTarget, token: string) {
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: target.publishableKey,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  });
  return {
    async rest<T = unknown>(
      method: string,
      table: string,
      options: { params?: Record<string, string>; body?: unknown; prefer?: string; extra?: Record<string, string> } = {},
    ): Promise<ApiResult<T>> {
      const query = options.params ? `?${new URLSearchParams(options.params).toString()}` : "";
      const response = await fetch(`${target.url}/rest/v1/${table}${query}`, {
        method,
        headers: headers({ ...(options.prefer ? { Prefer: options.prefer } : {}), ...options.extra }),
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      return { status: response.status, json: (await parse(response)) as T, headers: response.headers };
    },
    async upload(bucket: string, objectPath: string, data: Buffer, contentType: string): Promise<number> {
      const response = await fetch(`${target.url}/storage/v1/object/${bucket}/${objectPath}`, {
        method: "POST",
        headers: { apikey: target.publishableKey, Authorization: `Bearer ${token}`, "Content-Type": contentType },
        body: new Uint8Array(data),
      });
      return response.status;
    },
    async list(bucket: string, prefix: string): Promise<string[]> {
      const response = await fetch(`${target.url}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
      });
      const json = (await parse(response)) as { name: string }[] | null;
      return Array.isArray(json) ? json.map((o) => `${prefix}/${o.name}`) : [];
    },
    async remove(bucket: string, paths: string[]): Promise<number> {
      if (paths.length === 0) return 200;
      const response = await fetch(`${target.url}/storage/v1/object/${bucket}`, {
        method: "DELETE",
        headers: headers(),
        body: JSON.stringify({ prefixes: paths }),
      });
      return response.status;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// accounts.json: generated passwords live ONLY here (git-ignored). Never printed.
// ---------------------------------------------------------------------------------------------

export type StoredAccount = {
  slug: string;
  email: string;
  password: string;
  username: string | null;
  id: string;
};
export type AccountsFile = { project: string; accounts: StoredAccount[] };

export const OUTPUT_DIR = path.join(process.cwd(), "scripts", ".seed-output");
export const ACCOUNTS_FILE = path.join(OUTPUT_DIR, "accounts.json");

export function readAccounts(ref: string): AccountsFile {
  if (!existsSync(ACCOUNTS_FILE)) return { project: ref, accounts: [] };
  const file = JSON.parse(readFileSync(ACCOUNTS_FILE, "utf8")) as AccountsFile;
  if (file.project !== ref) {
    throw new Error("accounts.json belongs to a different Supabase project. Remove it or fix SEED_ALLOWED_PROJECT_REF.");
  }
  return file;
}

export function writeAccounts(file: AccountsFile): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(file, null, 2), { mode: 0o600 });
}

export function removeAccountsFile(): void {
  rmSync(ACCOUNTS_FILE, { force: true });
}
