// Shared set-up for the database policy tests: the real migrations run in an in-memory
// Postgres (PGlite) with small stand-ins for Supabase's `auth` and `storage` schemas.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const migrationsDir = path.resolve(import.meta.dirname, "../migrations");

export const supabaseStubs = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create table auth.mfa_factors (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    factor_type text not null default 'totp',
    status text not null default 'verified'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
  $$;
  grant usage on schema auth to anon, authenticated;
  revoke all on auth.users from anon, authenticated;
  revoke all on auth.mfa_factors from anon, authenticated;
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  grant usage on schema storage to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant usage on schema public to anon, authenticated;
`;

export const ids = {
  alice: "00000000-0000-0000-0000-00000000000a",
  bob: "00000000-0000-0000-0000-00000000000b",
  carol: "00000000-0000-0000-0000-00000000000c",
  dave: "00000000-0000-0000-0000-00000000000d", // has not finished onboarding
  admin: "00000000-0000-0000-0000-0000000000ad",
} as const;

export type Harness = Awaited<ReturnType<typeof createHarness>>;

export async function createHarness() {
  const db = new PGlite();
  await db.exec(supabaseStubs);
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  const people: [string, string, string | null][] = [
    [ids.alice, "Alice", "alice_a"],
    [ids.bob, "Bob", "bob_b"],
    [ids.carol, "Carol", "carol_c"],
    [ids.dave, "Dave", null],
    [ids.admin, "Admin", "admin_x"],
  ];
  for (const [id, name, username] of people) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `${name.toLowerCase()}@example.com`,
      JSON.stringify({ first_name: name }),
    ]);
    if (username) {
      await db.query(
        `update public.profiles set username = $2, member_type = 'educator', fields = array['nursing'],
           career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1`,
        [id, username],
      );
    }
  }
  await db.query("insert into public.staff_roles (user_id, role) values ($1, 'admin')", [ids.admin]);

  /** Act as a member. `aal` is the assurance level of the session ("aal1" until a second factor passes). */
  async function asUser(id: string | null, aal: "aal1" | "aal2" = "aal1") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
    await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ aal })]);
    await db.exec(id ? "set role authenticated" : "set role anon");
  }
  const asOwner = () => db.exec("reset role");

  async function failure(sql: string, params: unknown[] = []) {
    try {
      await db.query(sql, params);
    } catch (error) {
      return (error as Error).message;
    }
    return null;
  }
  const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows;

  async function newPost(author: string, body = "Hello community") {
    await asUser(author);
    const r = await db.query<{ id: string }>(
      "insert into public.posts (author_id, category, body) values ($1, 'general_discussion', $2) returning id",
      [author, body],
    );
    return r.rows[0].id;
  }

  async function newComment(post: string, author: string, body = "A comment") {
    await asUser(author);
    const r = await db.query<{ id: string }>(
      "insert into public.post_comments (post_id, author_id, body) values ($1, $2, $3) returning id",
      [post, author, body],
    );
    return r.rows[0].id;
  }

  /** Wipe everything the tests create, between tests. */
  async function reset() {
    await asOwner();
    // audit_logs is append-only on purpose; the owner removes the trigger's effect by truncating.
    await db.exec(`
      alter table public.audit_logs disable trigger audit_logs_append_only;
      delete from public.audit_logs;
      alter table public.audit_logs enable trigger audit_logs_append_only;
      delete from public.mfa_recovery_codes;
      delete from public.mfa_recovery_attempts;
      delete from public.consent_records;
      delete from public.data_requests;
      delete from auth.mfa_factors;
      update public.profiles set profile_visibility = 'members', directory_listed = true;
      delete from public.profile_education;
      delete from public.profile_skills;
      delete from public.appeals;
      delete from public.moderation_actions;
      delete from public.member_notices;
      delete from public.reports;
      delete from public.member_status;
      delete from public.member_mutes;
      delete from public.notifications;
      delete from public.saved_items;
      delete from public.follows;
      delete from public.connections;
      delete from public.member_blocks;
      delete from public.posts;
      delete from public.notification_preferences;
    `);
  }

  return { db, asUser, asOwner, failure, rows, newPost, newComment, reset };
}
