import "server-only";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * A copy of the data Medyra holds about one member, for the "download my data" request.
 *
 * It is built from reads made with the member's own session, so it can only ever contain what
 * row level security lets that member see; every table below is also filtered to the member. It
 * includes the member's own content and settings, and for connections, follows, blocks and mutes
 * only the other member's id (not their profile). Moderation notes written by staff are not
 * included (they are not readable by the member). Passwords are held by
 * Supabase Auth and are not exported.
 */
const LIMIT = 10_000;

async function section(run: () => PromiseLike<{ data: unknown; error: unknown }>) {
  const { data, error } = await run();
  return error ? { unavailable: true } : (data ?? []);
}

/** Reads rows by id in small batches so a large export never builds an over-long request. */
async function rowsByIds(db: Supabase, table: "forum_questions" | "forum_answers" | "forum_replies", columns: string, ids: string[]) {
  const rows: unknown[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from(table).select(columns).in("id", ids.slice(i, i + 100)).overrideTypes<unknown[], { merge: false }>();
    if (error) return { unavailable: true };
    rows.push(...(data ?? []));
  }
  return rows;
}

/**
 * The member's forum content. Anonymous posts are included on purpose: they are this member's own
 * data, and they come from the private identity records only this member can read.
 */
async function forumSection(db: Supabase, me: string) {
  const { data, error } = await db
    .from("forum_identity")
    .select("content_type, content_id")
    .eq("author_id", me)
    .limit(LIMIT)
    .overrideTypes<{ content_type: string; content_id: string }[], { merge: false }>();
  if (error) return { unavailable: true };
  const ids = (type: string) => (data ?? []).filter((i) => i.content_type === type).map((i) => i.content_id);
  const [questions, answers, replies, votes, follows] = await Promise.all([
    rowsByIds(db, "forum_questions", "id, topic_slug, kind, title, body, is_anonymous, created_at, edited_at", ids("question")),
    rowsByIds(db, "forum_answers", "id, question_id, body, is_anonymous, created_at, edited_at", ids("answer")),
    rowsByIds(db, "forum_replies", "id, answer_id, body, is_anonymous, created_at", ids("reply")),
    section(() => db.from("forum_votes").select("answer_id, created_at").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("forum_follows").select("question_id, created_at").eq("user_id", me).limit(LIMIT)),
  ]);
  return {
    note: "Includes anything you posted anonymously. Other members cannot see that it is yours.",
    questions,
    answers,
    replies,
    helpful_votes: votes,
    followed_questions: follows,
  };
}

export async function exportMemberData(user: Pick<User, "id" | "email" | "created_at" | "last_sign_in_at">, supabase?: Supabase) {
  const db = supabase ?? (await createClient());
  const me = user.id;

  const [
    profile, onboarding, education, experience, skills, posts, comments, likes, connections, follows,
    blocks, mutes, saved, notifications, notificationPreferences, consents, requests, notices, appeals, reports,
    communityMemberships, communityRequests, communityPosts, forum,
  ] = await Promise.all([
    section(() => db.from("profiles").select("*").eq("id", me).maybeSingle()),
    section(() => db.from("onboarding_preferences").select("*").eq("user_id", me).maybeSingle()),
    section(() => db.from("profile_education").select("*").eq("profile_id", me).limit(LIMIT)),
    section(() => db.from("profile_experience").select("*").eq("profile_id", me).limit(LIMIT)),
    section(() => db.from("profile_skills").select("*").eq("profile_id", me).limit(LIMIT)),
    section(() => db.from("posts").select("*").eq("author_id", me).limit(LIMIT)),
    section(() => db.from("post_comments").select("*").eq("author_id", me).limit(LIMIT)),
    section(() => db.from("post_likes").select("post_id, created_at").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("connections").select("*").or(`requester_id.eq.${me},addressee_id.eq.${me}`).limit(LIMIT)),
    section(() => db.from("follows").select("*").or(`follower_id.eq.${me},followee_id.eq.${me}`).limit(LIMIT)),
    section(() => db.from("member_blocks").select("*").eq("blocker_id", me).limit(LIMIT)),
    section(() => db.from("member_mutes").select("*").eq("muter_id", me).limit(LIMIT)),
    section(() => db.from("saved_items").select("*").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("notifications").select("*").eq("recipient_id", me).limit(LIMIT)),
    section(() => db.from("notification_preferences").select("*").eq("user_id", me).maybeSingle()),
    section(() => db.from("consent_records").select("*").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("data_requests").select("*").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("member_notices").select("*").eq("member_id", me).limit(LIMIT)),
    section(() => db.from("appeals").select("*").eq("member_id", me).limit(LIMIT)),
    section(() => db.from("reports").select("id, target_type, target_id, reason, details, status, created_at").eq("reporter_id", me).limit(LIMIT)),
    section(() => db.from("community_members").select("community_id, role, joined_at").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("community_requests").select("community_id, message, status, created_at").eq("user_id", me).limit(LIMIT)),
    section(() => db.from("posts").select("id, community_id").eq("author_id", me).not("community_id", "is", null).limit(LIMIT)),
    forumSection(db, me),
  ]);

  return {
    about: {
      generated_at: new Date().toISOString(),
      note: "A copy of the personal information Medyra holds about you. Passwords are held by the sign-in provider and are not included.",
    },
    account: { id: me, email: user.email ?? null, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null },
    profile,
    onboarding_preferences: onboarding,
    education,
    experience,
    skills,
    posts,
    comments,
    likes,
    connections,
    follows,
    blocks,
    mutes,
    saved_items: saved,
    notifications,
    notification_preferences: notificationPreferences,
    consent_records: consents,
    data_requests: requests,
    moderation_notices: notices,
    appeals,
    reports_you_filed: reports,
    community_memberships: communityMemberships,
    community_join_requests: communityRequests,
    community_post_ids: communityPosts,
    forums: forum,
  };
}
