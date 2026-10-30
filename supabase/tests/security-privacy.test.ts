// @vitest-environment node
//
// Phase 4A account-security and privacy policies, run against the real migrations in PGlite.
import { createHash } from "node:crypto";
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

const sha = (code: string) => createHash("sha256").update(code.toLowerCase().replace(/[^0-9a-z]/g, "")).digest("hex");
const factor = (user: string) =>
  h.db.query("insert into auth.mfa_factors (user_id, status) values ($1, 'verified')", [user]);

async function giveCodes(user: string, codes: string[]) {
  await h.asOwner();
  for (const c of codes) await h.db.query("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, $2)", [user, sha(c)]);
}

describe("recovery codes: access", () => {
  it("blocks anonymous visitors", async () => {
    await h.asUser(null);
    expect(await h.failure("select * from public.mfa_recovery_codes")).toMatch(/permission denied/i);
    expect(await h.failure("select public.redeem_mfa_recovery_code('x')")).toMatch(/permission denied/i);
  });

  it("never lets a member read the hashes, even their own", async () => {
    await giveCodes(alice, ["abcd-efgh-ijkl"]);
    await h.asUser(alice);
    expect(await h.failure("select code_hash from public.mfa_recovery_codes")).toMatch(/permission denied/i);
    expect(await h.failure("select * from public.mfa_recovery_codes")).toMatch(/permission denied/i);
    expect(await h.rows("select user_id, used_at from public.mfa_recovery_codes")).toHaveLength(1);
    await h.asUser(bob);
    expect(await h.rows("select user_id from public.mfa_recovery_codes")).toHaveLength(0);
  });

  it("lets a member without an authenticator create codes, in their own name only", async () => {
    await h.asUser(alice);
    expect(await h.failure("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, $2)", [alice, sha("aaaa")])).toBeNull();
    expect(await h.failure("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, $2)", [bob, sha("bbbb")])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, 'not-a-hash')", [alice])).toMatch(/check constraint/i);
  });

  it("needs the second factor to create or replace codes once an authenticator is enrolled", async () => {
    await h.asOwner();
    await factor(alice);
    await giveCodes(alice, ["old-code"]);
    await h.asUser(alice, "aal1");
    expect(await h.failure("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, $2)", [alice, sha("new1")])).toMatch(/row-level security/i);
    expect((await h.db.query("delete from public.mfa_recovery_codes where user_id = $1 returning 1", [alice])).rows).toHaveLength(0);
    await h.asUser(alice, "aal2");
    expect(await h.failure("insert into public.mfa_recovery_codes (user_id, code_hash) values ($1, $2)", [alice, sha("new1")])).toBeNull();
    expect((await h.db.query("delete from public.mfa_recovery_codes where user_id = $1 returning 1", [alice])).rows.length).toBeGreaterThan(0);
  });
});

describe("redeeming a recovery code", () => {
  it("removes the authenticator factors and the remaining codes, and is recorded in the audit log", async () => {
    await h.asOwner();
    await factor(alice);
    await giveCodes(alice, ["ab12-cd34-ef56", "zz99-yy88-xx77"]);
    await h.asUser(alice, "aal1");
    // Case and separators do not matter.
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code(' AB12 cd34-EF56 ') as r"))[0].r).toBe(true);
    await h.asOwner();
    expect(await h.rows("select * from auth.mfa_factors where user_id = $1", [alice])).toHaveLength(0);
    expect(await h.rows("select * from public.mfa_recovery_codes where user_id = $1", [alice])).toHaveLength(0);
    const audit = await h.rows<{ action: string; actor_id: string }>("select action, actor_id from public.audit_logs");
    expect(audit).toEqual([{ action: "mfa.recovery_used", actor_id: alice }]);
  });

  it("works only once", async () => {
    await h.asOwner();
    await factor(alice);
    await giveCodes(alice, ["one-time-code"]);
    await h.asUser(alice);
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code('one-time-code') as r"))[0].r).toBe(true);
    await h.asOwner();
    await giveCodes(alice, ["other-code"]); // a fresh set after re-enrolling
    await h.asUser(alice);
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code('one-time-code') as r"))[0].r).toBe(false);
  });

  it("rejects wrong codes and someone else's code, leaving the factors alone", async () => {
    await h.asOwner();
    await factor(alice);
    await factor(bob);
    await giveCodes(bob, ["bobs-code-1234"]);
    await h.asUser(alice);
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code('bobs-code-1234') as r"))[0].r).toBe(false);
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code('') as r"))[0].r).toBe(false);
    expect((await h.rows<{ r: boolean }>("select public.redeem_mfa_recovery_code(null) as r"))[0].r).toBe(false);
    await h.asOwner();
    expect(await h.rows("select * from auth.mfa_factors")).toHaveLength(2);
  });

  it("locks out guessing after five wrong codes in an hour, even for the right code", async () => {
    await h.asOwner();
    await factor(alice);
    await giveCodes(alice, ["the-right-code"]);
    await h.asUser(alice);
    for (let i = 0; i < 5; i++) await h.db.query("select public.redeem_mfa_recovery_code($1)", [`wrong-${i}`]);
    expect(await h.failure("select public.redeem_mfa_recovery_code('the-right-code')")).toMatch(/too many attempts/i);
    await h.asOwner();
    expect(await h.rows("select * from auth.mfa_factors where user_id = $1", [alice])).toHaveLength(1);
  });

  it("does not let a member read or write the attempt log", async () => {
    await h.asUser(alice);
    expect(await h.failure("select * from public.mfa_recovery_attempts")).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.mfa_recovery_attempts (user_id) values ($1)", [alice])).toMatch(/permission denied/i);
  });
});

describe("profile visibility", () => {
  async function seedDetails() {
    await h.asOwner();
    await h.db.query("insert into public.profile_education (profile_id, institution, qualification) values ($1, 'Test U', 'BSc')", [alice]);
    await h.db.query("insert into public.profile_skills (profile_id, name, kind) values ($1, 'Triage', 'skill')", [alice]);
  }

  it("shows details to every member by default", async () => {
    await seedDetails();
    await h.asUser(bob);
    expect(await h.rows("select * from public.profile_education where profile_id = $1", [alice])).toHaveLength(1);
    expect(await h.rows("select * from public.profile_skills where profile_id = $1", [alice])).toHaveLength(1);
  });

  it("lets an owner switch to connections-only, and nobody else change it", async () => {
    await h.asUser(alice);
    expect((await h.db.query("update public.profiles set profile_visibility = 'connections' where id = $1 returning 1", [alice])).rows).toHaveLength(1);
    expect(await h.failure("update public.profiles set profile_visibility = 'public' where id = $1", [alice])).toMatch(/check constraint/i);
    await h.asUser(bob);
    expect((await h.db.query("update public.profiles set profile_visibility = 'connections' where id = $1 returning 1", [carol])).rows).toHaveLength(0);
  });

  it("hides education, experience and skills from members who are not connected", async () => {
    await seedDetails();
    await h.asUser(alice);
    await h.db.query("update public.profiles set profile_visibility = 'connections'");
    await h.asUser(bob);
    expect(await h.rows("select * from public.profile_education where profile_id = $1", [alice])).toHaveLength(0);
    expect(await h.rows("select * from public.profile_skills where profile_id = $1", [alice])).toHaveLength(0);
    // The owner still sees their own.
    await h.asUser(alice);
    expect(await h.rows("select * from public.profile_education")).toHaveLength(1);
  });

  it("shows them to an accepted connection, but not to a pending request", async () => {
    await seedDetails();
    await h.asUser(alice);
    await h.db.query("update public.profiles set profile_visibility = 'connections' where id = $1", [alice]);
    await h.asUser(bob);
    const c = await h.db.query<{ id: string }>("insert into public.connections (requester_id, addressee_id) values ($1, $2) returning id", [bob, alice]);
    expect(await h.rows("select * from public.profile_education where profile_id = $1", [alice])).toHaveLength(0);
    await h.asUser(alice);
    await h.db.query("update public.connections set status = 'accepted' where id = $1", [c.rows[0].id]);
    await h.asUser(bob);
    expect(await h.rows("select * from public.profile_education where profile_id = $1", [alice])).toHaveLength(1);
    // Carol, unconnected, still sees nothing.
    await h.asUser(carol);
    expect(await h.rows("select * from public.profile_education where profile_id = $1", [alice])).toHaveLength(0);
  });

  it("stores the directory preference, defaulting to listed", async () => {
    await h.asUser(alice);
    expect((await h.rows<{ directory_listed: boolean }>("select directory_listed from public.profiles where id = $1", [alice]))[0].directory_listed).toBe(true);
    await h.db.query("update public.profiles set directory_listed = false where id = $1", [alice]);
    expect((await h.rows<{ directory_listed: boolean }>("select directory_listed from public.profiles where id = $1", [alice]))[0].directory_listed).toBe(false);
  });
});

describe("consent records", () => {
  it("records a member's own consent, once per version, and nobody can alter it", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.consent_records (user_id, kind, version) values ($1, 'privacy', '2026-11-draft')", [alice]);
    expect(await h.failure("insert into public.consent_records (user_id, kind, version) values ($1, 'privacy', '2026-11-draft')", [alice])).toMatch(/duplicate key/i);
    await h.db.query("insert into public.consent_records (user_id, kind, version) values ($1, 'terms', '2026-11-draft')", [alice]);
    expect(await h.failure("update public.consent_records set version = 'x'")).toMatch(/permission denied/i);
    expect(await h.failure("delete from public.consent_records")).toMatch(/permission denied/i);
  });

  it("rejects consent in someone else's name and unknown kinds, and is private", async () => {
    await h.asUser(alice);
    expect(await h.failure("insert into public.consent_records (user_id, kind, version) values ($1, 'privacy', 'v1')", [bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.consent_records (user_id, kind, version) values ($1, 'marketing', 'v1')", [alice])).toMatch(/check constraint/i);
    await h.db.query("insert into public.consent_records (user_id, kind, version) values ($1, 'terms', 'v1')", [alice]);
    await h.asUser(bob);
    expect(await h.rows("select * from public.consent_records")).toHaveLength(0);
  });

  it("works before onboarding is finished (consent is given at sign-up)", async () => {
    await h.asUser(dave);
    expect(await h.failure("insert into public.consent_records (user_id, kind, version) values ($1, 'terms', 'v1')", [dave])).toBeNull();
  });
});

describe("data requests", () => {
  it("lets a member ask for deletion, with a 30 day cooling-off period, one at a time", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [alice]);
    const [r] = await h.rows<{ status: string; days: number }>("select status, round(extract(epoch from (scheduled_for - requested_at)) / 86400)::int as days from public.data_requests");
    expect(r).toEqual({ status: "requested", days: 30 });
    expect(await h.failure("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [alice])).toMatch(/duplicate key/i);
  });

  it("does not let a member forge exports, other people's requests, or completed status", async () => {
    await h.asUser(alice);
    expect(await h.failure("insert into public.data_requests (user_id, kind) values ($1, 'export')", [alice])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [bob])).toMatch(/row-level security/i);
    expect(await h.failure("insert into public.data_requests (user_id, kind, status) values ($1, 'deletion', 'completed')", [alice])).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.data_requests (user_id, kind, scheduled_for) values ($1, 'deletion', now())", [alice])).toMatch(/permission denied/i);
  });

  it("lets the member cancel their own request, and only that", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [alice]);
    await h.asUser(bob);
    expect((await h.db.query("update public.data_requests set status = 'cancelled' returning 1")).rows).toHaveLength(0);
    await h.asUser(alice);
    expect(await h.failure("update public.data_requests set status = 'completed'")).toMatch(/row-level security/i);
    expect((await h.db.query("update public.data_requests set status = 'cancelled' returning 1")).rows).toHaveLength(1);
    // A new request is possible once the old one is cancelled.
    expect(await h.failure("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [alice])).toBeNull();
  });

  it("is private to the member and staff", async () => {
    await h.asUser(alice);
    await h.db.query("insert into public.data_requests (user_id, kind) values ($1, 'deletion')", [alice]);
    await h.asUser(bob);
    expect(await h.rows("select * from public.data_requests")).toHaveLength(0);
    await h.asUser(admin);
    expect(await h.rows("select * from public.data_requests")).toHaveLength(1);
  });

  it("records a self-serve export as completed", async () => {
    await h.asUser(alice);
    await h.db.query("select public.record_data_export()");
    expect(await h.rows("select kind, status from public.data_requests")).toEqual([{ kind: "export", status: "completed" }]);
    await h.asUser(dave);
    expect(await h.failure("select public.record_data_export()")).toMatch(/Not allowed/i);
  });

  it("is carried out by an administrator only after the cooling-off period, leaving a record but no personal data", async () => {
    // A throwaway member, so the shared fixtures survive.
    const erin = "00000000-0000-0000-0000-0000000000e1";
    await h.asOwner();
    await h.db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'erin@example.com', '{\"first_name\":\"Erin\"}')", [erin]);
    await h.db.query("update public.profiles set username = 'erin_e', member_type = 'educator', fields = array['nursing'], career_stage = 'mid_career', country = 'CA', onboarding_completed = true where id = $1", [erin]);
    await h.asUser(erin);
    const [{ id }] = (await h.db.query<{ id: string }>("insert into public.data_requests (user_id, kind) values ($1, 'deletion') returning id", [erin])).rows;
    await h.newPost(erin, "To be deleted with the account");
    await h.asUser(bob);
    expect(await h.failure("select public.admin_execute_deletion($1)", [id])).toMatch(/Not allowed/i);
    await h.asUser(admin);
    expect(await h.failure("select public.admin_execute_deletion($1)", [id])).toMatch(/cooling-off period has not ended/i);

    await h.asOwner();
    await h.db.query("update public.data_requests set scheduled_for = now() - interval '1 day'");
    await h.asUser(admin);
    await h.db.query("select public.admin_execute_deletion($1)", [id]);

    await h.asOwner();
    expect(await h.rows("select * from auth.users where id = $1", [erin])).toHaveLength(0);
    expect(await h.rows("select * from public.profiles where id = $1", [erin])).toHaveLength(0);
    expect(await h.rows("select * from public.posts where author_id = $1", [erin])).toHaveLength(0);
    expect(await h.rows("select status, user_id from public.data_requests")).toEqual([{ status: "completed", user_id: null }]);
    expect((await h.rows<{ action: string }>("select action from public.audit_logs")).map((a) => a.action)).toContain("account.deleted");
  });

  it("refuses to delete a staff account or an already handled request", async () => {
    await h.asOwner();
    await h.db.query("insert into public.data_requests (user_id, kind, scheduled_for) values ($1, 'deletion', now())", [admin]);
    const [{ id }] = await h.rows<{ id: string }>("select id from public.data_requests");
    await h.db.query("update public.data_requests set scheduled_for = now() - interval '1 day'");
    await h.asUser(admin);
    expect(await h.failure("select public.admin_execute_deletion($1)", [id])).toMatch(/staff role/i);
    expect(await h.failure("select public.admin_execute_deletion(gen_random_uuid())")).toMatch(/not an open deletion request/i);
  });
});

describe("retention", () => {
  it("is readable by members and changeable only by an administrator, with an audit entry", async () => {
    await h.asUser(alice);
    expect((await h.rows("select * from public.retention_policies")).length).toBeGreaterThanOrEqual(5);
    expect(await h.failure("update public.retention_policies set days = 1")).toMatch(/permission denied/i);
    expect(await h.failure("select public.set_retention_days('audit_logs', 5)")).toMatch(/Not allowed/i);
    await h.asUser(admin);
    expect(await h.failure("select public.set_retention_days('audit_logs', 0)")).toMatch(/check constraint/i);
    expect(await h.failure("select public.set_retention_days('nope', 5)")).toMatch(/Unknown retention/i);
    await h.db.query("select public.set_retention_days('audit_logs', 900)");
    expect((await h.rows<{ days: number }>("select days from public.retention_policies where key = 'audit_logs'"))[0].days).toBe(900);
    expect((await h.rows<{ action: string }>("select action from public.audit_logs")).map((a) => a.action)).toEqual(["retention.changed"]);
  });

  it("purges only what is past its retention period", async () => {
    await h.asUser(bob);
    const post = await h.newPost(alice);
    await h.newComment(post, bob);
    await h.newComment(post, carol);
    await h.asOwner();
    await h.db.query("update public.retention_policies set days = 730 where key = 'audit_logs'"); // an earlier test changed it
    // Two notifications for Alice: one old and read, one old but unread. Plus one recent read one.
    await h.db.query("update public.notifications set read_at = now() - interval '200 days', created_at = now() - interval '200 days' where actor_id = $1", [bob]);
    await h.db.query("update public.notifications set read_at = now() - interval '1 day' where actor_id = $1", [carol]);
    await h.db.query("insert into public.notifications (recipient_id, actor_id, type) values ($1, $2, 'mention')", [alice, bob]);
    await h.db.query("insert into public.audit_logs (action, created_at) values ('old', now() - interval '800 days'), ('recent', now())");
    await h.db.query("insert into public.mfa_recovery_attempts (user_id, attempted_at) values ($1, now() - interval '3 days'), ($1, now())", [alice]);

    const [{ result }] = await h.rows<{ result: Record<string, number> }>("select private.run_retention_purge() as result");
    expect(result).toMatchObject({ read_notifications: 1, audit_logs: 1, recovery_attempts: 1 });
    const left = await h.rows<{ actor_id: string; read_at: string | null }>("select actor_id, read_at from public.notifications order by actor_id");
    // Kept: the two recently read ones (Carol's) and Alice's unread mention.
    expect(left).toHaveLength(3);
    expect(left.filter((n) => n.read_at === null)).toHaveLength(1);
    expect((await h.rows<{ action: string }>("select action from public.audit_logs")).map((a) => a.action)).toEqual(["recent"]);
    // The append-only rule applies again afterwards.
    expect(await h.failure("delete from public.audit_logs")).toMatch(/append-only/i);
  });

  it("cannot be run by a member", async () => {
    await h.asUser(alice);
    expect(await h.failure("select private.run_retention_purge()")).toMatch(/permission denied/i);
  });
});
