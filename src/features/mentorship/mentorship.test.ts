// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const MENTOR = "22222222-2222-4222-8222-222222222222";
const R = "33333333-3333-4333-8333-333333333333";

let db = makeDb();
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({ requireMember: async () => ({ user: { id: ME }, profile: { id: ME } }) }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/mentorship/actions");
const schemas = await import("@/features/mentorship/schemas");
const queries = await import("@/features/mentorship/queries");
const options = await import("@/features/mentorship/options");
const idle = { status: "idle" as const };

const profileForm = (over: Record<string, string | string[] | undefined> = {}) =>
  makeFormData({
    bio: "I have taught community nursing for twelve years.",
    expertise: "Community nursing education",
    experienceYears: "12",
    organization: "Mercy College",
    topics: "Placements, exam preparation, placements",
    languages: "English, French",
    capacity: "3",
    formats: ["video", "chat"],
    accepting: "on",
    acknowledged: "on",
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  limit = { ok: true };
  rpc.mockResolvedValue({ data: null, error: null });
});

describe("mentor listing", () => {
  it("normalises topics and languages and updates an existing listing in place", async () => {
    expect(await actions.saveMentorProfile(idle, profileForm())).toMatchObject({ status: "success" });
    const write = db.writes()[0];
    expect(write).toMatchObject({ table: "mentor_profiles", kind: "update" });
    expect(write.payload).toMatchObject({
      topics: ["placements", "exam preparation"],
      languages: ["english", "french"],
      session_formats: ["video", "chat"],
      experience_years: 12,
      capacity: 3,
      acknowledged: true,
    });
    // The owner is a filter, never a field to change.
    expect(write.filters).toContainEqual(["user_id", ME]);
    expect((write.payload as Record<string, unknown>).user_id).toBeUndefined();
  });

  it("inserts for the session's member when there is no listing yet", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [] } : undefined));
    expect(await actions.saveMentorProfile(idle, profileForm())).toMatchObject({ status: "success" });
    expect(db.writes().map((w) => w.kind)).toEqual(["update", "insert"]);
    expect(db.writes()[1].payload).toMatchObject({ user_id: ME });
  });

  it("requires the acknowledgement and valid details before touching the database", async () => {
    for (const over of [
      { acknowledged: undefined },
      { bio: "short" },
      { topics: " , " },
      { languages: "" },
      { capacity: "11" },
      { formats: [] as string[] },
      { experienceYears: "-1" },
    ]) {
      expect((await actions.saveMentorProfile(idle, profileForm(over))).status).toBe("error");
    }
    const result = await actions.saveMentorProfile(idle, profileForm({ acknowledged: undefined }));
    expect(result.fieldErrors?.acknowledged?.[0]).toMatch(/confirm/i);
    expect(db.writes()).toHaveLength(0);
  });

  it("tells a student they can't list, without exposing the policy", async () => {
    db = makeDb((op) => (op.kind === "update" ? { data: [] } : op.kind === "insert" ? { error: { code: "42501", message: "row-level security" } } : undefined));
    const result = await actions.saveMentorProfile(idle, profileForm());
    expect(result).toEqual({ status: "error", message: "Students can't list as mentors. You can ask a mentor to guide you instead." });
  });

  it("validates availability windows", async () => {
    const good = makeFormData({ weekday: "2", start: "09:00", end: "10:30", timezone: "America/Toronto" });
    expect(await actions.addAvailability(idle, good)).toMatchObject({ status: "success" });
    expect(db.writes()[0].payload).toEqual({ mentor_id: ME, weekday: 2, start_minute: 540, end_minute: 630, timezone: "America/Toronto" });
    for (const over of [{ start: "10:00", end: "09:00" }, { timezone: "Mars/Olympus" }, { weekday: "9" }, { start: "later" }]) {
      const bad = makeFormData({ weekday: "2", start: "09:00", end: "10:30", timezone: "UTC", ...over });
      expect((await actions.addAvailability(idle, bad)).status).toBe("error");
    }
    expect(options.timeToMinutes("24:00")).toBe(1440);
    expect(options.timeToMinutes("25:00")).toBeNull();
    expect(options.minutesToTime(630)).toBe("10:30");
  });
});

describe("requests and relationships", () => {
  const goals = "I want to prepare for my first community placement.";

  it("sends a request as the session's member", async () => {
    expect(await actions.sendMentorshipRequest(MENTOR, `  ${goals}  `, "video")).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({
      table: "mentorship_requests",
      payload: { mentee_id: ME, mentor_id: MENTOR, goals, preferred_format: "video" },
    });
  });

  it("refuses short goals, yourself and bad formats before asking the database", async () => {
    expect(await actions.sendMentorshipRequest(MENTOR, "too short")).toMatchObject({ ok: false });
    expect(await actions.sendMentorshipRequest(ME, goals)).toEqual({ ok: false, error: "You can't ask yourself to be your mentor." });
    expect(await actions.sendMentorshipRequest(MENTOR, goals, "telepathy")).toMatchObject({ ok: false });
    expect(db.writes()).toHaveLength(0);
  });

  it("explains duplicates and closed listings without saying why a mentor refused", async () => {
    db = makeDb(() => ({ error: { code: "23505", message: "dup" } }));
    expect(await actions.sendMentorshipRequest(MENTOR, goals)).toEqual({ ok: false, error: "You already have a request waiting with this mentor." });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.sendMentorshipRequest(MENTOR, goals)).toEqual({ ok: false, error: "This mentor isn't taking requests right now." });
    limit = { ok: false, message: "Slow down." };
    expect(await actions.sendMentorshipRequest(MENTOR, goals)).toEqual({ ok: false, error: "Slow down." });
  });

  it("withdraws only the member's own pending request", async () => {
    await actions.withdrawMentorshipRequest(R);
    expect(db.writes()[0].filters).toEqual(expect.arrayContaining([["id", R], ["mentee_id", ME], ["status", "pending"]]));
  });

  it("lets the mentor decide through the database function, which checks capacity", async () => {
    expect(await actions.decideMentorshipRequest(R, true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("decide_mentorship_request", { p_request: R, p_accept: true, p_note: null });
    await actions.decideMentorshipRequest(R, false, "  My schedule is full.  ");
    expect(rpc).toHaveBeenLastCalledWith("decide_mentorship_request", { p_request: R, p_accept: false, p_note: "My schedule is full." });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "You are at your mentoring capacity. Raise it or finish a mentorship first." } });
    expect(await actions.decideMentorshipRequest(R, true)).toEqual({ ok: false, error: "You are at your mentoring capacity. Raise it or finish a mentorship first." });
    expect(await actions.decideMentorshipRequest("bad", true)).toMatchObject({ ok: false });
    expect(await actions.decideMentorshipRequest(R, false, "x".repeat(501))).toMatchObject({ ok: false });
  });

  it("changes a mentorship's status with a validated value and explains a refusal", async () => {
    expect(await actions.changeMentorshipStatus(R, "paused")).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("set_mentorship_status", { p_mentorship: R, p_status: "paused" });
    expect(await actions.changeMentorshipStatus(R, "finished")).toMatchObject({ ok: false });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "Not allowed" } });
    expect(await actions.changeMentorshipStatus(R, "paused")).toEqual({ ok: false, error: "Only the mentor can pause or resume a mentorship." });
  });

  it("leaves feedback as the session's member, once, after completion", async () => {
    expect(await actions.submitMentorshipFeedback(R, 5, " Very helpful ")).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "mentorship_feedback", payload: { mentorship_id: R, author_id: ME, rating: 5, comment: "Very helpful" } });
    expect(await actions.submitMentorshipFeedback(R, 6)).toMatchObject({ ok: false });
    db = makeDb(() => ({ error: { code: "23505", message: "dup" } }));
    expect(await actions.submitMentorshipFeedback(R, 4)).toEqual({ ok: false, error: "You have already left feedback for this mentorship." });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.submitMentorshipFeedback(R, 4)).toEqual({ ok: false, error: "Feedback can be left once a mentorship is completed." });
  });
});

describe("finding mentors", () => {
  it("drops unknown filters and builds lower-case topic and language terms", () => {
    expect(schemas.parseMentorFilters({ field: "magic", years: "99", format: "telepathy", topic: "Exam Prep%", language: "French", page: "-1" })).toEqual({
      q: "",
      field: undefined,
      topic: "exam prep",
      language: "french",
      minYears: undefined,
      format: undefined,
      page: 1,
    });
    expect(schemas.parseMentorFilters({ field: "nursing", years: "10", format: "video", page: "2" })).toMatchObject({ field: "nursing", minYears: 10, format: "video", page: 2 });
  });

  it("lists only mentors accepting requests, never the viewer, with every filter as data", async () => {
    const member = { id: MENTOR, username: "mentor_m", first_name: "Mia", last_name: "M", headline: null, avatar_path: null, member_type: "educator", institution: null, specialty: null, fields: ["nursing"], country: "CA", location_label: null, open_to_mentor: true, looking_for_mentorship: false };
    db = makeDb((op) => (op.table === "mentor_profiles" ? { data: [{ user_id: MENTOR, bio: "b", expertise: "e", experience_years: 12, organization: null, topics: ["placements"], languages: ["english"], capacity: 2, session_formats: ["video"], accepting: true, member }, { user_id: "x", member: null }], count: 2 } : undefined));
    const result = await queries.listMentors(ME, { q: "nurs", field: "nursing", topic: "placements", language: "english", minYears: 5, format: "video", page: 1 });
    expect(result.mentors.map((m) => m.user_id)).toEqual([MENTOR]); // an orphan row without a member is dropped
    const filters = db.ops[0].filters;
    expect(filters).toEqual(expect.arrayContaining([["accepting", true], ["user_id!=", ME], ["topics contains", ["placements"]], ["languages contains", ["english"]], ["session_formats contains", ["video"]], ["experience_years>=", 5], ["member.fields cs", "{nursing}"]]));
  });

  it("keeps a feedback author's words private to the pair by only asking for the viewer's mentorships", async () => {
    db = makeDb((op) => (op.table === "mentorships" ? { data: [] } : undefined));
    expect(await queries.listMentorships(ME)).toEqual({ entries: [] });
    expect(db.ops.some((o) => o.table === "mentorship_feedback")).toBe(false);
  });
});
