// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDb } from "@/test/db-mock";
import { makeFormData, redirectMock, redirectOf } from "@/test/mocks";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const Q = "33333333-3333-4333-8333-333333333333";
const A = "44444444-4444-4444-8444-444444444444";

let db = makeDb();
let limit: { ok: true } | { ok: false; message: string } = { ok: true };
const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirectMock(url) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ ...db.client, rpc }) }));
vi.mock("@/lib/auth/session", () => ({
  requireMember: async () => ({ user: { id: ME }, profile: { id: ME } }),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => limit }));
vi.mock("@/lib/monitoring/report", () => ({ reportError: vi.fn() }));

const actions = await import("@/features/forums/actions");
const queries = await import("@/features/forums/queries");
const schemas = await import("@/features/forums/schemas");
const format = await import("@/features/notifications/format");
const safetySchemas = await import("@/features/safety/schemas");
const { exportMemberData } = await import("@/features/privacy/export");
const idle = { status: "idle" as const };

const askForm = (over: Record<string, string | undefined> = {}) =>
  makeFormData({
    topic: "evidence-and-research",
    kind: "evidence",
    title: "How should I appraise a small trial?",
    body: "I am reading a trial with forty participants.",
    confirmed: "on",
    ...over,
  });

beforeEach(() => {
  vi.clearAllMocks();
  db = makeDb();
  limit = { ok: true };
  rpc.mockResolvedValue({ data: Q, error: null });
});

describe("askQuestion", () => {
  it("sends the question through the database function and goes to it", async () => {
    const target = await redirectOf(() => actions.askQuestion(idle, askForm()));
    expect(target).toBe(`/forums/${Q}`);
    expect(rpc).toHaveBeenCalledWith("ask_question", {
      p_topic: "evidence-and-research",
      p_kind: "evidence",
      p_title: "How should I appraise a small trial?",
      p_body: "I am reading a trial with forty participants.",
      p_anonymous: false,
      p_confirmed: true,
    });
    // The writer is never in the payload: the database takes it from the session.
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain(ME);
  });

  it("passes the anonymous choice through and still never names the writer", async () => {
    await redirectOf(() => actions.askQuestion(idle, askForm({ anonymous: "on" })));
    expect(rpc.mock.calls[0][1].p_anonymous).toBe(true);
    expect(JSON.stringify(rpc.mock.calls[0][1])).not.toContain(ME);
    expect(db.writes()).toHaveLength(0); // no direct table write that could carry an author
  });

  it("refuses an unconfirmed question, a short title and an unknown kind before asking the database", async () => {
    for (const over of [{ confirmed: undefined }, { title: "Short" }, { kind: "diagnosis" }, { body: "  " }, { topic: "Not A Slug" }]) {
      const result = await actions.askQuestion(idle, askForm(over));
      expect(result).toMatchObject({ status: "error" });
    }
    const unconfirmed = await actions.askQuestion(idle, askForm({ confirmed: undefined }));
    expect(unconfirmed.fieldErrors?.confirmed?.[0]).toMatch(/identifiable/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("shows the database's rate-limit message and hides other errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "23514", message: "You are asking questions too quickly. Please try again later." } });
    expect(await actions.askQuestion(idle, askForm())).toEqual({
      status: "error",
      message: "You are asking questions too quickly. Please try again later.",
    });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "secret internals" } });
    expect(await actions.askQuestion(idle, askForm())).toEqual({ status: "error", message: "Something went wrong. Please try again." });
    limit = { ok: false, message: "Slow down." };
    expect(await actions.askQuestion(idle, askForm())).toEqual({ status: "error", message: "Slow down." });
  });
});

describe("answers, replies, votes and acceptance", () => {
  it("posts an answer and a reply through the database functions", async () => {
    expect(await actions.postAnswer(Q, "  Look at allocation concealment.  ", true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("post_answer", { p_question: Q, p_body: "Look at allocation concealment.", p_anonymous: true });
    expect(await actions.postReply(A, "Thanks!", false)).toEqual({ ok: true });
    expect(rpc).toHaveBeenLastCalledWith("post_reply", { p_answer: A, p_body: "Thanks!", p_anonymous: false });
  });

  it("rejects empty text and malformed ids, and reports an unavailable question plainly", async () => {
    expect(await actions.postAnswer(Q, "   ", false)).toMatchObject({ ok: false });
    expect(await actions.postAnswer("nope", "text", false)).toMatchObject({ ok: false });
    expect(await actions.postReply(A, "x".repeat(1001), false)).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002", message: "That question is no longer available." } });
    expect(await actions.postAnswer(Q, "An answer", false)).toEqual({ ok: false, error: "That is no longer available." });
  });

  it("votes helpful idempotently and refuses voting on your own answer", async () => {
    expect(await actions.setHelpful(A, true)).toEqual({ ok: true, on: true });
    expect(db.writes()[0]).toMatchObject({ table: "forum_votes", kind: "insert", payload: { answer_id: A, user_id: ME } });

    db = makeDb(() => ({ error: { code: "23505", message: "duplicate" } }));
    expect(await actions.setHelpful(A, true)).toEqual({ ok: true, on: true });

    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.setHelpful(A, true)).toEqual({ ok: false, error: "You can't mark your own answer helpful." });

    db = makeDb();
    expect(await actions.setHelpful(A, false)).toEqual({ ok: true, on: false });
    expect(db.writes()[0]).toMatchObject({ table: "forum_votes", kind: "delete" });
  });

  it("accepts an answer and clears the choice, and reports when the member is not the asker", async () => {
    expect(await actions.acceptAnswer(Q, A)).toEqual({ ok: true });
    expect(db.writes()[0]).toMatchObject({ table: "forum_questions", kind: "update", payload: { accepted_answer_id: A } });
    expect(await actions.acceptAnswer(Q, null)).toEqual({ ok: true });

    db = makeDb(() => ({ data: [] }));
    expect(await actions.acceptAnswer(Q, A)).toEqual({ ok: false, error: "Only the person who asked can choose an accepted answer." });
    db = makeDb(() => ({ error: { code: "42501", message: "rls" } }));
    expect(await actions.acceptAnswer(Q, A)).toMatchObject({ ok: false });
    expect(await actions.acceptAnswer("bad", A)).toMatchObject({ ok: false });
  });

  it("follows, saves and deletes, reporting a change that touched nothing", async () => {
    expect(await actions.setFollow(Q, true)).toEqual({ ok: true, on: true });
    expect(db.writes()[0]).toMatchObject({ table: "forum_follows", payload: { question_id: Q, user_id: ME } });
    expect(await actions.setSavedForum("forum_answer", A, true)).toEqual({ ok: true, saved: true });
    expect(db.writes().at(-1)).toMatchObject({ table: "saved_items", payload: { user_id: ME, item_type: "forum_answer", item_id: A } });
    expect(await actions.setSavedForum("post" as never, A, true)).toMatchObject({ ok: false });

    expect(await actions.deleteQuestion(Q)).toEqual({ ok: true });
    db = makeDb(() => ({ data: [] }));
    expect(await actions.deleteAnswer(A)).toEqual({ ok: false, error: "That item no longer exists, or it isn't yours to change." });
    expect(await actions.deleteReply("bad")).toMatchObject({ ok: false });
  });
});

describe("reading: anonymous content never names a writer", () => {
  const author = { id: OTHER, username: "alice_a", first_name: "Alice", last_name: "A", headline: null, avatar_path: null, member_type: "educator" };
  const questionRow = {
    id: Q,
    title: "An anonymous question title",
    body: "Body",
    topic_slug: "other",
    kind: "other",
    is_anonymous: true,
    accepted_answer_id: A,
    created_at: "2026-11-03T10:00:00Z",
    edited_at: null,
    // Even if a row somehow arrived with an author attached, the reading code must not show it.
    author,
    answers: [{ count: 2 }],
  };

  it("drops any author on an anonymous question, answer or reply", async () => {
    db = makeDb((op) => {
      if (op.table === "forum_questions") return { data: questionRow };
      if (op.table === "forum_answers")
        return {
          data: [
            { id: A, question_id: Q, body: "Anonymous answer", created_at: "2026-11-03T11:00:00Z", edited_at: null, is_anonymous: true, author, votes: [{ count: 3 }] },
            { id: "55555555-5555-4555-8555-555555555555", question_id: Q, body: "Public answer", created_at: "2026-11-03T12:00:00Z", edited_at: null, is_anonymous: false, author, votes: [{ count: 5 }] },
          ],
        };
      if (op.table === "forum_replies")
        return { data: [{ id: "66666666-6666-4666-8666-666666666666", answer_id: A, body: "Reply", created_at: "2026-11-03T13:00:00Z", is_anonymous: true, author }] };
      if (op.table === "forum_identity") return { data: [{ content_type: "question", content_id: Q }, { content_type: "answer", content_id: A }] };
      return undefined;
    });
    const detail = await queries.getQuestion(ME, Q);
    expect(detail).not.toBeNull();
    expect(detail!.author).toBeNull();
    expect(detail!.isMine).toBe(true);
    const anon = detail!.answers.find((a) => a.id === A)!;
    expect(anon.author).toBeNull();
    expect(anon.isMine).toBe(true);
    expect(anon.replies[0].author).toBeNull();
    expect(anon.replies[0].isMine).toBe(false);
    // The accepted answer comes first even though another has more helpful marks.
    expect(detail!.answers[0].id).toBe(A);
    const publicAnswer = detail!.answers.find((a) => a.id !== A)!;
    expect(publicAnswer.author?.id).toBe(OTHER);
    expect(publicAnswer.helpfulCount).toBe(5);
    expect(JSON.stringify([detail!.author, anon.author, anon.replies[0].author])).not.toContain("Alice");
  });

  it("asks the private identity table only about the viewer's own rows", async () => {
    db = makeDb((op) => (op.table === "forum_questions" ? { data: { ...questionRow, is_anonymous: false } } : undefined));
    await queries.getQuestion(ME, Q);
    const identity = db.ops.find((o) => o.table === "forum_identity")!;
    expect(identity.filters).toContainEqual(["author_id", ME]);
  });

  it("returns nothing for a question the viewer cannot see", async () => {
    db = makeDb(() => ({ data: null }));
    expect(await queries.getQuestion(ME, Q)).toBeNull();
  });

  it("keeps anonymous questions in lists when members are hidden, and lists only the viewer's own under My questions", async () => {
    db = makeDb((op) => {
      if (op.table === "member_blocks") return { data: [{ blocked_id: OTHER }] };
      if (op.table === "forum_questions") return { data: [{ ...questionRow, answers: [] }], count: 1 };
      return undefined;
    });
    const list = await queries.listQuestions(ME, { q: "", filter: "all", page: 1 });
    expect(list.questions[0].author).toBeNull();
    expect(list.questions[0].is_anonymous).toBe(true);
    const or = db.ops.find((o) => o.table === "forum_questions")!.filters.find(([k]) => k === "or");
    expect(or?.[1]).toBe(`author_id.is.null,author_id.not.in.(${OTHER})`);

    db = makeDb((op) => (op.table === "forum_identity" ? { data: [{ content_id: Q }] } : op.table === "forum_questions" ? { data: [], count: 0 } : undefined));
    await queries.listQuestions(ME, { q: "", filter: "mine", page: 1 });
    expect(db.ops.find((o) => o.table === "forum_identity")!.filters).toContainEqual(["author_id", ME]);
    expect(db.ops.find((o) => o.table === "forum_questions")!.filters).toContainEqual(["id", [Q]]);
  });
});

describe("search and filters", () => {
  it("cleans search text and drops unknown filters", () => {
    const parsed = schemas.parseListParams({ q: "  pharmacology\u0000\n trials ", kind: "diagnosis", filter: "everything", page: "-4", topic: "Bad Topic" });
    expect(parsed).toEqual({ q: "pharmacology trials", topic: undefined, kind: undefined, filter: "all", page: 1 });
    expect(schemas.parseListParams({ kind: "evidence", filter: "mine", page: "3", topic: "study-and-exams" })).toMatchObject({
      kind: "evidence",
      filter: "mine",
      page: 3,
      topic: "study-and-exams",
    });
    expect(schemas.parseListParams({ q: "x".repeat(500) }).q).toHaveLength(80);
  });
});

describe("notifications and reports for forum content", () => {
  it("words forum notifications without needing an actor and links to the question", () => {
    const base = { id: "n", created_at: "2026-11-03T10:00:00Z", read_at: null, actor: null, entity_type: "forum_question" as const, entity_id: Q };
    expect(format.actorName(null)).toBe("A member");
    expect(format.describeAction("forum_answer")).toMatch(/answered/);
    expect(format.describeAction("forum_answer_accepted")).toMatch(/accepted your answer/);
    for (const type of ["forum_answer", "forum_reply", "forum_answer_accepted"] as const) {
      expect(format.notificationHref({ ...base, type })).toBe(`/forums/${Q}`);
    }
    expect(format.notificationHref({ ...base, type: "forum_answer", entity_id: null })).toBe("/notifications");
    expect(format.notificationHref({ ...base, type: "community_post_removed", entity_type: "community" })).toBe("/communities");
  });

  it("accepts forum and community content as report targets", () => {
    for (const targetType of ["question", "answer", "reply", "community"]) {
      expect(safetySchemas.reportSchema.safeParse({ targetType, targetId: Q, reason: "spam" }).success).toBe(true);
    }
    expect(safetySchemas.reportSchema.safeParse({ targetType: "message", targetId: Q, reason: "spam" }).success).toBe(false);
  });
});

describe("data export", () => {
  it("includes the member's own anonymous posts, found through the private record, and asks only about them", async () => {
    db = makeDb((op) => {
      if (op.table === "forum_identity") return { data: [{ content_type: "question", content_id: Q }] };
      if (op.table === "forum_questions") return { data: [{ id: Q, title: "My anonymous question", is_anonymous: true }] };
      return undefined;
    });
    const out = (await exportMemberData(
      { id: ME, email: "me@example.com", created_at: "2026-01-01T00:00:00Z" },
      db.client as never,
    )) as unknown as { forums: { note: string; questions: { id: string }[] } };
    expect(out.forums.questions).toEqual([{ id: Q, title: "My anonymous question", is_anonymous: true }]);
    expect(out.forums.note).toMatch(/anonymously/i);
    const identity = db.ops.find((o) => o.table === "forum_identity")!;
    expect(identity.filters).toContainEqual(["author_id", ME]);
  });
});
