// @vitest-environment node
//
// Phase 4b policies (connections, follows, blocks, saved items, notifications), run against the
// real migrations in an in-memory Postgres (PGlite). Validates our SQL and row level security; it
// does not replace testing against a live project.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

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
const carol = "00000000-0000-0000-0000-00000000000c";
const dave = "00000000-0000-0000-0000-00000000000d"; // has not finished onboarding

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

const rows = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  (await db.query<T>(sql, params)).rows;

async function request(from: string, to: string) {
  await asUser(from);
  const r = await db.query<{ id: string }>(
    "insert into public.connections (requester_id, addressee_id) values ($1, $2) returning id",
    [from, to],
  );
  return r.rows[0].id;
}

async function connect(a: string, b: string) {
  const id = await request(a, b);
  await asUser(b);
  await db.query("update public.connections set status = 'accepted' where id = $1", [id]);
  return id;
}

async function newPost(author: string, body = "Hello community") {
  await asUser(author);
  const r = await db.query<{ id: string }>(
    "insert into public.posts (author_id, category, body) values ($1, 'general_discussion', $2) returning id",
    [author, body],
  );
  return r.rows[0].id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(supabaseStubs);
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(path.join(migrationsDir, file), "utf8"));
  }
  for (const [id, name] of [[alice, "Alice"], [bob, "Bob"], [carol, "Carol"], [dave, "Dave"]] as const) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
      id,
      `${name.toLowerCase()}@example.com`,
      JSON.stringify({ first_name: name }),
    ]);
  }
  for (const [id, username] of [[alice, "alice_a"], [bob, "bob_b"], [carol, "carol_c"]] as const) {
    await db.query(
      `update public.profiles set username = $2, member_type = 'educator', fields = array['nursing'],
         career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1`,
      [id, username],
    );
  }
});

beforeEach(async () => {
  await asAdmin();
  await db.exec(`
    delete from public.notifications;
    delete from public.saved_items;
    delete from public.follows;
    delete from public.connections;
    delete from public.member_blocks;
    delete from public.posts;
    delete from public.notification_preferences;
  `);
});

afterAll(async () => {
  await db.close();
});

describe("access", () => {
  it("blocks anonymous visitors from every network table", async () => {
    await asUser(null);
    for (const table of ["connections", "follows", "member_blocks", "saved_items", "notifications"]) {
      expect(await failure(`select * from public.${table}`)).toMatch(/permission denied/i);
    }
  });

  it("keeps members who have not finished onboarding out", async () => {
    await asUser(dave);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [dave, alice]),
    ).toMatch(/row-level security/i);
    expect(
      await failure("insert into public.follows (follower_id, followee_id) values ($1, $2)", [dave, alice]),
    ).toMatch(/row-level security/i);
    expect(await rows("select * from public.connections")).toHaveLength(0);
  });

  it("does not expose the private schema beyond the two policy helpers", async () => {
    await asUser(alice);
    expect(await failure("select private.pair_blocked($1, $2)", [alice, bob])).toMatch(/permission denied/i);
    expect(await failure("select private.notify_post_comment()")).toMatch(/permission denied|trigger/i);
  });
});

describe("connection requests", () => {
  it("lets a member send a request that only the two people can see", async () => {
    const id = await request(alice, bob);
    expect((await rows("select id from public.connections")).map((r) => r)).toEqual([{ id }]);
    await asUser(bob);
    expect(await rows("select id from public.connections")).toEqual([{ id }]);
    await asUser(carol);
    expect(await rows("select id from public.connections")).toHaveLength(0);
  });

  it("rejects a request in someone else's name, to oneself, and to a missing or unfinished member", async () => {
    await asUser(alice);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [bob, carol]),
    ).toMatch(/row-level security/i);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $1)", [alice]),
    ).toMatch(/check constraint|row-level security/i);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, dave]),
    ).toMatch(/row-level security/i);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [
        alice,
        "11111111-1111-1111-1111-111111111111",
      ]),
    ).toMatch(/row-level security|foreign key/i);
  });

  it("rejects duplicates in either direction", async () => {
    await request(alice, bob);
    await asUser(alice);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, bob]),
    ).toMatch(/duplicate key/i);
    await asUser(bob);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [bob, alice]),
    ).toMatch(/duplicate key/i);
  });

  it("cannot be created already accepted", async () => {
    await asUser(alice);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id, status) values ($1, $2, 'accepted')", [
        alice,
        bob,
      ]),
    ).toMatch(/permission denied/i);
  });

  it("limits requests to 30 per member per hour", async () => {
    await asAdmin();
    for (let i = 0; i < 30; i++) {
      const id = `00000000-0000-0000-0000-0000000001${String(i).padStart(2, "0")}`;
      await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `bulk${i}@example.com`]);
      await db.query(
        `update public.profiles set username = $2, member_type = 'educator', fields = array['nursing'],
           career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1`,
        [id, `bulk_${i}`],
      );
      await db.query("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, id]);
    }
    await asUser(alice);
    expect(
      await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, bob]),
    ).toMatch(/too quickly/i);
  });
});

describe("answering and ending a connection", () => {
  it("lets only the addressee accept, and records when", async () => {
    const id = await request(alice, bob);
    await asUser(alice);
    expect((await db.query("update public.connections set status = 'accepted' where id = $1 returning id", [id])).rows).toHaveLength(0);
    await asUser(carol);
    expect((await db.query("update public.connections set status = 'accepted' where id = $1 returning id", [id])).rows).toHaveLength(0);
    await asUser(bob);
    expect((await db.query("update public.connections set status = 'accepted' where id = $1 returning id", [id])).rows).toHaveLength(1);
    const row = await rows<{ status: string; accepted_at: string | null }>(
      "select status, accepted_at from public.connections where id = $1",
      [id],
    );
    expect(row[0].status).toBe("accepted");
    expect(row[0].accepted_at).not.toBeNull();
  });

  it("does not let anyone change the parties or go back to pending", async () => {
    const id = await connect(alice, bob);
    await asUser(bob);
    expect(await failure("update public.connections set requester_id = $2 where id = $1", [id, carol])).toMatch(/permission denied/i);
    expect((await db.query("update public.connections set status = 'pending' where id = $1 returning id", [id])).rows).toHaveLength(0);
  });

  it("lets the addressee decline and the requester withdraw, but not a stranger", async () => {
    const a = await request(alice, bob);
    await asUser(carol);
    expect((await db.query("delete from public.connections where id = $1 returning 1", [a])).rows).toHaveLength(0);
    await asUser(bob);
    expect((await db.query("delete from public.connections where id = $1 returning 1", [a])).rows).toHaveLength(1);

    const b = await request(alice, carol);
    await asUser(alice);
    expect((await db.query("delete from public.connections where id = $1 returning 1", [b])).rows).toHaveLength(1);
  });

  it("lets either party remove an accepted connection, after which a new request works", async () => {
    const id = await connect(alice, bob);
    await asUser(bob);
    expect((await db.query("delete from public.connections where id = $1 returning 1", [id])).rows).toHaveLength(1);
    expect(await request(alice, bob)).toBeTruthy();
  });

  it("shows accepted connections to every member but keeps pending ones private", async () => {
    await connect(alice, bob);
    await request(alice, carol);
    await asUser(carol);
    // Carol sees Alice-Bob (accepted) and her own pending request, nothing else.
    const seen = await rows<{ status: string }>("select status from public.connections order by status");
    expect(seen.map((r) => r.status)).toEqual(["accepted", "pending"]);
    await asUser(dave);
    expect(await rows("select * from public.connections")).toHaveLength(0);
  });

  it("counts connections accurately", async () => {
    await connect(alice, bob);
    await connect(carol, alice);
    await request(alice, dave).catch(() => undefined);
    await asUser(bob);
    const n = await rows<{ n: string }>(
      "select count(*) as n from public.connections where status = 'accepted' and (requester_id = $1 or addressee_id = $1)",
      [alice],
    );
    expect(Number(n[0].n)).toBe(2);
  });
});

describe("follows", () => {
  it("lets members follow and unfollow, independent of connections", async () => {
    await asUser(alice);
    await db.query("insert into public.follows (follower_id, followee_id) values ($1, $2)", [alice, bob]);
    expect(await rows("select * from public.connections")).toHaveLength(0);
    await asUser(carol);
    expect(await rows("select follower_id from public.follows where followee_id = $1", [bob])).toEqual([{ follower_id: alice }]);
    await asUser(alice);
    expect((await db.query("delete from public.follows where follower_id = $1 and followee_id = $2 returning 1", [alice, bob])).rows).toHaveLength(1);
  });

  it("rejects duplicates, self-follows and follows in someone else's name", async () => {
    await asUser(alice);
    await db.query("insert into public.follows (follower_id, followee_id) values ($1, $2)", [alice, bob]);
    expect(await failure("insert into public.follows (follower_id, followee_id) values ($1, $2)", [alice, bob])).toMatch(/duplicate key/i);
    expect(await failure("insert into public.follows (follower_id, followee_id) values ($1, $1)", [alice])).toMatch(/check constraint|row-level security/i);
    expect(await failure("insert into public.follows (follower_id, followee_id) values ($1, $2)", [bob, carol])).toMatch(/row-level security/i);
  });

  it("does not let someone remove another member's follow", async () => {
    await asUser(alice);
    await db.query("insert into public.follows (follower_id, followee_id) values ($1, $2)", [alice, bob]);
    await asUser(bob);
    expect((await db.query("delete from public.follows where follower_id = $1 returning 1", [alice])).rows).toHaveLength(0);
  });
});

describe("blocks", () => {
  it("are private to the blocker", async () => {
    await asUser(alice);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await asUser(bob);
    expect(await rows("select * from public.member_blocks")).toHaveLength(0);
    // Bob cannot probe the helper for a pair that does not include him.
    expect((await rows<{ b: boolean }>("select private.has_block_between($1, $2) as b", [alice, carol]))[0].b).toBe(false);
  });

  it("stop requests and follows in both directions", async () => {
    await asUser(alice);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    expect(await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, bob])).toMatch(/row-level security/i);
    expect(await failure("insert into public.follows (follower_id, followee_id) values ($1, $2)", [alice, bob])).toMatch(/row-level security/i);
    await asUser(bob);
    expect(await failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [bob, alice])).toMatch(/row-level security/i);
    expect(await failure("insert into public.follows (follower_id, followee_id) values ($1, $2)", [bob, alice])).toMatch(/row-level security/i);
  });

  it("remove an existing connection, follows and their notifications", async () => {
    await connect(alice, bob);
    await asUser(bob);
    await db.query("insert into public.follows (follower_id, followee_id) values ($1, $2)", [bob, alice]);
    await asUser(alice);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await asAdmin();
    expect(await rows("select * from public.connections")).toHaveLength(0);
    expect(await rows("select * from public.follows")).toHaveLength(0);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("can be lifted, after which the pair can connect again", async () => {
    await asUser(alice);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    expect((await db.query("delete from public.member_blocks where blocker_id = $1 and blocked_id = $2 returning 1", [alice, bob])).rows).toHaveLength(1);
    expect(await request(bob, alice)).toBeTruthy();
  });

  it("cannot be created in someone else's name, against oneself, or twice", async () => {
    await asUser(alice);
    expect(await failure("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, carol])).toMatch(/row-level security/i);
    expect(await failure("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $1)", [alice])).toMatch(/check constraint|row-level security/i);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    expect(await failure("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob])).toMatch(/duplicate key/i);
  });
});

describe("saved items", () => {
  it("lets a member save a post and see only their own saves", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post]);
    expect(await rows("select item_id from public.saved_items")).toEqual([{ item_id: post }]);
    await asUser(alice);
    expect(await rows("select * from public.saved_items")).toHaveLength(0);
  });

  it("rejects duplicates, forged owners, missing posts and unknown types", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post]);
    expect(await failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post])).toMatch(/duplicate key|unique/i);
    expect(await failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [carol, post])).toMatch(/row-level security/i);
    expect(
      await failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, "11111111-1111-1111-1111-111111111111"]),
    ).toMatch(/row-level security/i);
    expect(await failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'job', $2)", [bob, post])).toMatch(/check constraint/i);
  });

  it("lets only the owner remove a save", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post]);
    await asUser(carol);
    expect((await db.query("delete from public.saved_items where user_id = $1 returning 1", [bob])).rows).toHaveLength(0);
    await asUser(bob);
    expect((await db.query("delete from public.saved_items where user_id = $1 returning 1", [bob])).rows).toHaveLength(1);
  });

  it("disappears when the post is deleted", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post]);
    await asUser(alice);
    await db.query("delete from public.posts where id = $1", [post]);
    await asUser(bob);
    expect(await rows("select * from public.saved_items")).toHaveLength(0);
  });
});

describe("notifications", () => {
  it("cannot be inserted, edited (beyond read state) or read by anyone but the recipient", async () => {
    await request(alice, bob);
    await asUser(alice);
    expect(await failure("insert into public.notifications (recipient_id, type) values ($1, 'mention')", [alice])).toMatch(/permission denied/i);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
    await asUser(bob);
    const [n] = await rows<{ id: string }>("select id from public.notifications");
    expect(await failure("update public.notifications set type = 'mention' where id = $1", [n.id])).toMatch(/permission denied/i);
    expect(await failure("update public.notifications set recipient_id = $2 where id = $1", [n.id, alice])).toMatch(/permission denied/i);
    await asUser(carol);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
    expect((await db.query("update public.notifications set read_at = now() where id = $1 returning 1", [n.id])).rows).toHaveLength(0);
    expect((await db.query("delete from public.notifications where id = $1 returning 1", [n.id])).rows).toHaveLength(0);
  });

  it("tells the addressee about a request and the requester about the acceptance", async () => {
    const id = await request(alice, bob);
    await asUser(bob);
    expect(await rows("select type, actor_id, entity_type, entity_id, read_at from public.notifications")).toEqual([
      { type: "connection_request", actor_id: alice, entity_type: "connection", entity_id: id, read_at: null },
    ]);
    await db.query("update public.connections set status = 'accepted' where id = $1", [id]);
    // The answered request is marked read for Bob.
    expect((await rows<{ read_at: string | null }>("select read_at from public.notifications"))[0].read_at).not.toBeNull();
    await asUser(alice);
    expect(await rows("select type, actor_id from public.notifications")).toEqual([
      { type: "connection_accepted", actor_id: bob },
    ]);
  });

  it("removes the request notification when it is withdrawn or declined", async () => {
    const id = await request(alice, bob);
    await asUser(alice);
    await db.query("delete from public.connections where id = $1", [id]);
    await asUser(bob);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("notifies a post's author about a comment, and earlier commenters about a reply", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'first')", [post, bob]);
    await asUser(carol);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'second')", [post, carol]);

    await asUser(alice);
    expect((await rows<{ type: string; actor_id: string }>("select type, actor_id from public.notifications order by created_at, actor_id")).map((r) => r.type)).toEqual([
      "post_comment",
      "post_comment",
    ]);
    await asUser(bob);
    expect(await rows("select type, actor_id, entity_type, entity_id from public.notifications")).toEqual([
      { type: "comment_reply", actor_id: carol, entity_type: "post", entity_id: post },
    ]);
    await asUser(carol);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("does not notify people about their own comments", async () => {
    const post = await newPost(alice);
    await asUser(alice);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'my own post')", [post, alice]);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("never stores post or comment text", async () => {
    const post = await newPost(alice, "SENSITIVE-POST-TEXT");
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'SENSITIVE-COMMENT-TEXT')", [post, bob]);
    await asAdmin();
    const dump = JSON.stringify(await rows("select * from public.notifications"));
    expect(dump).not.toMatch(/SENSITIVE/);
    const columns = await rows<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'notifications'",
    );
    expect(columns.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(["body"]));
  });

  it("respects the recipient's in-app preferences", async () => {
    await asUser(alice);
    await db.query("insert into public.notification_preferences (user_id, inapp_connections, inapp_comments) values ($1, false, false)", [alice]);
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'muted')", [post, bob]);
    await request(bob, alice);
    await asUser(alice);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("stays silent for blocked pairs", async () => {
    const post = await newPost(alice);
    await asUser(alice);
    await db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'blocked')", [post, bob]);
    await asUser(alice);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });

  it("lets the recipient mark read, in bulk, and delete", async () => {
    await request(alice, bob);
    await request(carol, bob);
    await asUser(bob);
    expect((await rows("select id from public.notifications where read_at is null"))).toHaveLength(2);
    await db.query("update public.notifications set read_at = now() where read_at is null");
    expect((await rows("select id from public.notifications where read_at is null"))).toHaveLength(0);
    expect((await db.query("delete from public.notifications returning 1")).rows).toHaveLength(2);
  });

  it("disappears with the post it points at", async () => {
    const post = await newPost(alice);
    await asUser(bob);
    await db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, bob]);
    await asUser(alice);
    await db.query("delete from public.posts where id = $1", [post]);
    expect(await rows("select * from public.notifications")).toHaveLength(0);
  });
});
