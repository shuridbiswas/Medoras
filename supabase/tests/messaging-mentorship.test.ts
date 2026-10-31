// @vitest-environment node
//
// Phase 7 messaging and mentorship policies, run against the real migrations in PGlite.
// Three accounts (alice, bob, carol), blocked members and unauthorized access are covered.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHarness, ids, type Harness } from "./helpers";

let h: Harness;
const { alice, bob, carol, dave, admin } = ids;
const REFUSAL = /can't message this member/i;

beforeAll(async () => {
  h = await createHarness();
});
beforeEach(async () => {
  await h.reset();
});
afterAll(async () => {
  await h.db.close();
});

async function connect(a: string, b: string) {
  await h.asOwner();
  await h.db.query("insert into public.connections (requester_id, addressee_id, status) values ($1, $2, 'accepted')", [a, b]);
}

async function startConversation(from: string, to: string, body = "Hello there") {
  await h.asUser(from);
  const r = await h.db.query<{ id: string }>("select public.start_direct_conversation($1, $2) as id", [to, body]);
  return r.rows[0].id;
}

async function send(by: string, conversation: string, body = "A message") {
  await h.asUser(by);
  await h.db.query("insert into public.messages (conversation_id, sender_id, body) values ($1, $2, $3)", [conversation, by, body]);
}

const sendFails = async (by: string, conversation: string, body = "A message") => {
  await h.asUser(by);
  return h.failure("insert into public.messages (conversation_id, sender_id, body) values ($1, $2, $3)", [conversation, by, body]);
};

async function group(owner: string, members: string[], title = "Study group") {
  await h.asUser(owner);
  const r = await h.db.query<{ id: string }>("select public.create_group_conversation($1, $2::uuid[]) as id", [title, members]);
  return r.rows[0].id;
}

describe("messaging: access", () => {
  it("is closed to visitors and unfinished accounts and has no direct write path", async () => {
    await h.asUser(null);
    for (const t of ["conversations", "conversation_participants", "messages", "mentor_profiles", "mentorships"]) {
      expect(await h.failure(`select * from public.${t}`)).toMatch(/permission denied/i);
    }
    await h.asUser(dave);
    expect(await h.failure("select public.start_direct_conversation($1, 'hi')", [alice])).toMatch(/Not allowed/i);
    await h.asUser(alice);
    expect(await h.failure("insert into public.conversations (kind, direct_key) values ('direct', 'x')")).toMatch(/permission denied/i);
    expect(await h.failure("insert into public.conversation_participants (conversation_id, user_id) values (gen_random_uuid(), $1)", [alice])).toMatch(/permission denied/i);
  });

  it("keeps a conversation away from everyone who is not in it, staff included", async () => {
    await connect(alice, bob);
    const c = await startConversation(alice, bob, "Private words");
    for (const outsider of [carol, admin, dave]) {
      await h.asUser(outsider);
      expect(await h.rows("select * from public.conversations")).toHaveLength(0);
      expect(await h.rows("select * from public.conversation_participants")).toHaveLength(0);
      expect(await h.rows("select * from public.messages")).toHaveLength(0);
    }
    expect(await sendFails(carol, c)).toMatch(/row-level security/i);
    await h.asUser(carol);
    expect((await h.db.query("update public.conversation_participants set last_read_at = now() where conversation_id = $1", [c])).affectedRows).toBe(0);
    expect(await h.failure("select public.respond_to_message_request($1, true)", [c])).toMatch(/no longer open/i);
    expect(await h.failure("select public.leave_conversation($1)", [c])).toMatch(/no longer available/i);
    expect(await h.failure("delete from public.messages")).toBeNull(); // matches nothing
    await h.asUser(alice);
    expect(await h.rows("select body from public.messages")).toEqual([{ body: "Private words" }]);
  });
});

describe("messaging: direct conversations and message requests", () => {
  it("opens straight away between connections and reuses the one conversation", async () => {
    await connect(alice, bob);
    const c = await startConversation(alice, bob, "First");
    expect(await startConversation(bob, alice, "Second")).toBe(c);
    await h.asUser(bob);
    expect(await h.rows("select status from public.conversation_participants order by user_id")).toEqual([{ status: "active" }, { status: "active" }]);
    expect(await h.rows("select * from public.messages")).toHaveLength(2);
    expect(await h.rows("select * from public.notifications where type = 'message_request'")).toHaveLength(0);
    await send(bob, c, "Third");
    await h.asUser(alice);
    expect(await h.rows("select * from public.messages")).toHaveLength(3);
  });

  it("makes a stranger's message a request: visible and notified, with a two-message limit and no reply until accepted", async () => {
    const c = await startConversation(alice, bob, "Hi, I read your post");
    await h.asUser(bob);
    expect(await h.rows("select body from public.messages")).toEqual([{ body: "Hi, I read your post" }]);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1", [bob])).toEqual([{ type: "message_request", actor_id: alice }]);
    expect(await sendFails(bob, c)).toMatch(/row-level security/i); // cannot reply before accepting

    await send(alice, c, "One more thing");
    expect(await sendFails(alice, c)).toMatch(/not accepted your message request/i);

    await h.asUser(bob);
    await h.db.query("select public.respond_to_message_request($1, true)", [c]);
    expect(await h.rows("select * from public.notifications where recipient_id = $1 and read_at is null", [bob])).toHaveLength(0);
    await send(bob, c, "Happy to chat");
    await send(alice, c, "Thanks, now I can write more");
    await h.asUser(alice);
    expect(await h.rows("select * from public.messages")).toHaveLength(4);
  });

  it("never tells the sender about a decline, and refuses with the same words as a block", async () => {
    const c = await startConversation(alice, bob);
    await h.asUser(bob);
    await h.db.query("select public.respond_to_message_request($1, false)", [c]);
    expect(await h.rows("select * from public.messages")).toHaveLength(0); // bob no longer sees it
    expect(await h.failure("select public.respond_to_message_request($1, true)", [c])).toMatch(/no longer open/i);

    await h.asUser(alice);
    // Alice still sees her message and sees only her own participant row: the decline is invisible.
    expect(await h.rows("select user_id from public.conversation_participants")).toEqual([{ user_id: alice }]);
    expect(await sendFails(alice, c)).toMatch(/row-level security/i);
    const declined = await h.failure("select public.start_direct_conversation($1, 'please?')", [bob]);
    expect(declined).toMatch(REFUSAL);

    await h.asUser(carol);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [carol, alice]);
    await h.asUser(alice);
    expect(await h.failure("select public.start_direct_conversation($1, 'hello')", [carol])).toBe(declined);
    expect(await h.failure("select public.start_direct_conversation($1, 'hello')", [dave])).toBe(declined); // not onboarded
    expect(await h.failure("select public.start_direct_conversation($1, 'hello')", [alice])).toBe(declined); // yourself
  });
});

describe("messaging: blocked members", () => {
  it("stops new and existing direct messages in both directions without saying why", async () => {
    await connect(alice, bob);
    const c = await startConversation(alice, bob, "Before the block");
    await h.asUser(bob);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, alice]);
    expect(await sendFails(alice, c)).toMatch(/row-level security/i);
    expect(await sendFails(bob, c)).toMatch(/row-level security/i);
    await h.asUser(alice);
    expect(await h.failure("select public.start_direct_conversation($1, 'hi')", [bob])).toMatch(REFUSAL);
    await h.asUser(bob);
    expect(await h.failure("select public.start_direct_conversation($1, 'hi')", [alice])).toMatch(REFUSAL);
    // History stays readable to its owners.
    expect(await h.rows("select * from public.messages")).toHaveLength(1);
    // Unblocking restores it.
    await h.db.query("delete from public.member_blocks where blocker_id = $1", [bob]);
    await send(alice, c, "After");
  });

  it("will not add a blocked member to a group, or anyone who is not a connection", async () => {
    await connect(alice, bob);
    await h.asUser(alice);
    expect(await h.failure("select public.create_group_conversation('Study group', array[$1]::uuid[])", [carol])).toMatch(/only add your connections/i);
    await connect(alice, carol);
    await h.asUser(alice);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [alice, carol]);
    expect(await h.failure("select public.create_group_conversation('Study group', array[$1]::uuid[])", [carol])).toMatch(/only add your connections/i);
  });
});

describe("messaging: read state and group conversations", () => {
  it("tracks unread per person and lets only you move your own marker", async () => {
    await connect(alice, bob);
    const c = await startConversation(alice, bob, "One");
    await send(alice, c, "Two");
    await h.asUser(bob);
    const unread = () =>
      h.rows<{ n: number }>(
        `select count(*)::int as n from public.messages m join public.conversation_participants p
           on p.conversation_id = m.conversation_id and p.user_id = $1
          where m.sender_id <> $1 and m.created_at > p.last_read_at`,
        [bob],
      );
    expect(await unread()).toEqual([{ n: 2 }]);
    await h.db.query("update public.conversation_participants set last_read_at = now() + interval '1 second' where user_id = $1", [bob]);
    expect(await unread()).toEqual([{ n: 0 }]);
    // Nobody can edit someone else's marker, their status or their role.
    expect((await h.db.query("update public.conversation_participants set last_read_at = now() where user_id = $1", [alice])).affectedRows).toBe(0);
    expect(await h.failure("update public.conversation_participants set status = 'left' where user_id = $1", [bob])).toMatch(/permission denied/i);
    expect(await h.failure("update public.conversation_participants set role = 'admin' where user_id = $1", [bob])).toMatch(/permission denied/i);
  });

  it("creates groups of connections, keeps outsiders out, lets only an admin add, and lets people leave", async () => {
    await connect(alice, bob);
    await connect(alice, carol);
    const g = await group(alice, [bob, carol]);
    await send(bob, g, "Hi all");
    await h.asUser(carol);
    expect(await h.rows("select body from public.messages")).toEqual([{ body: "Hi all" }]);
    expect(await h.failure("select public.add_group_member($1, $2)", [g, dave])).toMatch(/Not allowed/i); // not an admin

    await h.asUser(admin);
    expect(await h.rows("select * from public.messages")).toHaveLength(0);
    expect(await sendFails(admin, g)).toMatch(/row-level security/i);

    await h.asUser(carol);
    await h.db.query("select public.leave_conversation($1)", [g]);
    expect(await h.rows("select * from public.messages")).toHaveLength(0);
    expect(await sendFails(carol, g)).toMatch(/row-level security/i);

    await h.asUser(alice);
    await h.db.query("select public.add_group_member($1, $2)", [g, carol]);
    await send(carol, g, "I'm back");
    await h.asUser(alice);
    expect(await h.failure("select public.create_group_conversation('', array[$1]::uuid[])", [bob])).toMatch(/conversations_title_valid/);
    expect(await h.failure("select public.create_group_conversation('Solo', array[]::uuid[])", [])).toMatch(/between 1 and 19/);
  });

  it("lets only the sender delete a message", async () => {
    await connect(alice, bob);
    const c = await startConversation(alice, bob, "Oops");
    await h.asUser(bob);
    expect((await h.db.query("delete from public.messages")).affectedRows).toBe(0);
    await h.asUser(alice);
    expect((await h.db.query("delete from public.messages")).affectedRows).toBe(1);
    expect(c).toBeTruthy();
  });
});

describe("messaging: reporting", () => {
  it("lets a participant report a message, hides it from outsiders, and lets staff remove it without reading the conversation", async () => {
    const c = await startConversation(alice, bob, "Send me your details");
    await h.asUser(bob);
    const messageId = (await h.rows<{ id: string }>("select id from public.messages"))[0].id;
    const r = (await h.db.query<{ submit_report: string }>("select public.submit_report('message', $1, 'harassment')", [messageId])).rows[0].submit_report;
    expect(await h.rows("select excerpt, target_member_id from public.reports")).toEqual([{ excerpt: "Send me your details", target_member_id: alice }]);

    await h.asUser(carol);
    expect(await h.failure("select public.submit_report('message', $1, 'spam')", [messageId])).toMatch(/no longer available/i);
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('message', $1, 'spam')", [messageId])).toMatch(/your own content/i);

    await h.asUser(admin);
    expect(await h.rows("select * from public.messages")).toHaveLength(0); // staff see the report, not the conversation
    expect((await h.rows<{ excerpt: string }>("select excerpt from public.reports"))[0].excerpt).toBe("Send me your details");
    await h.db.query("select public.moderate_report($1, 'remove_content', null, 'That message broke the guidelines.')", [r]);
    await h.asOwner();
    expect(await h.rows("select * from public.messages")).toHaveLength(0);
    expect(c).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Mentorship
// ---------------------------------------------------------------------------
const profile = (over: Record<string, unknown> = {}) => ({
  bio: "I have taught community nursing for twelve years.",
  expertise: "Community nursing education",
  experience: 12,
  organization: "Mercy College",
  topics: ["placements", "exam preparation"],
  languages: ["English", "French"],
  capacity: 2,
  formats: ["video", "chat"],
  acknowledged: true,
  ...over,
});

async function listAsMentor(user: string, over: Record<string, unknown> = {}) {
  const p = profile(over);
  await h.asUser(user);
  return h.failure(
    `insert into public.mentor_profiles (user_id, bio, expertise, experience_years, organization, topics, languages, capacity, session_formats, acknowledged)
     values ($1, $2, $3, $4, $5, $6::text[], $7::text[], $8, $9::text[], $10)`,
    [user, p.bio, p.expertise, p.experience, p.organization, p.topics, p.languages, p.capacity, p.formats, p.acknowledged],
  );
}

async function requestMentor(mentee: string, mentor: string, goals = "I want to prepare for my first community placement.") {
  await h.asUser(mentee);
  const r = await h.db.query<{ id: string }>(
    "insert into public.mentorship_requests (mentee_id, mentor_id, goals, preferred_format) values ($1, $2, $3, 'video') returning id",
    [mentee, mentor, goals],
  );
  return r.rows[0].id;
}

async function startMentorship(mentor: string, mentee: string) {
  expect(await listAsMentor(mentor)).toBeNull();
  const req = await requestMentor(mentee, mentor);
  await h.asUser(mentor);
  return (await h.db.query<{ id: string }>("select public.decide_mentorship_request($1, true) as id", [req])).rows[0].id;
}

describe("mentorship: becoming a mentor", () => {
  it("lets eligible members list, requires the acknowledgement, and keeps students and unfinished accounts out", async () => {
    expect(await listAsMentor(alice)).toBeNull();
    expect(await listAsMentor(bob, { acknowledged: false })).toMatch(/mentor_profiles_acknowledged/);
    expect(await listAsMentor(dave)).toMatch(/row-level security/i);
    await h.asOwner();
    await h.db.query("update public.profiles set member_type = 'graduate_student' where id = $1", [carol]);
    expect(await listAsMentor(carol)).toMatch(/row-level security/i);
    await h.asOwner();
    await h.db.query("update public.profiles set member_type = 'educator', career_stage = 'student' where id = $1", [carol]);
    expect(await listAsMentor(carol)).toMatch(/row-level security/i);
    await h.asOwner();
    await h.db.query("update public.profiles set career_stage = 'mid_career' where id = $1", [carol]);
  });

  it("validates the listing", async () => {
    expect(await listAsMentor(alice, { capacity: 11 })).toMatch(/mentor_profiles_capacity_valid/);
    expect(await listAsMentor(alice, { topics: [] })).toMatch(/mentor_profiles_topics_valid/);
    expect(await listAsMentor(alice, { formats: ["telepathy"] })).toMatch(/mentor_profiles_formats_valid/);
    expect(await listAsMentor(alice, { languages: [] })).toMatch(/mentor_profiles_languages_valid/);
    expect(await listAsMentor(alice, { bio: "too short" })).toMatch(/mentor_profiles_bio_length/);
    expect(await listAsMentor(alice, { experience: 80 })).toMatch(/mentor_profiles_experience_valid/);
    // Nobody lists on someone else's behalf.
    await h.asUser(alice);
    expect(await h.failure("insert into public.mentor_profiles (user_id, bio, expertise, experience_years, topics, languages, session_formats, acknowledged) values ($1, 'A long enough biography text.', 'Skills', 3, array['a'], array['English'], array['chat'], true)", [bob])).toMatch(/row-level security/i);
  });

  it("lets a mentor edit, pause and remove only their own listing, and hides a blocked mentor", async () => {
    await listAsMentor(alice);
    await h.asUser(bob);
    expect((await h.db.query("update public.mentor_profiles set capacity = 10 where user_id = $1", [alice])).affectedRows).toBe(0);
    expect((await h.db.query("delete from public.mentor_profiles")).affectedRows).toBe(0);
    expect(await h.rows("select user_id from public.mentor_profiles")).toEqual([{ user_id: alice }]);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [bob, alice]);
    expect(await h.rows("select * from public.mentor_profiles")).toHaveLength(0);
    await h.asUser(carol);
    expect(await h.rows("select * from public.mentor_profiles")).toHaveLength(1);
    await h.asUser(alice);
    expect(await h.failure("update public.mentor_profiles set user_id = $1", [bob])).toMatch(/permission denied/i);
    expect((await h.db.query("update public.mentor_profiles set accepting = false where user_id = $1", [alice])).affectedRows).toBe(1);
    await h.asUser(carol);
    expect(await requestMentorFails(carol, alice)).toMatch(/row-level security/i); // paused mentors take no requests
  });

  it("keeps availability internal: own windows only, valid, and limited", async () => {
    await listAsMentor(alice);
    await h.asUser(alice);
    await h.db.query("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 2, 540, 600, 'America/Toronto')", [alice]);
    expect(await h.failure("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 7, 540, 600, 'UTC')", [alice])).toMatch(/mentor_availability_weekday/);
    expect(await h.failure("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 1, 600, 540, 'UTC')", [alice])).toMatch(/mentor_availability_window/);
    for (let i = 0; i < 13; i++) await h.db.query("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 3, $2, $3, 'UTC')", [alice, i * 30, i * 30 + 15]);
    expect(await h.failure("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 4, 0, 30, 'UTC')", [alice])).toMatch(/up to 14/);
    await h.asUser(bob);
    expect(await h.rows("select * from public.mentor_availability")).toHaveLength(14);
    expect(await h.failure("insert into public.mentor_availability (mentor_id, weekday, start_minute, end_minute, timezone) values ($1, 1, 0, 30, 'UTC')", [alice])).toMatch(/row-level security|up to 14/i);
    expect((await h.db.query("delete from public.mentor_availability")).affectedRows).toBe(0);
  });
});

const requestMentorFails = async (mentee: string, mentor: string, goals = "I want to prepare for my first community placement.") => {
  await h.asUser(mentee);
  return h.failure("insert into public.mentorship_requests (mentee_id, mentor_id, goals) values ($1, $2, $3)", [mentee, mentor, goals]);
};

describe("mentorship: requests and relationships", () => {
  it("sends a request with goals, notifies the mentor, and keeps it private to the two people", async () => {
    await listAsMentor(alice);
    const req = await requestMentor(bob, alice);
    await h.asUser(alice);
    expect(await h.rows("select goals from public.mentorship_requests")).toHaveLength(1);
    expect(await h.rows("select type, actor_id from public.notifications where recipient_id = $1", [alice])).toEqual([{ type: "mentorship_event", actor_id: bob }]);
    await h.asUser(carol);
    expect(await h.rows("select * from public.mentorship_requests")).toHaveLength(0);
    expect(await h.failure("select public.decide_mentorship_request($1, true)", [req])).toMatch(/no longer open/i);
    expect((await h.db.query("delete from public.mentorship_requests")).affectedRows).toBe(0);
  });

  it("validates requests: goals, no duplicates, no self, no blocked pairs, a daily limit", async () => {
    await listAsMentor(alice);
    await listAsMentor(carol);
    expect(await requestMentorFails(bob, alice, "too short")).toMatch(/mentorship_requests_goals_length/);
    await requestMentor(bob, alice);
    expect(await requestMentorFails(bob, alice)).toMatch(/duplicate key/i);
    expect(await requestMentorFails(alice, alice)).toMatch(/row-level security|mentorship_requests_not_self/i);
    await h.asUser(carol);
    await h.db.query("insert into public.member_blocks (blocker_id, blocked_id) values ($1, $2)", [carol, bob]);
    expect(await requestMentorFails(bob, carol)).toMatch(/row-level security/i);
    await h.asUser(bob);
    expect(await h.failure("insert into public.mentorship_requests (mentee_id, mentor_id, goals) values ($1, $2, 'On behalf of someone else, a long goal.')", [carol, alice])).toMatch(/row-level security/i);
  });

  it("starts a mentorship on acceptance, opens a conversation, and respects capacity", async () => {
    await listAsMentor(alice, { capacity: 1 });
    const req = await requestMentor(bob, alice);
    await h.asUser(bob);
    expect(await h.failure("select public.decide_mentorship_request($1, true)", [req])).toMatch(/no longer open/i); // the mentee cannot decide
    await h.asUser(alice);
    const mid = (await h.db.query<{ id: string }>("select public.decide_mentorship_request($1, true) as id", [req])).rows[0].id;
    const m = await h.rows<{ status: string; conversation_id: string }>("select status, conversation_id from public.mentorships where id = $1", [mid]);
    expect(m[0].status).toBe("active");
    await send(alice, m[0].conversation_id, "Welcome! Let's plan our first session.");
    await send(bob, m[0].conversation_id, "Thank you!");
    await h.asUser(bob);
    expect(await h.rows("select * from public.notifications where recipient_id = $1 and entity_type = 'mentorship'", [bob])).toHaveLength(1);

    const second = await requestMentor(carol, alice);
    await h.asUser(alice);
    expect(await h.failure("select public.decide_mentorship_request($1, true)", [second])).toMatch(/capacity/i);
    await h.asUser(carol);
    expect(await h.rows("select * from public.mentorships")).toHaveLength(0);
    expect(await h.rows("select status from public.mentorship_requests")).toEqual([{ status: "pending" }]);
  });

  it("lets a mentor decline with a kind note the mentee can read", async () => {
    await listAsMentor(alice);
    const req = await requestMentor(bob, alice);
    await h.asUser(alice);
    await h.db.query("select public.decide_mentorship_request($1, false, 'My schedule is full this term.')", [req]);
    await h.asUser(bob);
    expect(await h.rows("select status, decline_note from public.mentorship_requests")).toEqual([{ status: "declined", decline_note: "My schedule is full this term." }]);
    expect(await h.rows("select * from public.mentorships")).toHaveLength(0);
    // After a decline a new request is allowed.
    await requestMentor(bob, alice, "A fresh request with new goals for next term.");
  });

  it("lets only the mentor pause and resume, either person finish, and only after completion leave private feedback", async () => {
    const mid = await startMentorship(alice, bob);
    await h.asUser(bob);
    expect(await h.failure("select public.set_mentorship_status($1, 'paused')", [mid])).toMatch(/Not allowed/i);
    expect(await h.failure("select public.set_mentorship_status($1, 'finished')", [mid])).toMatch(/Unknown status/i);
    await h.asUser(carol);
    expect(await h.failure("select public.set_mentorship_status($1, 'completed')", [mid])).toMatch(/no longer available/i);
    await h.asUser(alice);
    await h.db.query("select public.set_mentorship_status($1, 'paused')", [mid]);
    await h.db.query("select public.set_mentorship_status($1, 'active')", [mid]);

    // Feedback needs a completed mentorship.
    await h.asUser(bob);
    expect(await h.failure("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 5)", [mid, bob])).toMatch(/row-level security/i);
    await h.db.query("select public.set_mentorship_status($1, 'completed')", [mid]);
    expect(await h.failure("select public.set_mentorship_status($1, 'active')", [mid])).toMatch(/no longer available/i);

    await h.db.query("insert into public.mentorship_feedback (mentorship_id, author_id, rating, comment) values ($1, $2, 5, 'Very helpful')", [mid, bob]);
    expect(await h.failure("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 4)", [mid, bob])).toMatch(/duplicate key/i);
    expect(await h.failure("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 9)", [mid, alice])).toMatch(/row-level security|mentorship_feedback_rating/i);
    expect(await h.failure("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 3)", [mid, carol])).toMatch(/row-level security/i);
    await h.asUser(alice);
    await h.db.query("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 4)", [mid, alice]);
    expect(await h.rows("select author_id from public.mentorship_feedback order by rating")).toHaveLength(2); // each sees both
    await h.asUser(carol);
    expect(await h.rows("select * from public.mentorship_feedback")).toHaveLength(0);
    expect(await h.rows("select * from public.mentorships")).toHaveLength(0);
    await h.asUser(admin);
    expect(await h.rows("select * from public.mentorship_feedback")).toHaveLength(0);
  });

  it("lets either person end a mentorship early", async () => {
    const mid = await startMentorship(alice, bob);
    await h.asUser(bob);
    await h.db.query("select public.set_mentorship_status($1, 'ended')", [mid]);
    expect(await h.rows("select status from public.mentorships")).toEqual([{ status: "ended" }]);
    expect(await h.failure("insert into public.mentorship_feedback (mentorship_id, author_id, rating) values ($1, $2, 3)", [mid, bob])).toMatch(/row-level security/i);
  });

  it("lets members report a mentor profile and staff remove the listing", async () => {
    await listAsMentor(alice);
    await h.asUser(bob);
    const r = (await h.db.query<{ submit_report: string }>("select public.submit_report('mentor', $1, 'impersonation')", [alice])).rows[0].submit_report;
    await h.asUser(alice);
    expect(await h.failure("select public.submit_report('mentor', $1, 'spam')", [alice])).toMatch(/your own content/i);
    await h.asUser(admin);
    await h.db.query("select public.moderate_report($1, 'remove_content', null, 'Your mentor listing was removed.')", [r]);
    await h.asOwner();
    expect(await h.rows("select * from public.mentor_profiles")).toHaveLength(0);
  });
});
