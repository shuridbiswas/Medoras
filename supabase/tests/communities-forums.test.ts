// @vitest-environment node
//
// Phase 6 communities, forums and anonymity, run against the real migrations in PGlite.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHarness, ids, type Harness } from "./helpers";

let h: Harness;
const { alice, bob, carol, dave, admin } = ids;

beforeAll(async () => {
  h = await createHarness();
});
beforeEach(async () => {
  await h.reset();
});
afterAll(async () => {
  await h.db.close();
});

let slugCounter = 0;
async function community(owner: string, visibility: "public" | "private" = "public", name = "Nursing educators") {
  await h.asUser(owner);
  const slug = `group-${++slugCounter}`;
  const r = await h.db.query<{ id: string }>(
    `insert into public.communities (slug, name, description, kind, visibility, created_by)
     values ($1, $2, 'A place for people who teach nursing students.', 'profession', $3, $4) returning id`,
    [slug, name, visibility, owner],
  );
  return r.rows[0].id;
}

async function join(member: string, community: string) {
  await h.asUser(member);
  await h.db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [community, member]);
}

/** Requests to join, then has staff approve, so the member is in a private community. */
async function admit(member: string, community: string, approver: string) {
  await h.asUser(member);
  const r = await h.db.query<{ id: string }>(
    "insert into public.community_requests (community_id, user_id, message) values ($1, $2, 'Please') returning id",
    [community, member],
  );
  await h.asUser(approver);
  await h.db.query("select public.decide_join_request($1, true)", [r.rows[0].id]);
}

async function communityPost(author: string, community: string, body = "A community post") {
  await h.asUser(author);
  const r = await h.db.query<{ id: string }>(
    "insert into public.posts (author_id, category, body, community_id) values ($1, 'general_discussion', $2, $3) returning id",
    [author, body, community],
  );
  return r.rows[0].id;
}

const audit = async (community: string) => {
  await h.asOwner();
  return (await h.rows<{ action: string }>("select action from public.community_audit_logs where community_id = $1 order by created_at, id", [community])).map(
    (a) => a.action,
  );
};

describe("communities: public and private access", () => {
  it("lets signed-out visitors and unfinished accounts see and do nothing", async () => {
    const c = await community(alice);
    await h.asUser(null);
    for (const t of ["communities", "community_members", "community_requests", "community_announcements", "forum_questions", "forum_identity"]) {
      expect(await h.failure(`select * from public.${t}`)).toMatch(/permission denied/i);
    }
    await h.asUser(dave);
    expect(await h.rows("select * from public.communities")).toHaveLength(0);
    expect(await h.failure("insert into public.community_members (community_id, user_id) values ($1, $2)", [c, dave])).toMatch(/row-level security/i);
    expect(
      await h.failure(
        `insert into public.communities (slug, name, description, kind, created_by)
         values ('dave-group', 'Dave group', 'A group with a long enough description.', 'interest', $1)`,
        [dave],
      ),
    ).toMatch(/row-level security/i);
  });

  it("makes the creator the owner, and lets any member join a public community", async () => {
    const c = await community(alice);
    await h.asUser(alice);
    expect((await h.rows<{ role: string }>("select role from public.community_members where community_id = $1 and user_id = $2", [c, alice]))[0].role).toBe("owner");

    await join(bob, c);
    await h.asUser(bob);
    expect((await h.rows<{ role: string }>("select role from public.community_members where user_id = $1", [bob]))[0].role).toBe("member");
    // Nobody can pick a role for themselves.
    expect(await h.failure("insert into public.community_members (community_id, user_id, role) values ($1, $2, 'moderator')", [c, carol])).toMatch(/permission denied/i);
    // Nor join as someone else.
    expect(await h.failure("insert into public.community_members (community_id, user_id) values ($1, $2)", [c, carol])).toMatch(/row-level security/i);
  });

  it("shows a private community in the directory but nothing inside it to outsiders", async () => {
    const c = await community(alice, "private");
    await communityPost(alice, c, "Members-only discussion");
    await h.asUser(alice);
    await h.db.query("insert into public.community_announcements (community_id, author_id, title, body) values ($1, $2, 'Welcome', 'Read the rules')", [c, alice]);

    await h.asUser(bob);
    expect(await h.rows("select name from public.communities where id = $1", [c])).toHaveLength(1);
    expect(await h.rows("select * from public.posts where community_id = $1", [c])).toHaveLength(0);
    expect(await h.rows("select * from public.community_members where community_id = $1", [c])).toHaveLength(0);
    expect(await h.rows("select * from public.community_announcements where community_id = $1", [c])).toHaveLength(0);
    // Joining directly is not possible; only a request is.
    expect(await h.failure("insert into public.community_members (community_id, user_id) values ($1, $2)", [c, bob])).toMatch(/row-level security/i);
  });

  it("hides a private community's posts, comments and likes from members who are not in it", async () => {
    const c = await community(alice, "private");
    const post = await communityPost(alice, c);
    await h.asUser(alice);
    await h.db.query("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'inside')", [post, alice]);

    await h.asUser(bob);
    expect(await h.rows("select * from public.post_comments where post_id = $1", [post])).toHaveLength(0);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hello')", [post, bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [post, bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [bob, post])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.posts (author_id, category, body, community_id) values ($1, 'general_discussion', 'x', $2)", [bob, c])).toMatch(/row-level security/i);
    // Reporting needs to be able to see the content too.
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toMatch(/no longer available/i);
  });

  it("keeps public community posts readable by every member and out of nobody's way", async () => {
    const c = await community(alice, "public");
    const post = await communityPost(alice, c);
    await h.asUser(carol);
    expect(await h.rows("select id from public.posts where id = $1", [post])).toHaveLength(1);
    // Posting inside still needs membership.
    expect(await h.failure("insert into public.posts (author_id, category, body, community_id) values ($1, 'general_discussion', 'x', $2)", [carol, c])).toMatch(/row-level security/i);
    await join(carol, c);
    expect(await communityPost(carol, c, "Now I belong")).toBeTruthy();
  });

  it("does not let a community post change community, and leaving ends access", async () => {
    const c = await community(alice, "private");
    const other = await community(alice, "public", "Another group");
    await admit(bob, c, alice);
    const post = await communityPost(bob, c);
    await h.asUser(bob);
    expect(await h.failure("update public.posts set community_id = $2 where id = $1", [post, other])).toMatch(/permission denied/i);
    await h.db.query("delete from public.community_members where community_id = $1 and user_id = $2", [c, bob]);
    expect(await h.rows("select * from public.posts where id = $1", [post])).toHaveLength(0);
  });

  it("stops suspended members from joining or posting", async () => {
    const c = await community(alice);
    await h.asOwner();
    await h.db.query("insert into public.member_status (user_id, status) values ($1, 'suspended')", [bob]);
    await h.asUser(bob);
    expect(await h.failure("insert into public.community_members (community_id, user_id) values ($1, $2)", [c, bob])).toMatch(/row-level security/i);
    expect(await h.rows("select * from public.communities")).toHaveLength(0);
  });
});

describe("communities: join requests", () => {
  it("lets a member ask once, lets only moderators see and decide, and notifies moderators", async () => {
    const c = await community(alice, "private");
    await h.asUser(bob);
    const r = await h.db.query<{ id: string }>(
      "insert into public.community_requests (community_id, user_id, message) values ($1, $2, 'I teach at the college') returning id",
      [c, bob],
    );
    expect(await h.failure("insert into public.community_requests (community_id, user_id) values ($1, $2)", [c, bob])).toMatch(/duplicate key/i);

    await h.asUser(carol);
    expect(await h.rows("select * from public.community_requests")).toHaveLength(0);
    expect(await h.failure("select public.decide_join_request($1, true)", [r.rows[0].id])).toMatch(/Not allowed/i);
    // A request cannot be filed in someone else's name, nor for a public community.
    expect(await h.failure("insert into public.community_requests (community_id, user_id) values ($1, $2)", [c, bob])).toMatch(/row-level security/i);

    await h.asUser(alice);
    expect(await h.rows("select * from public.community_requests")).toHaveLength(1);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1", [alice])).toEqual([
      { type: "community_join_request", actor_id: bob },
    ]);
    await h.db.query("select public.decide_join_request($1, true)", [r.rows[0].id]);
    expect(await h.failure("select public.decide_join_request($1, true)", [r.rows[0].id])).toMatch(/no longer open/i);

    await h.asUser(bob);
    expect(await h.rows("select role from public.community_members where user_id = $1", [bob])).toEqual([{ role: "member" }]);
    expect((await h.rows<{ type: string }>("select type from public.notifications where recipient_id = $1", [bob])).map((n) => n.type)).toEqual(["community_request_approved"]);
    expect(await audit(c)).toEqual(["request.approve"]);
  });

  it("keeps a rejected request out of the community and lets the member withdraw a pending one", async () => {
    const c = await community(alice, "private");
    await h.asUser(bob);
    const r = await h.db.query<{ id: string }>("insert into public.community_requests (community_id, user_id) values ($1, $2) returning id", [c, bob]);
    await h.asUser(alice);
    await h.db.query("select public.decide_join_request($1, false)", [r.rows[0].id]);
    await h.asUser(bob);
    expect(await h.rows("select status from public.community_requests")).toEqual([{ status: "rejected" }]);
    expect(await h.rows("select * from public.community_members where user_id = $1", [bob])).toHaveLength(0);
    expect(await h.rows("select * from public.notifications where recipient_id = $1", [bob])).toHaveLength(0);
    // A resolved request cannot be "withdrawn" (deleted) to hide the history.
    await h.db.query("delete from public.community_requests where id = $1", [r.rows[0].id]);
    expect(await h.rows("select * from public.community_requests")).toHaveLength(1);
    // A fresh request is allowed, and can be withdrawn while pending.
    const again = await h.db.query<{ id: string }>("insert into public.community_requests (community_id, user_id) values ($1, $2) returning id", [c, bob]);
    await h.db.query("delete from public.community_requests where id = $1", [again.rows[0].id]);
    expect(await h.rows("select * from public.community_requests where status = 'pending'")).toHaveLength(0);
  });
});

describe("communities: moderator roles and audit", () => {
  it("lets only the owner appoint moderators, and never changes the owner", async () => {
    const c = await community(alice);
    await join(bob, c);
    await join(carol, c);

    await h.asUser(bob);
    expect(await h.failure("select public.set_community_role($1, $2, 'moderator')", [c, carol])).toMatch(/Not allowed/i);
    expect(await h.failure("update public.community_members set role = 'owner' where user_id = $1", [bob])).toMatch(/permission denied/i);

    await h.asUser(alice);
    await h.db.query("select public.set_community_role($1, $2, 'moderator')", [c, bob]);
    expect(await h.failure("select public.set_community_role($1, $2, 'owner')", [c, bob])).toMatch(/Unknown role/i);
    expect(await h.failure("select public.set_community_role($1, $2, 'member')", [c, alice])).toMatch(/cannot be changed/i);
    expect(await audit(c)).toEqual(["role.moderator"]);

    // A moderator cannot appoint others.
    await h.asUser(bob);
    expect(await h.failure("select public.set_community_role($1, $2, 'moderator')", [c, carol])).toMatch(/Not allowed/i);
  });

  it("lets moderators remove posts and comments with an audit entry, and tells the author", async () => {
    const c = await community(alice);
    await join(bob, c);
    await join(carol, c);
    await h.asUser(alice);
    await h.db.query("select public.set_community_role($1, $2, 'moderator')", [c, bob]);
    const post = await communityPost(carol, c, "Off-topic advertisement");
    const comment = await h.newComment(post, carol, "Buy now");

    // An ordinary member cannot.
    const other = await communityPost(alice, c);
    await h.asUser(carol);
    expect(await h.failure("select public.community_remove_post($1, 'spam')", [other])).toMatch(/Not allowed/i);

    await h.asUser(bob);
    await h.db.query("select public.community_remove_comment($1, 'spam')", [comment]);
    expect(await h.failure("select public.community_remove_post($1, 'invented')", [post])).toMatch(/Unknown reason/i);
    await h.db.query("select public.community_remove_post($1, 'spam')", [post]);
    expect(await h.rows("select * from public.posts where id = $1", [post])).toHaveLength(0);

    await h.asUser(carol);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1 and type = 'community_post_removed'", [carol])).toEqual([
      { type: "community_post_removed", actor_id: null },
    ]);
    expect(await audit(c)).toEqual(["role.moderator", "comment.remove", "post.remove"]);
    // Audit metadata holds the reason only, never content.
    await h.asOwner();
    const meta = JSON.stringify(await h.rows("select metadata from public.community_audit_logs"));
    expect(meta).not.toMatch(/advertisement|Buy now/);
  });

  it("will not let a moderator act on a post outside their community, nor on a plain post", async () => {
    const mine = await community(alice);
    const theirs = await community(bob, "public", "Other group");
    const post = await communityPost(bob, theirs);
    const plain = await h.newPost(bob);
    await h.asUser(alice);
    expect(await h.failure("select public.community_remove_post($1, 'rules')", [post])).toMatch(/Not allowed/i);
    expect(await h.failure("select public.community_remove_post($1, 'rules')", [plain])).toMatch(/not in a community/i);
    expect(mine).toBeTruthy();
  });

  it("removes members, blocks them from rejoining, and protects the owner and (from other moderators) moderators", async () => {
    const c = await community(alice);
    await join(bob, c);
    await join(carol, c);
    await h.asUser(alice);
    await h.db.query("select public.set_community_role($1, $2, 'moderator')", [c, bob]);

    await h.asUser(carol);
    expect(await h.failure("select public.community_set_ban($1, $2, true, 'spam')", [c, bob])).toMatch(/Not allowed/i);

    await h.asUser(bob);
    expect(await h.failure("select public.community_set_ban($1, $2, true)", [c, alice])).toMatch(/cannot be removed/i);
    await h.db.query("select public.community_set_ban($1, $2, true, 'harassment')", [c, carol]);
    expect(await h.rows("select * from public.community_members where user_id = $1", [carol])).toHaveLength(0);

    await h.asUser(carol);
    expect(await h.failure("insert into public.community_members (community_id, user_id) values ($1, $2)", [c, carol])).toMatch(/row-level security/i);
    // The removed member cannot see that they were banned, or the reason.
    expect(await h.rows("select * from public.community_bans")).toHaveLength(0);

    await h.asUser(alice);
    expect(await h.rows("select reason from public.community_bans")).toEqual([{ reason: "harassment" }]);
    // Only the owner can remove a moderator.
    await h.asUser(bob);
    await h.asUser(alice);
    await h.db.query("select public.community_set_ban($1, $2, false)", [c, carol]);
    await join(carol, c);
    expect(await audit(c)).toEqual(["role.moderator", "member.remove", "member.restore"]);
  });

  it("lets the owner leave nothing behind: owner cannot leave, members can", async () => {
    const c = await community(alice);
    await join(bob, c);
    await h.asUser(alice);
    await h.db.query("delete from public.community_members where community_id = $1 and user_id = $2", [c, alice]);
    expect(await h.rows("select * from public.community_members where role = 'owner'")).toHaveLength(1);
    await h.asUser(bob);
    await h.db.query("delete from public.community_members where community_id = $1 and user_id = $2", [c, bob]);
    expect(await h.rows("select * from public.community_members where user_id = $1", [bob])).toHaveLength(0);
  });

  it("shows the audit log to moderators and platform staff only, and never lets it change", async () => {
    const c = await community(alice);
    await join(bob, c);
    await h.asUser(alice);
    await h.db.query("select public.set_community_role($1, $2, 'moderator')", [c, bob]);
    await h.asUser(bob);
    expect(await h.rows("select action from public.community_audit_logs")).toHaveLength(1);
    await h.asUser(carol);
    expect(await h.rows("select * from public.community_audit_logs")).toHaveLength(0);
    await h.asUser(admin);
    expect(await h.rows("select * from public.community_audit_logs")).toHaveLength(1);
    await h.asUser(alice);
    expect(await h.failure("delete from public.community_audit_logs")).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.community_audit_logs (community_id, action) values ($1, 'forged')", [c])).toMatch(/permission denied/i);
    await h.asOwner();
    expect(await h.failure("update public.community_audit_logs set action = 'changed'")).toMatch(/append-only/i);
    expect(await h.failure("delete from public.community_audit_logs")).toMatch(/append-only/i);
  });

  it("keeps account deletion working for a moderator who has audit entries", async () => {
    const c = await community(alice);
    await h.asOwner();
    const modId = "00000000-0000-0000-0000-0000000000f1";
    await h.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'mod@example.com', '{}')", [modId]);
    await h.db.query("update public.profiles set username = 'mod_user', member_type = 'educator', fields = array['nursing'], career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1", [modId]);
    await join(modId, c);
    await h.asUser(alice);
    await h.db.query("select public.set_community_role($1, $2, 'moderator')", [c, modId]);
    await h.asUser(modId);
    await h.db.query("select public.community_set_ban($1, $2, true, 'spam')", [c, bob]);
    await h.asOwner();
    await h.db.query("delete from auth.users where id = $1", [modId]);
    expect(await h.rows("select actor_id from public.community_audit_logs where action = 'member.remove'")).toEqual([{ actor_id: null }]);
  });
});

describe("communities: announcements, creation and settings", () => {
  it("lets only moderators publish and remove announcements, audited", async () => {
    const c = await community(alice);
    await join(bob, c);
    await h.asUser(bob);
    expect(await h.failure("insert into public.community_announcements (community_id, author_id, title, body) values ($1, $2, 'Hello', 'World')", [c, bob])).toMatch(/row-level security/i);
    await h.asUser(alice);
    const a = await h.db.query<{ id: string }>("insert into public.community_announcements (community_id, author_id, title, body) values ($1, $2, 'Hello there', 'Meeting on Friday') returning id", [c, alice]);
    await h.asUser(bob);
    expect(await h.rows("select title from public.community_announcements")).toEqual([{ title: "Hello there" }]);
    expect((await h.db.query("delete from public.community_announcements")).affectedRows).toBe(0); // members cannot remove them
    await h.asUser(alice);
    await h.db.query("delete from public.community_announcements where id = $1", [a.rows[0].id]);
    expect(await audit(c)).toEqual(["announcement.create", "announcement.delete"]);
  });

  it("validates names, slugs and the daily creation limit, and lets only the owner edit", async () => {
    await h.asUser(alice);
    const bad = (slug: string, name = "A decent name") =>
      h.failure(
        `insert into public.communities (slug, name, description, kind, created_by)
         values ($1, $2, 'A description that is long enough.', 'interest', $3)`,
        [slug, name, alice],
      );
    expect(await bad("create")).toMatch(/communities_slug_valid/);
    expect(await bad("Has Spaces")).toMatch(/communities_slug_valid/);
    expect(await bad("ok-slug", "ab")).toMatch(/communities_name_length/);
    expect(await h.failure(`insert into public.communities (slug, name, description, kind, created_by) values ('x-slug', 'A name', 'Short', 'interest', $1)`, [alice])).toMatch(/communities_description_length/);
    expect(await h.failure(`insert into public.communities (slug, name, description, kind, created_by) values ('x-slug', 'A name', 'Long enough description here.', 'cult', $1)`, [alice])).toMatch(/communities_kind_valid/);
    // Not in someone else's name.
    expect(await h.failure(`insert into public.communities (slug, name, description, kind, created_by) values ('x-slug', 'A name', 'Long enough description here.', 'interest', $1)`, [bob])).toMatch(/row-level security/i);

    await community(alice, "public", "First group");
    await community(alice, "public", "Second group");
    await community(alice, "public", "Third group");
    await h.asUser(alice);
    expect(await bad("fourth-group")).toMatch(/too quickly/i);

    const c = await community(bob);
    await join(carol, c);
    await h.asUser(carol);
    expect((await h.db.query("update public.communities set description = 'Changed by a member here.' where id = $1", [c])).affectedRows).toBe(0);
    await h.asUser(bob);
    expect((await h.db.query("update public.communities set rules = 'Be kind.' where id = $1", [c])).affectedRows).toBe(1);
    // Slug, owner and archive state are not editable by anyone.
    expect(await h.failure("update public.communities set slug = 'taken-over' where id = $1", [c])).toMatch(/permission denied/i);
    expect(await h.failure("update public.communities set archived_at = now() where id = $1", [c])).toMatch(/permission denied/i);
    expect(await h.failure("update public.communities set created_by = $2 where id = $1", [c, carol])).toMatch(/permission denied/i);
  });

  it("lets a moderator hide nothing from the platform: staff reports can archive a community", async () => {
    const c = await community(alice, "public", "Bad actors");
    await h.asUser(bob);
    const r = await h.db.query<{ submit_report: string }>("select public.submit_report('community', $1, 'harassment')", [c]);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'remove_content', 'archive', 'This community was closed for breaking the guidelines.')", [r.rows[0].submit_report]);
    await h.asUser(carol);
    expect(await h.rows("select * from public.communities where id = $1", [c])).toHaveLength(0);
    await h.asUser(alice);
    expect(await h.rows("select archived_at from public.communities where id = $1", [c])).toHaveLength(1); // the creator still sees it
    expect((await h.rows("select * from public.member_notices where member_id = $1", [alice]))).toHaveLength(1);
  });
});

describe("communities: blocked members", () => {
  it("stops blocked members liking or commenting on each other's community posts", async () => {
    const c = await community(alice);
    await join(bob, c);
    await join(carol, c);
    const post = await communityPost(bob, c);
    await h.asUser(bob);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, carol]);
    await h.asUser(carol);
    expect(await h.failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [post, carol])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, carol])).toMatch(/row-level security/i);
  });
});

// ---------------------------------------------------------------------------
// Forums
// ---------------------------------------------------------------------------
async function ask(by: string, opts: { anonymous?: boolean; title?: string; body?: string; kind?: string; topic?: string } = {}) {
  await h.asUser(by);
  const r = await h.db.query<{ id: string }>("select public.ask_question($1, $2, $3, $4, $5, true) as id", [
    opts.topic ?? "evidence-and-research",
    opts.kind ?? "evidence",
    opts.title ?? "How should I appraise a small randomised trial?",
    opts.body ?? "I am reading a pharmacology trial with 40 participants and wonder about bias.",
    opts.anonymous ?? false,
  ]);
  return r.rows[0].id;
}

async function answer(by: string, question: string, anonymous = false, body = "Look at allocation concealment first.") {
  await h.asUser(by);
  const r = await h.db.query<{ id: string }>("select public.post_answer($1, $2, $3) as id", [question, body, anonymous]);
  return r.rows[0].id;
}

async function reply(by: string, answerId: string, anonymous = false, body = "Thank you, that helps.") {
  await h.asUser(by);
  const r = await h.db.query<{ id: string }>("select public.post_reply($1, $2, $3) as id", [answerId, body, anonymous]);
  return r.rows[0].id;
}

describe("forums: asking, answering and replying", () => {
  it("is closed to visitors and unfinished accounts, and has no direct write path", async () => {
    await h.asUser(null);
    expect(await h.failure("select * from public.forum_questions")).toMatch(/permission denied/i);
    expect(await h.failure("select public.ask_question('other', 'other', 'A valid title here', 'Body', false, true)")).toMatch(/permission denied/i);
    await h.asUser(dave);
    expect(await h.failure("select public.ask_question('other', 'other', 'A valid title here', 'Body', false, true)")).toMatch(/Not allowed/i);
    await h.asUser(alice);
    for (const t of ["forum_questions", "forum_answers", "forum_replies", "forum_identity"]) {
      expect(await h.failure(`insert into public.${t} default values`)).toMatch(/permission denied/i);
    }
    expect(await h.rows("select slug from public.forum_topics")).not.toHaveLength(0);
    // Topics are fixed: members cannot add their own.
    expect(await h.failure("insert into public.forum_topics (slug, name, description) values ('mine', 'Mine', 'x')")).toMatch(/permission denied/i);
  });

  it("publishes a question with its author, and enforces the de-identification confirmation and limits", async () => {
    const q = await ask(alice);
    await h.asUser(bob);
    const rows = await h.rows<{ author_id: string; is_anonymous: boolean; kind: string }>("select author_id, is_anonymous, kind from public.forum_questions where id = $1", [q]);
    expect(rows).toEqual([{ author_id: alice, is_anonymous: false, kind: "evidence" }]);

    await h.asUser(alice);
    expect(await h.failure("select public.ask_question('other', 'other', 'A valid title here', 'Body', false, false)")).toMatch(/identifiable patient/i);
    expect(await h.failure("select public.ask_question('other', 'other', 'Short', 'Body', false, true)")).toMatch(/forum_questions_title_length/);
    expect(await h.failure("select public.ask_question('other', 'other', 'A valid title here', '   ', false, true)")).toMatch(/forum_questions_body_length/);
    expect(await h.failure("select public.ask_question('nope', 'other', 'A valid title here', 'Body', false, true)")).toMatch(/foreign key/i);
    expect(await h.failure("select public.ask_question('other', 'diagnosis', 'A valid title here', 'Body', false, true)")).toMatch(/forum_questions_kind_valid/);
  });

  it("limits how fast one member can ask, answer and reply", async () => {
    for (let i = 0; i < 5; i++) await ask(alice, { title: `Question number ${i} about methods` });
    await h.asUser(alice);
    expect(await h.failure("select public.ask_question('other', 'other', 'A sixth question title', 'Body', false, true)")).toMatch(/too quickly/i);
    // Anonymous questions count against the same member, so anonymity is not a way around the limit.
    expect(await h.failure("select public.ask_question('other', 'other', 'A sixth anonymous one', 'Body', true, true)")).toMatch(/too quickly/i);
  });

  it("lets members answer and reply, public or anonymous, and notifies the right people", async () => {
    const q = await ask(alice);
    const publicAnswer = await answer(bob, q);
    const anonAnswer = await answer(carol, q, true, "An anonymous but helpful answer.");
    await reply(alice, anonAnswer, false, "Could you say more?");
    await h.asUser(alice);
    const notes = await h.rows<{ type: string; actor_id: string | null }>(
      "select type, actor_id from public.notifications where recipient_id = $1 order by created_at, id",
      [alice],
    );
    expect(notes).toEqual([
      { type: "forum_answer", actor_id: bob },
      { type: "forum_answer", actor_id: null }, // the anonymous answer never names its writer
    ]);
    // The anonymous answer's writer is told about the reply; the reply was public.
    await h.asUser(carol);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1", [carol])).toEqual([
      { type: "forum_reply", actor_id: alice },
    ]);
    // Nobody is notified about their own activity.
    await h.asUser(bob);
    expect(await h.rows("select * from public.notifications where recipient_id = $1", [bob])).toHaveLength(0);
    expect(publicAnswer).toBeTruthy();
  });

  it("notifies followers, but not people who muted the writer or who turned comments off", async () => {
    const q = await ask(alice);
    await h.asUser(carol);
    await h.db.query("insert into public.forum_follows (question_id, user_id) values ($1, $2)", [q, carol]);
    await h.asOwner();
    await h.db.query("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob]);
    await answer(bob, q);
    await h.asUser(carol);
    expect(await h.rows("select type from public.notifications where recipient_id = $1", [carol])).toEqual([{ type: "forum_answer" }]);
    await h.asUser(alice);
    expect(await h.rows("select * from public.notifications where recipient_id = $1", [alice])).toHaveLength(0); // muted bob
  });

  it("lets members follow questions privately", async () => {
    const q = await ask(alice);
    await h.asUser(bob);
    await h.db.query("insert into public.forum_follows (question_id, user_id) values ($1, $2)", [q, bob]);
    expect(await h.failure("insert into public.forum_follows (question_id, user_id) values ($1, $2)", [q, carol])).toMatch(/row-level security/i);
    await h.asUser(carol);
    expect(await h.rows("select * from public.forum_follows")).toHaveLength(0);
    await h.asUser(bob);
    await h.db.query("delete from public.forum_follows where question_id = $1", [q]);
    expect(await h.rows("select * from public.forum_follows")).toHaveLength(0);
  });

  it("lets only the writer edit or delete, marks edits, and cleans up saves and notifications on delete", async () => {
    const q = await ask(alice);
    const a = await answer(bob, q);
    await h.asUser(carol);
    await h.db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'forum_question', $2), ($1, 'forum_answer', $3)", [carol, q, a]);

    await h.asUser(bob);
    expect((await h.db.query("update public.forum_questions set title = 'Hijacked title for this question' where id = $1", [q])).affectedRows).toBe(0);
    expect((await h.db.query("update public.forum_answers set body = 'Edited by the writer' where id = $1", [a])).affectedRows).toBe(1);
    expect((await h.db.query("delete from public.forum_questions where id = $1", [q])).affectedRows).toBe(0);
    await h.asUser(alice);
    expect((await h.db.query("update public.forum_answers set body = 'Not mine' where id = $1", [a])).affectedRows).toBe(0);
    expect((await h.db.query("update public.forum_questions set title = 'A clearer title for this question' where id = $1", [q])).affectedRows).toBe(1);
    expect((await h.rows<{ edited_at: string | null }>("select edited_at from public.forum_questions where id = $1", [q]))[0].edited_at).not.toBeNull();
    // Authorship and anonymity can never be rewritten.
    expect(await h.failure("update public.forum_questions set author_id = $2 where id = $1", [q, bob])).toMatch(/permission denied/i);
    expect(await h.failure("update public.forum_questions set is_anonymous = true where id = $1", [q])).toMatch(/permission denied/i);

    expect((await h.db.query("delete from public.forum_questions where id = $1", [q])).affectedRows).toBe(1);
    await h.asOwner();
    expect(await h.rows("select * from public.forum_answers")).toHaveLength(0);
    expect(await h.rows("select * from public.forum_identity")).toHaveLength(0);
    expect(await h.rows("select * from public.saved_items")).toHaveLength(0);
    expect(await h.rows("select * from public.notifications where entity_type = 'forum_question'")).toHaveLength(0);
  });

  it("searches questions by words in the title and body", async () => {
    await ask(alice, { title: "Interpreting confidence intervals", body: "What does a wide interval mean for a pharmacology trial?" });
    await ask(alice, { title: "Preparing for a placement interview", body: "Tips for a community nursing placement." });
    await h.asUser(bob);
    const hits = await h.rows<{ title: string }>("select title from public.forum_questions where search @@ websearch_to_tsquery('simple', 'pharmacology')");
    expect(hits.map((r) => r.title)).toEqual(["Interpreting confidence intervals"]);
  });
});

describe("forums: helpful votes and accepted answers", () => {
  it("allows one helpful vote per member, never on your own answer, and counts from rows", async () => {
    const q = await ask(alice);
    const a = await answer(bob, q);
    await h.asUser(alice);
    await h.db.query("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, alice]);
    expect(await h.failure("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, alice])).toMatch(/duplicate key/i);
    expect(await h.failure("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, carol])).toMatch(/row-level security/i);
    await h.asUser(carol);
    await h.db.query("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, carol]);
    await h.asUser(bob);
    expect(await h.failure("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, bob])).toMatch(/row-level security/i);
    expect(await h.rows("select count(*)::int as n from public.forum_votes where answer_id = $1", [a])).toEqual([{ n: 2 }]);
    await h.asUser(carol);
    await h.db.query("delete from public.forum_votes where answer_id = $1", [a]);
    expect(await h.rows("select count(*)::int as n from public.forum_votes where answer_id = $1", [a])).toEqual([{ n: 1 }]);
  });

  it("stops an anonymous writer voting for their own anonymous answer", async () => {
    const q = await ask(alice);
    const a = await answer(bob, q, true);
    await h.asUser(bob);
    expect(await h.failure("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, bob])).toMatch(/row-level security/i);
  });

  it("lets only the asker accept an answer to their own question, including an anonymous asker", async () => {
    const q = await ask(alice, { anonymous: true });
    const other = await ask(bob);
    const a = await answer(bob, q);
    const foreign = await answer(carol, other);

    await h.asUser(carol);
    expect((await h.db.query("update public.forum_questions set accepted_answer_id = $2 where id = $1", [q, a])).affectedRows).toBe(0);
    await h.asUser(bob);
    expect((await h.db.query("update public.forum_questions set accepted_answer_id = $2 where id = $1", [q, a])).affectedRows).toBe(0); // the answerer is not the asker

    await h.asUser(alice);
    // An answer from a different question is refused.
    expect(await h.failure("update public.forum_questions set accepted_answer_id = $2 where id = $1", [q, foreign])).toMatch(/row-level security/i);
    expect((await h.db.query("update public.forum_questions set accepted_answer_id = $2 where id = $1", [q, a])).affectedRows).toBe(1);

    await h.asUser(bob);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1 and type = 'forum_answer_accepted'", [bob])).toEqual([
      { type: "forum_answer_accepted", actor_id: null },
    ]);
    // Deleting the accepted answer clears the choice.
    expect((await h.db.query("delete from public.forum_answers where id = $1", [a])).affectedRows).toBe(1);
    await h.asUser(carol);
    expect((await h.rows<{ accepted_answer_id: string | null }>("select accepted_answer_id from public.forum_questions where id = $1", [q]))[0].accepted_answer_id).toBeNull();
  });
});

describe("forums: anonymity", () => {
  it("stores no author on anonymous content and lets only the writer read the private record", async () => {
    const q = await ask(alice, { anonymous: true });
    const a = await answer(alice, q, true, "I can answer my own question too.");
    await h.asUser(bob);
    expect(await h.rows("select author_id, is_anonymous from public.forum_questions where id = $1", [q])).toEqual([{ author_id: null, is_anonymous: true }]);
    expect(await h.rows("select author_id, is_anonymous from public.forum_answers where id = $1", [a])).toEqual([{ author_id: null, is_anonymous: true }]);
    expect(await h.rows("select * from public.forum_identity")).toHaveLength(0);

    await h.asUser(alice);
    expect(await h.rows("select content_type from public.forum_identity order by content_type")).toEqual([{ content_type: "answer" }, { content_type: "question" }]);
    await h.asUser(admin);
    expect(await h.rows("select * from public.forum_identity")).toHaveLength(0); // staff are not shown who wrote it either
    await h.asUser(null);
    expect(await h.failure("select * from public.forum_identity")).toMatch(/permission denied/i);
  });

  it("does not let anyone rewrite the private record", async () => {
    const q = await ask(alice, { anonymous: true });
    await h.asUser(alice);
    expect(await h.failure("update public.forum_identity set author_id = $1", [bob])).toMatch(/permission denied/i);
    expect(await h.failure("delete from public.forum_identity")).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.forum_identity (content_type, content_id, author_id) values ('question', $1, $2)", [q, bob])).toMatch(/permission denied/i);
  });

  it("never reveals the writer through anything another member can read", async () => {
    const q = await ask(alice, { anonymous: true });
    const a = await answer(alice, q, true, "My own anonymous answer.");
    await reply(alice, a, true, "An anonymous reply.");
    const bobQuestion = await ask(bob);
    await answer(alice, bobQuestion, true, "An anonymous answer to Bob.");
    await h.asUser(carol);
    await h.db.query("insert into public.forum_follows (question_id, user_id) values ($1, $2)", [q, carol]);
    await h.db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'forum_question', $2)", [carol, q]);
    await h.db.query("select public.submit_report('question', $1, 'spam')", [q]);

    for (const viewer of [bob, carol, admin]) {
      await h.asUser(viewer);
      const everything = JSON.stringify({
        questions: await h.rows("select * from public.forum_questions"),
        answers: await h.rows("select * from public.forum_answers"),
        replies: await h.rows("select * from public.forum_replies"),
        votes: await h.rows("select * from public.forum_votes"),
        identity: await h.rows("select * from public.forum_identity"),
        notifications: await h.rows("select * from public.notifications where recipient_id <> $1", [alice]),
        reports: await h.rows("select * from public.reports"),
        audit: await h.rows("select * from public.audit_logs"),
        actions: await h.rows("select * from public.moderation_actions"),
        posts: await h.rows("select * from public.posts"),
      });
      // Bob's own question is public and rightly names Bob; Alice must not appear anywhere.
      expect(everything).not.toContain(alice);
    }
    // The only public question names its writer, so the check above is meaningful.
    await h.asUser(carol);
    expect(JSON.stringify(await h.rows("select * from public.forum_questions"))).toContain(bob);
  });

  it("keeps anonymous content out of the writer's public activity", async () => {
    await ask(alice, { anonymous: true });
    await h.asUser(bob);
    expect(await h.rows("select * from public.forum_questions where author_id = $1", [alice])).toHaveLength(0);
    expect(await h.rows("select * from public.posts where author_id = $1", [alice])).toHaveLength(0);
  });

  it("hides a blocked writer's content silently, without confirming who wrote it", async () => {
    const anon = await ask(alice, { anonymous: true });
    const open = await ask(alice, { title: "A question that names its writer" });
    await h.asUser(bob);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, alice]);
    expect(await h.rows("select id from public.forum_questions where id in ($1, $2)", [anon, open])).toHaveLength(0);
    // Answering a hidden anonymous question looks exactly like answering one that does not exist.
    const hidden = await h.failure("select public.post_answer($1, 'Trying to answer', false)", [anon]);
    const missing = await h.failure("select public.post_answer(gen_random_uuid(), 'Trying to answer', false)");
    expect(hidden).toBe(missing);
    expect(hidden).toMatch(/no longer available/i);
    expect(await h.failure("insert into public.forum_follows (question_id, user_id) values ($1, $2)", [anon, bob])).toMatch(/row-level security/i);
    expect(await h.failure("select public.submit_report('question', $1, 'spam')", [anon])).toMatch(/no longer available/i);
    // And in the other direction: Alice cannot see Bob's anonymous content either.
    await h.asUser(carol);
    const bobAnon = await ask(bob, { anonymous: true });
    await h.asUser(alice);
    expect(await h.rows("select id from public.forum_questions where id = $1", [bobAnon])).toHaveLength(0);
  });

  it("hides answers and replies written by a blocked member, anonymous or not", async () => {
    const q = await ask(carol);
    const a = await answer(alice, q, true, "An anonymous answer from Alice.");
    const open = await answer(alice, q, false, "A public answer from Alice.");
    await reply(alice, open, true, "An anonymous reply from Alice.");
    await h.asUser(bob);
    expect(await h.rows("select id from public.forum_answers where question_id = $1", [q])).toHaveLength(2);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, alice]);
    expect(await h.rows("select id from public.forum_answers where question_id = $1", [q])).toHaveLength(0);
    expect(await h.rows("select id from public.forum_replies")).toHaveLength(0);
    expect(await h.failure("insert into public.forum_votes (answer_id, user_id) values ($1, $2)", [a, bob])).toMatch(/row-level security/i);
    await h.asUser(carol);
    expect(await h.rows("select id from public.forum_answers where question_id = $1", [q])).toHaveLength(2); // Carol has no block
  });

  it("deletes anonymous content when the writer's account is deleted", async () => {
    await h.asOwner();
    const gone = "00000000-0000-0000-0000-0000000000f2";
    await h.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'gone@example.com', '{}')", [gone]);
    await h.db.query("update public.profiles set username = 'gone_user', member_type = 'educator', fields = array['nursing'], career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1", [gone]);
    const q = await ask(gone, { anonymous: true });
    await answer(gone, q, true);
    const other = await ask(bob);
    await answer(gone, other, true);
    await h.asOwner();
    await h.db.query("delete from auth.users where id = $1", [gone]);
    expect(await h.rows("select id from public.forum_questions")).toEqual([{ id: other }]);
    expect(await h.rows("select * from public.forum_answers")).toHaveLength(0);
    // Only the surviving public question (Bob's) keeps a private record.
    expect(await h.rows("select author_id from public.forum_identity")).toEqual([{ author_id: bob }]);
  });
});

describe("forums: reporting and moderation", () => {
  it("lets members report forum content, keeps the anonymous writer out of the report, and blocks reporting your own", async () => {
    const q = await ask(alice, { anonymous: true, body: "Some body text that is long enough to excerpt." });
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('question', $1, 'spam')", [q])).toMatch(/your own content/i);

    await h.asUser(bob);
    await h.db.query("select public.submit_report('question', $1, 'patient_privacy', 'Looks identifiable')", [q]);
    const mine = await h.rows<{ target_member_id: string | null; excerpt: string }>("select target_member_id, excerpt from public.reports");
    expect(mine).toHaveLength(1);
    expect(mine[0].target_member_id).toBeNull();
    expect(mine[0].excerpt).toContain("How should I appraise");
    // A public question names its writer, as it does everywhere else.
    const open = await ask(alice, { title: "A question that names its writer" });
    await h.asUser(carol);
    await h.db.query("select public.submit_report('question', $1, 'spam')", [open]);
    expect((await h.rows<{ target_member_id: string | null }>("select target_member_id from public.reports"))[0].target_member_id).toBe(alice);
  });

  it("reports answers and replies too", async () => {
    const q = await ask(alice);
    const a = await answer(bob, q, true);
    const r = await reply(carol, a, true);
    await h.asUser(alice);
    await h.db.query("select public.submit_report('answer', $1, 'medical_misinformation')", [a]);
    await h.db.query("select public.submit_report('reply', $1, 'harassment')", [r]);
    expect(await h.rows("select target_type from public.reports order by target_type")).toEqual([{ target_type: "answer" }, { target_type: "reply" }]);
    expect(await h.failure("select public.submit_report('answer', gen_random_uuid(), 'spam')")).toMatch(/no longer available/i);
    // A repeat of a report still being reviewed is rejected by the one-live-report index.
    expect(await h.failure("select public.submit_report('reply', $1, 'harassment')", [r])).toMatch(/duplicate key/i);
  });

  it("lets an administrator warn, remove and suspend the writer of anonymous content without being shown who it is", async () => {
    const q = await ask(alice, { anonymous: true });
    const a = await answer(alice, q, true, "A problematic anonymous answer.");
    await h.asUser(bob);
    const rq = (await h.db.query<{ submit_report: string }>("select public.submit_report('question', $1, 'patient_privacy')", [q])).rows[0].submit_report;
    const ra = (await h.db.query<{ submit_report: string }>("select public.submit_report('answer', $1, 'harassment')", [a])).rows[0].submit_report;

    await h.asUser(admin);
    expect(await h.rows("select target_member_id from public.reports")).toEqual([{ target_member_id: null }, { target_member_id: null }]);
    await h.db.query("select public.moderate_report($1, 'warn', 'first strike', 'Please remove identifiable details.')", [rq]);
    await h.db.query("select public.moderate_report($1, 'remove_content', null, 'Your answer broke the guidelines.')", [ra]);
    expect(await h.rows("select * from public.forum_answers")).toHaveLength(0);

    // The writer is told; nobody else is.
    await h.asUser(alice);
    expect((await h.rows<{ kind: string }>("select kind from public.member_notices order by created_at")).map((n) => n.kind)).toEqual(["warning", "content_removed"]);
    await h.asUser(bob);
    expect(await h.rows("select * from public.member_notices")).toHaveLength(0);

    // The staff-side records do not name the anonymous writer.
    await h.asUser(admin);
    const staffView = JSON.stringify({
      actions: await h.rows("select * from public.moderation_actions"),
      audit: await h.rows("select * from public.audit_logs"),
      reports: await h.rows("select * from public.reports"),
      identity: await h.rows("select * from public.forum_identity"),
    });
    expect(staffView).not.toContain(alice);

    // Suspension resolves the writer too.
    const q2 = await ask(alice, { anonymous: true, title: "Another anonymous question here" });
    await h.asUser(carol);
    const r2 = (await h.db.query<{ submit_report: string }>("select public.submit_report('question', $1, 'harassment')", [q2])).rows[0].submit_report;
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'suspend', null, 'Suspended for repeated harassment.')", [r2]);
    await h.asOwner();
    expect(await h.rows("select user_id, status from public.member_status")).toEqual([{ user_id: alice, status: "suspended" }]);
    await h.asUser(alice);
    expect(await h.failure("select public.ask_question('other', 'other', 'A valid title here', 'Body', true, true)")).toMatch(/Not allowed/i);
    expect(await h.rows("select * from public.forum_questions")).toHaveLength(0); // suspended members read nothing
  });

  it("refuses non-administrators and still removes public forum content", async () => {
    const q = await ask(alice);
    await h.asUser(bob);
    const r = (await h.db.query<{ submit_report: string }>("select public.submit_report('question', $1, 'spam')", [q])).rows[0].submit_report;
    expect(await h.failure("select public.moderate_report($1, 'remove_content', null, 'x')", [r])).toMatch(/Not allowed/i);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'remove_content', null, 'Removed for spam.')", [r]);
    await h.asOwner();
    expect(await h.rows("select * from public.forum_questions")).toHaveLength(0);
    expect(await h.rows("select member_id from public.moderation_actions")).toEqual([{ member_id: alice }]);
  });
});

describe("forums: saved items", () => {
  it("saves questions and answers privately, and only ones the member can see", async () => {
    const q = await ask(alice);
    const a = await answer(bob, q);
    await h.asUser(carol);
    await h.db.query("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'forum_question', $2), ($1, 'forum_answer', $3)", [carol, q, a]);
    expect(await h.failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'forum_answer', gen_random_uuid())", [carol])).toMatch(/row-level security/i);
    await h.asUser(bob);
    expect(await h.rows("select * from public.saved_items")).toHaveLength(0);

    // A member who blocks the writer cannot save the writer's content.
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, alice]);
    expect(await h.failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'forum_question', $2)", [bob, q])).toMatch(/row-level security/i);
  });
});
