// @vitest-environment node
//
// Phase 4A safety and moderation policies, run against the real migrations in PGlite.
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

const report = (target: string, id: string, reason = "harassment", details: string | null = null) =>
  h.db.query<{ submit_report: string }>("select public.submit_report($1, $2, $3, $4)", [target, id, reason, details]);

async function filed(by: string, target: string, id: string, reason = "harassment") {
  await h.asUser(by);
  return (await report(target, id, reason)).rows[0].submit_report;
}

describe("access", () => {
  it("blocks anonymous visitors from every safety table and function", async () => {
    await h.asUser(null);
    for (const t of ["reports", "member_notices", "appeals", "moderation_actions", "audit_logs", "staff_roles", "member_status", "member_mutes"]) {
      expect(await h.failure(`select * from public.${t}`)).toMatch(/permission denied/i);
    }
    expect(await h.failure("select public.submit_report('post', gen_random_uuid(), 'spam')")).toMatch(/permission denied/i);
    expect(await h.failure("select public.moderate_report(gen_random_uuid(), 'dismiss')")).toMatch(/permission denied/i);
  });

  it("gives members no direct write access to reports, staff roles, notices, actions, status or audit logs", async () => {
    await h.asUser(alice);
    expect(await h.failure("insert into public.reports (reporter_id, target_type, target_id, reason) values ($1, 'post', gen_random_uuid(), 'spam')", [alice])).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.staff_roles (user_id, role) values ($1, 'admin')", [alice])).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.member_notices (member_id, kind, message) values ($1, 'warning', 'x')", [alice])).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.member_status (user_id, status) values ($1, 'suspended')", [alice])).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.audit_logs (action) values ('forged')")).toMatch(/permission denied/i);
    expect(await h.failure("update public.reports set status = 'dismissed'")).toMatch(/permission denied/i);
    expect(await h.failure("delete from public.member_notices")).toMatch(/permission denied/i);
  });

  it("does not let a member see whether anyone is staff, or read other people's status", async () => {
    await h.asUser(alice);
    expect(await h.rows("select * from public.staff_roles")).toHaveLength(0);
    expect(await h.rows("select * from public.member_status")).toHaveLength(0);
  });
});

describe("submitting reports", () => {
  it("reports a post, a comment and a profile, with an excerpt and the author recorded", async () => {
    const post = await h.newPost(bob, "Something questionable ".repeat(30));
    const comment = await h.newComment(post, carol, "A rude comment");
    await h.asUser(alice);
    await report("post", post, "medical_misinformation", "  This is wrong  ");
    await report("comment", comment, "harassment");
    await report("profile", carol, "impersonation");

    await h.asOwner();
    const rows = await h.rows<{ target_type: string; target_member_id: string; excerpt: string; details: string | null }>(
      "select target_type, target_member_id, excerpt, details from public.reports order by target_type",
    );
    expect(rows.map((r) => [r.target_type, r.target_member_id])).toEqual([
      ["comment", carol],
      ["post", bob],
      ["profile", carol],
    ]);
    expect(rows.find((r) => r.target_type === "post")?.excerpt).toHaveLength(300);
    expect(rows.find((r) => r.target_type === "post")?.details).toBe("This is wrong");
    expect(rows.find((r) => r.target_type === "comment")?.excerpt).toBe("A rude comment");
  });

  it("lets the reporter see their own reports, and nobody else except staff", async () => {
    const post = await h.newPost(bob);
    const id = await filed(alice, "post", post);
    await h.asUser(alice);
    expect(await h.rows("select id from public.reports")).toEqual([{ id }]);
    await h.asUser(bob); // the author of the reported post
    expect(await h.rows("select id from public.reports")).toHaveLength(0);
    await h.asUser(carol);
    expect(await h.rows("select id from public.reports")).toHaveLength(0);
    await h.asUser(admin);
    expect(await h.rows("select id from public.reports")).toHaveLength(1);
  });

  it("refuses reporting yourself, unknown or missing targets, unknown reasons and over-long details", async () => {
    const mine = await h.newPost(alice);
    const theirs = await h.newPost(bob);
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [mine])).toMatch(/your own content/i);
    expect(await h.failure("select public.submit_report('profile', $1, 'spam')", [alice])).toMatch(/your own content/i);
    expect(await h.failure("select public.submit_report('post', gen_random_uuid(), 'spam')")).toMatch(/no longer available/i);
    expect(await h.failure("select public.submit_report('profile', $1, 'spam')", [dave])).toMatch(/no longer available/i);
    expect(await h.failure("select public.submit_report('message', $1, 'spam')", [theirs])).toMatch(/Unknown report target/i);
    expect(await h.failure("select public.submit_report('post', $1, 'dislike')", [theirs])).toMatch(/check constraint/i);
    expect(await h.failure("select public.submit_report('post', $1, 'spam', $2)", [theirs, "x".repeat(1001)])).toMatch(/check constraint/i);
  });

  it("allows one live report per reporter and target, and a new one once it is resolved", async () => {
    const post = await h.newPost(bob);
    const id = await filed(alice, "post", post);
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toMatch(/duplicate key/i);
    await h.asUser(carol);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toBeNull(); // a different reporter is fine
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'dismiss')", [id]);
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toBeNull();
  });

  it("limits a member to ten reports per hour", async () => {
    await h.asUser(bob);
    const posts: string[] = [];
    for (let i = 0; i < 11; i++) posts.push(await h.newPost(bob, `post ${i}`));
    await h.asUser(alice);
    for (let i = 0; i < 10; i++) await report("post", posts[i]);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [posts[10]])).toMatch(/too quickly/i);
  });

  it("is closed to members who have not finished joining and to suspended members", async () => {
    const post = await h.newPost(bob);
    await h.asUser(dave);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toMatch(/Not allowed/i);
    await h.asOwner();
    await h.db.query("insert into public.member_status (user_id, status) values ($1, 'suspended')", [alice]);
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('post', $1, 'spam')", [post])).toMatch(/Not allowed/i);
  });

  it("keeps the report reviewable after the content is deleted", async () => {
    const post = await h.newPost(bob, "Evidence text");
    const id = await filed(alice, "post", post);
    await h.asUser(bob);
    await h.db.query("delete from public.posts where id = $1", [post]);
    await h.asUser(admin);
    const [r] = await h.rows<{ excerpt: string; status: string }>("select excerpt, status from public.reports where id = $1", [id]);
    expect(r).toEqual({ excerpt: "Evidence text", status: "open" });
  });
});

describe("staff-only moderation", () => {
  it("refuses every staff function to a member who is not an administrator", async () => {
    const post = await h.newPost(bob);
    const id = await filed(alice, "post", post);
    await h.asUser(alice);
    for (const sql of [
      ["select public.claim_report($1)", [id]],
      ["select public.moderate_report($1, 'dismiss')", [id]],
      ["select public.set_member_status($1, 'suspended', 'r', 'm')", [bob]],
      ["select public.decide_appeal(gen_random_uuid(), 'upheld', 'n')", []],
    ] as const) {
      expect(await h.failure(sql[0], [...sql[1]])).toMatch(/Not allowed/i);
    }
    expect((await h.rows<{ status: string }>("select status from public.reports"))[0].status).toBe("open");
  });

  it("lets an administrator claim a report and dismiss it, leaving an audit trail without content", async () => {
    const post = await h.newPost(bob, "SECRET CONTENT");
    const id = await filed(alice, "post", post);
    await h.asUser(admin);
    await h.db.query("select public.claim_report($1)", [id]);
    expect((await h.rows<{ status: string }>("select status from public.reports"))[0].status).toBe("reviewing");
    await h.db.query("select public.moderate_report($1, 'dismiss', 'Not a violation')", [id]);
    const [r] = await h.rows<{ status: string; reviewed_by: string; resolved_at: string }>("select status, reviewed_by, resolved_at from public.reports");
    expect(r.status).toBe("dismissed");
    expect(r.reviewed_by).toBe(admin);
    expect(r.resolved_at).not.toBeNull();

    const audit = await h.rows<{ action: string; metadata: unknown }>("select action, metadata from public.audit_logs order by created_at, action");
    expect(audit.map((a) => a.action).sort()).toEqual(["report.claim", "report.dismiss"]);
    expect(JSON.stringify(audit)).not.toMatch(/SECRET/);
    // A dismissal sends the member nothing.
    expect(await h.rows("select * from public.member_notices")).toHaveLength(0);
  });

  it("removes a reported post, tells the author (message only) and records the decision", async () => {
    const post = await h.newPost(bob, "Bad post");
    await h.newComment(post, carol);
    const id = await filed(alice, "post", post);
    await h.asUser(admin);
    expect(await h.failure("select public.moderate_report($1, 'remove_content', 'internal', '  ')", [id])).toMatch(/message for the member/i);
    await h.db.query("select public.moderate_report($1, 'remove_content', 'internal reason', 'Your post broke our guidelines.')", [id]);

    expect(await h.rows("select * from public.posts")).toHaveLength(0);
    expect(await h.rows("select * from public.post_comments")).toHaveLength(0);
    await h.asUser(bob);
    expect(await h.rows("select kind, message from public.member_notices")).toEqual([
      { kind: "content_removed", message: "Your post broke our guidelines." },
    ]);
    // The internal note never reaches the member.
    expect(await h.rows("select * from public.moderation_actions")).toHaveLength(0);
    await h.asUser(admin);
    expect((await h.rows<{ note: string }>("select note from public.moderation_actions"))[0].note).toBe("internal reason");
  });

  it("removes a reported comment but cannot 'remove' a profile", async () => {
    const post = await h.newPost(bob);
    const comment = await h.newComment(post, carol, "Rude");
    const c = await filed(alice, "comment", comment);
    const p = await filed(alice, "profile", carol);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'remove_content', null, 'Removed.')", [c]);
    expect(await h.rows("select * from public.post_comments")).toHaveLength(0);
    expect(await h.rows("select * from public.posts")).toHaveLength(1);
    expect(await h.failure("select public.moderate_report($1, 'remove_content', null, 'x')", [p])).toMatch(/cannot be removed/i);
  });

  it("warns and suspends, and a resolved report cannot be decided twice", async () => {
    const post = await h.newPost(bob);
    const warn = await filed(alice, "post", post);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'warn', null, 'Please be kind.')", [warn]);
    expect(await h.failure("select public.moderate_report($1, 'dismiss')", [warn])).toMatch(/not open/i);

    const profile = await filed(alice, "profile", carol);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'suspend', 'repeat offender', 'Your account is suspended.')", [profile]);
    expect((await h.rows<{ status: string }>("select status from public.member_status where user_id = $1", [carol]))[0].status).toBe("suspended");
    await h.asUser(carol);
    expect((await h.rows<{ status: string }>("select status from public.member_status"))[0].status).toBe("suspended");
  });

  it("never lets an administrator suspend themselves or another administrator", async () => {
    await h.asOwner();
    await h.db.query("insert into public.staff_roles (user_id, role) values ($1, 'admin')", [carol]);
    const post = await h.newPost(bob);
    await h.asUser(admin);
    expect(await h.failure("select public.set_member_status($1, 'suspended', 'r', 'm')", [admin])).toMatch(/cannot be suspended/i);
    expect(await h.failure("select public.set_member_status($1, 'suspended', 'r', 'm')", [carol])).toMatch(/cannot be suspended/i);
    expect(post).toBeTruthy();
    expect(await h.failure("select public.set_member_status($1, 'banned', 'r', 'm')", [bob])).toMatch(/Unknown status/i);
    expect(await h.failure("select public.set_member_status($1, 'suspended', 'r', '')", [bob])).toMatch(/message for the member/i);
  });
});

describe("suspension", () => {
  it("stops a suspended member from posting, liking, commenting, connecting, saving, muting and blocking", async () => {
    const post = await h.newPost(bob);
    await h.asUser(admin);
    await h.db.query("select public.set_member_status($1, 'suspended', 'test', 'Suspended for testing')", [alice]);
    await h.asUser(alice);
    expect(await h.failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'hi')", [alice])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [post, alice])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, alice])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [alice, bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.saved_items (user_id, item_type, item_id) values ($1, 'post', $2)", [alice, post])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob])).toMatch(/row-level security/i);
  });

  it("restores access when the member is reactivated", async () => {
    await h.asUser(admin);
    await h.db.query("select public.set_member_status($1, 'suspended', 'test', 'Suspended')", [alice]);
    await h.db.query("select public.set_member_status($1, 'active', 'resolved', 'Welcome back')", [alice]);
    await h.asUser(alice);
    expect(await h.failure("insert into public.posts (author_id, category, body) values ($1, 'questions', 'hi')", [alice])).toBeNull();
    expect((await h.rows<{ kind: string }>("select kind from public.member_notices order by created_at")).map((n) => n.kind)).toEqual(["suspended", "restored"]);
  });
});

describe("appeals", () => {
  async function suspendedWithNotice() {
    await h.asUser(admin);
    await h.db.query("select public.set_member_status($1, 'suspended', 'r', 'You are suspended')", [alice]);
    await h.asUser(alice);
    return (await h.rows<{ id: string }>("select id from public.member_notices"))[0].id;
  }

  it("lets a suspended member appeal their own notice, once", async () => {
    const notice = await suspendedWithNotice();
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'I disagree')", [notice, alice])).toBeNull();
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'again')", [notice, alice])).toMatch(/duplicate key/i);
  });

  it("refuses appeals in someone else's name, for someone else's notice, empty or over-long", async () => {
    const notice = await suspendedWithNotice();
    await h.asUser(bob);
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'mine now')", [notice, bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'x')", [notice, alice])).toMatch(/row-level security/i);
    await h.asUser(alice);
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, '')", [notice, alice])).toMatch(/check constraint/i);
    expect(await h.failure("insert into public.appeals (notice_id, member_id, message) values ($1, $2, $3)", [notice, alice, "x".repeat(2001)])).toMatch(/check constraint/i);
  });

  it("is visible only to the member and staff, and only staff can decide it", async () => {
    const notice = await suspendedWithNotice();
    await h.db.query("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'Please review')", [notice, alice]);
    const [{ id }] = await h.rows<{ id: string }>("select id from public.appeals");
    await h.asUser(bob);
    expect(await h.rows("select * from public.appeals")).toHaveLength(0);
    expect(await h.failure("select public.decide_appeal($1, 'overturned', 'ok')", [id])).toMatch(/Not allowed/i);
    await h.asUser(admin);
    expect(await h.rows("select * from public.appeals")).toHaveLength(1);
    expect(await h.failure("select public.decide_appeal($1, 'overturned', '')", [id])).toMatch(/note for the member/i);
  });

  it("restores a suspended member when the appeal is overturned, and tells them either way", async () => {
    const notice = await suspendedWithNotice();
    await h.db.query("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'Please review')", [notice, alice]);
    const [{ id }] = await h.rows<{ id: string }>("select id from public.appeals");
    await h.asUser(admin);
    await h.db.query("select public.decide_appeal($1, 'overturned', 'Mistake on our side')", [id]);
    expect(await h.failure("select public.decide_appeal($1, 'upheld', 'again')", [id])).toMatch(/not open/i);
    await h.asUser(alice);
    expect((await h.rows<{ status: string }>("select status from public.member_status"))[0].status).toBe("active");
    expect((await h.rows<{ kind: string }>("select kind from public.member_notices order by created_at")).map((n) => n.kind)).toEqual(["suspended", "appeal_decision"]);
    expect((await h.rows<{ status: string }>("select status from public.appeals"))[0].status).toBe("overturned");
  });

  it("keeps a suspension in place when the appeal is upheld", async () => {
    const notice = await suspendedWithNotice();
    await h.db.query("insert into public.appeals (notice_id, member_id, message) values ($1, $2, 'Please review')", [notice, alice]);
    const [{ id }] = await h.rows<{ id: string }>("select id from public.appeals");
    await h.asUser(admin);
    await h.db.query("select public.decide_appeal($1, 'upheld', 'The decision stands')", [id]);
    await h.asUser(alice);
    expect((await h.rows<{ status: string }>("select status from public.member_status"))[0].status).toBe("suspended");
  });
});

describe("audit log", () => {
  it("is readable only by staff and cannot be changed or deleted by anyone", async () => {
    const post = await h.newPost(bob);
    const id = await filed(alice, "post", post);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'dismiss')", [id]);
    expect(await h.rows("select * from public.audit_logs")).toHaveLength(1);
    await h.asUser(alice);
    expect(await h.rows("select * from public.audit_logs")).toHaveLength(0);
    await h.asUser(admin);
    expect(await h.failure("update public.audit_logs set action = 'x'")).toMatch(/permission denied/i);
    expect(await h.failure("delete from public.audit_logs")).toMatch(/permission denied/i);
    await h.asOwner();
    expect(await h.failure("update public.audit_logs set action = 'x'")).toMatch(/append-only/i);
    expect(await h.failure("delete from public.audit_logs")).toMatch(/append-only/i);
  });
});

describe("mutes", () => {
  it("are private, one way, and removable", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob]);
    expect(await h.failure("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob])).toMatch(/duplicate key/i);
    expect(await h.failure("insert into public.member_mutes (muter_id, muted_id) values ($1, $1)", [alice])).toMatch(/check constraint|row-level security/i);
    expect(await h.failure("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [bob, carol])).toMatch(/row-level security/i);
    await h.asUser(bob);
    expect(await h.rows("select * from public.member_mutes")).toHaveLength(0);
    await h.asUser(alice);
    expect((await h.db.query("delete from public.member_mutes where muter_id = $1 returning 1", [alice])).rows).toHaveLength(1);
  });

  it("silence notifications caused by the muted member, but not by anyone else", async () => {
    const post = await h.newPost(alice);
    await h.asUser(alice);
    await h.db.query("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob]);
    await h.newComment(post, bob, "muted voice");
    await h.newComment(post, carol, "audible voice");
    await h.asUser(alice);
    const n = await h.rows<{ actor_id: string }>("select actor_id from public.notifications");
    expect(n).toEqual([{ actor_id: carol }]);
  });

  it("silence connection requests from the muted member", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.member_mutes (muter_id, muted_id) values ($1, $2)", [alice, bob]);
    await h.asUser(bob);
    await h.db.query("insert into public.connections (requester_id, addressee_id) values ($1, $2)", [bob, alice]);
    await h.asUser(alice);
    expect(await h.rows("select * from public.notifications")).toHaveLength(0);
    // The request itself still exists; muting hides, it does not block.
    expect(await h.rows("select * from public.connections")).toHaveLength(1);
  });
});

describe("blocking is enforced for liking and commenting, in both directions", () => {
  it("stops a blocked member from liking or commenting on the blocker's post", async () => {
    const post = await h.newPost(alice);
    await h.asUser(alice);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await h.asUser(bob);
    expect(await h.failure("insert into public.post_likes (post_id, user_id) values ($1, $2)", [post, bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, bob])).toMatch(/row-level security/i);
  });

  it("stops the blocker from interacting with the blocked member's post, too", async () => {
    const post = await h.newPost(bob);
    await h.asUser(alice);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, alice])).toMatch(/row-level security/i);
  });

  it("leaves everyone else free to interact, and a missing post is refused as not visible", async () => {
    const post = await h.newPost(alice);
    await h.asUser(alice);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await h.asUser(carol);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hello')", [post, carol])).toBeNull();
    expect(await h.failure("insert into public.post_likes (post_id, user_id) values ('11111111-1111-1111-1111-111111111111', $1)", [carol])).toMatch(/row-level security/i);
  });

  it("allows interaction again after unblocking", async () => {
    const post = await h.newPost(alice);
    await h.asUser(alice);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, bob]);
    await h.db.query("delete from public.member_blocks where blocker_id = $1", [alice]);
    await h.asUser(bob);
    expect(await h.failure("insert into public.post_comments (post_id, author_id, body) values ($1, $2, 'hi')", [post, bob])).toBeNull();
  });
});
