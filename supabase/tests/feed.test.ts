// @vitest-environment node
//
// Phase 4 feed policies, run against the real migrations in an in-memory Postgres (PGlite).
// Validates our SQL and row level security; it does not replace testing against a live project.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDir = path.resolve(import.meta.dirname, "../migrations");

const supabaseStubs = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  revoke all on auth.users from anon, authenticated;
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

let db: PGlite;
const alice = "00000000-0000-0000-0000-00000000000a";
const bob = "00000000-0000-0000-0000-00000000000b";
const carol = "00000000-0000-0000-0000-00000000000c"; // has not finished onboarding

async function asUser(id: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id ?? ""]);
  await db.exec(id ? "set role authenticated" : "set role anon");
}
const asAdmin = () => db.exec("reset role");

async function failure(sql: string, params: unknown[] = []) {
  try {
    await db.query(sql, params);
  } catch (error) {
    return (error as Error).message;
  }
  return null;
}

async function newPost(author: string, body = "Hello community", category = "general_discussion") {
  await asUser(author);
  const r = await db.query<{ id: string }>(
    "insert into public.posts (author_id, category, body) values ($1, $2, $3) returning id",
    [author, category, body],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(supabaseStubs);
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  for (const [id, name] of [[alice, "Alice"], [bob, "Bob"], [carol, "Carol"]] as const) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `${name.toLowerCase()}@example.com`,
      JSON.stringify({ first_name: name }),
    ]);
  }
  for (const [id, username] of [[alice, "alice_a"], [bob, "bob_b"]] as const) {
    await db.query(
      `update public.profiles set username = $2, member_type = 'educator', fields = array['nursing'],
         career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1`,
      [id, username],
    );
  }
});

afterAll(async () => {
  await db.close();
});

describe("posts: access", () => {
  it("blocks anonymous visitors", async () => {
    await asUser(null);
    expect(await failure("select * from public.posts")).toMatch(/permission denied/i);
    expect(
      await failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'x')", [alice]),
    ).toMatch(/permission denied/i);
  });

  it("lets a member publish and lets other members read it", async () => {
    const id = await newPost(alice, "First post", "career_journey");
    await asUser(bob);
    const rows = await db.query<{ id: string; author_id: string }>("select id, author_id from public.posts");
    expect(rows.rows).toEqual([{ id, author_id: alice }]);
  });

  it("rejects a post written in someone else's name", async () => {
    await asUser(alice);
    expect(
      await failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'spoof')", [bob]),
    ).toMatch(/row-level security/i);
  });

  it("keeps members who have not finished onboarding out of the feed", async () => {
    await asUser(carol);
    expect((await db.query("select * from public.posts")).rows).toHaveLength(0);
    expect(
      await failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'hi')", [carol]),
    ).toMatch(/row-level security/i);
  });
});

describe("posts: validation", () => {
  it.each([
    ["an unknown category", "bogus", "text"],
    ["an empty body", "questions", ""],
    ["a whitespace-only body", "questions", "   \n  "],
    ["a body over 3000 characters", "questions", "x".repeat(3001)],
  ])("rejects %s", async (_label, category, body) => {
    await asUser(alice);
    expect(
      await failure("insert into public.posts (author_id, category, body) values ($1, $2, $3)", [alice, category, body]),
    ).toMatch(/check constraint|violates/i);
  });

  it("accepts a body of exactly 3000 characters", async () => {
    await asUser(alice);
    expect(
      await failure("insert into public.posts (author_id, category, body) values ($1, 'questions', $2)", [alice, "x".repeat(3000)]),
    ).toBeNull();
  });

  it("applies all seven categories", async () => {
    for (const c of [
      "general_discussion", "academic_life", "career_journey", "professional_advice",
      "research_knowledge", "personal_achievement", "questions",
    ]) {
      expect(await newPost(bob, `About ${c}`, c)).toBeTruthy();
    }
  });
});

describe("posts: ownership", () => {
  it("lets the author edit and records that it was edited", async () => {
    const id = await newPost(alice, "Original");
    await asUser(alice);
    const before = await db.query<{ edited_at: string | null }>("select edited_at from public.posts where id = $1", [id]);
    expect(before.rows[0].edited_at).toBeNull();
    await db.query("update public.posts set body = 'Changed' where id = $1", [id]);
    const after = await db.query<{ body: string; edited_at: string | null }>(
      "select body, edited_at from public.posts where id = $1",
      [id],
    );
    expect(after.rows[0].body).toBe("Changed");
    expect(after.rows[0].edited_at).not.toBeNull();
  });

  it("does not let another member edit or delete it (zero rows affected)", async () => {
    const id = await newPost(alice, "Mine");
    await asUser(bob);
    const upd = await db.query("update public.posts set body = 'Hijacked' where id = $1 returning id", [id]);
    expect(upd.rows).toHaveLength(0);
    const del = await db.query("delete from public.posts where id = $1 returning id", [id]);
    expect(del.rows).toHaveLength(0);
    await asAdmin();
    const row = await db.query<{ body: string }>("select body from public.posts where id = $1", [id]);
    expect(row.rows[0].body).toBe("Mine");
  });

  it("does not let the author reassign the post or change its timestamps", async () => {
    const id = await newPost(alice, "Stay put");
    await asUser(alice);
    expect(await failure("update public.posts set author_id = $2 where id = $1", [id, bob])).toMatch(/permission denied/i);
    expect(await failure("update public.posts set created_at = now() - interval '1 year' where id = $1", [id])).toMatch(
      /permission denied/i,
    );
  });

  it("lets the author delete the post, taking its likes and comments with it", async () => {
    const id = await newPost(alice, "Short lived");
    await asUser(bob);
    await db.query("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, bob]);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [id, bob]);
    await asUser(alice);
    expect((await db.query("delete from public.posts where id = $1 returning id", [id])).rows).toHaveLength(1);
    await asAdmin();
    expect((await db.query("select 1 from public.post_likes where post_id = $1", [id])).rows).toHaveLength(0);
    expect((await db.query("select 1 from public.post_comments where post_id = $1", [id])).rows).toHaveLength(0);
  });
});

describe("likes", () => {
  it("allows one like per member and rejects a duplicate", async () => {
    const id = await newPost(alice, "Like me");
    await asUser(bob);
    expect(await failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, bob])).toBeNull();
    expect(await failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, bob])).toMatch(
      /duplicate key/i,
    );
  });

  it("rejects a like on behalf of someone else and a like for a missing post", async () => {
    const id = await newPost(alice, "Not for forging");
    await asUser(bob);
    expect(await failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, alice])).toMatch(
      /row-level security/i,
    );
    expect(
      await failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [
        "11111111-1111-1111-1111-111111111111",
        bob,
      ]),
    ).toMatch(/foreign key/i);
  });

  it("lets members remove only their own like", async () => {
    const id = await newPost(alice, "Toggle");
    await asUser(bob);
    await db.query("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, bob]);
    await asUser(alice);
    expect((await db.query("delete from public.post_likes where post_id = $1 and user_id = $2 returning 1", [id, bob])).rows).toHaveLength(0);
    await asUser(bob);
    expect((await db.query("delete from public.post_likes where post_id = $1 and user_id = $2 returning 1", [id, bob])).rows).toHaveLength(1);
  });

  it("counts likes accurately", async () => {
    const id = await newPost(alice, "Count me");
    for (const u of [alice, bob]) {
      await asUser(u);
      await db.query("insert into public.post_likes (post_id, user_id) values ($1, $2)", [id, u]);
    }
    const n = await db.query<{ n: string }>("select count(*) as n from public.post_likes where post_id = $1", [id]);
    expect(Number(n.rows[0].n)).toBe(2);
  });
});

describe("comments", () => {
  it("lets members comment as themselves and read each other's comments", async () => {
    const id = await newPost(alice, "Discuss");
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'Great point')", [id, bob]);
    await asUser(alice);
    const rows = await db.query<{ body: string; author_id: string }>(
      "select body, author_id from public.post_comments where post_id = $1",
      [id],
    );
    expect(rows.rows).toEqual([{ body: "Great point", author_id: bob }]);
  });

  it("rejects forged authors, empty, over-long and unauthenticated comments", async () => {
    const id = await newPost(alice, "Rules");
    await asUser(bob);
    expect(await failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'x')", [id, alice])).toMatch(
      /row-level security/i,
    );
    expect(await failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, '  ')", [id, bob])).toMatch(
      /check constraint/i,
    );
    expect(
      await failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, $3)", [id, bob, "x".repeat(1001)]),
    ).toMatch(/check constraint/i);
    await asUser(carol);
    expect(await failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [id, carol])).toMatch(
      /row-level security/i,
    );
  });

  it("lets only the author delete a comment, and does not allow edits", async () => {
    const id = await newPost(alice, "Moderation-free zone");
    await asUser(bob);
    const c = await db.query<{ id: string }>(
      "insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'mine') returning id",
      [id, bob],
    );
    const cid = c.rows[0].id;
    expect(await failure("update public.post_comments set body = 'edited' where id = $1", [cid])).toMatch(/permission denied/i);
    await asUser(alice); // even the post's author cannot delete someone else's comment
    expect((await db.query("delete from public.post_comments where id = $1 returning 1", [cid])).rows).toHaveLength(0);
    await asUser(bob);
    expect((await db.query("delete from public.post_comments where id = $1 returning 1", [cid])).rows).toHaveLength(1);
  });
});

describe("abuse limits and ordering", () => {
  it("limits posts to 20 per author per hour", async () => {
    await asAdmin();
    await db.query("delete from public.posts where author_id = $1", [carol]);
    await db.query(
      "update public.profiles set onboarding_completed = true, username = 'carol_c', member_type = 'educator', fields = array['nursing'], career_stage = 'mid_career', country = 'CA' where id = $1",
      [carol],
    );
    await asUser(carol);
    for (let i = 0; i < 20; i++) {
      await db.query("insert into public.posts (author_id, category, body) values ($1, 'questions', $2)", [carol, `n${i}`]);
    }
    expect(await failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'one too many')", [carol])).toMatch(
      /too quickly/i,
    );
  });

  it("serves a newest-first feed with a stable keyset order", async () => {
    await asAdmin();
    await db.query("delete from public.posts");
    await db.query(
      `insert into public.posts (author_id, category, body, created_at) values
         ($1, 'questions', 'oldest', now() - interval '3 days'),
         ($1, 'questions', 'middle', now() - interval '2 days'),
         ($2, 'questions', 'newest', now() - interval '1 day')`,
      [alice, bob],
    );
    await asUser(bob);
    const rows = await db.query<{ body: string }>("select body from public.posts order by created_at desc, id desc");
    expect(rows.rows.map((r) => r.body)).toEqual(["newest", "middle", "oldest"]);
    const plan = await db.query<{ "QUERY PLAN": string }>(
      "select count(*) from pg_indexes where tablename = 'posts' and indexname in ('posts_feed_idx', 'posts_category_feed_idx', 'posts_author_feed_idx')",
    );
    expect(plan.rows).toBeTruthy();
  });
});
