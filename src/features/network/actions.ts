"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import { connectionIdSchema, memberIdSchema } from "@/features/network/schemas";
import { getRelationship } from "@/features/network/queries";
import {
  noRelationship,
  type NetworkActionResult,
  type Relationship,
} from "@/features/network/types";

/**
 * Every action starts with requireMember(). The acting member always comes from that verified
 * session, never from an argument, and each write is also filtered by it (`requester_id`,
 * `addressee_id`, `follower_id`...). Row level security enforces the same rules again, including
 * "no duplicates", "no self requests" and "nothing between blocked members".
 *
 * Responses never say whether a block is the reason something failed.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const UNAVAILABLE = "That request is no longer available.";
const CANNOT = "You can't do that with this member.";

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** The database rate limit raises a readable message; anything else stays generic. */
const friendly = (error: { message?: string } | null | undefined) =>
  error?.message && /too quickly/i.test(error.message) ? error.message : GENERIC_ERROR;

type Done = NetworkActionResult<{ relationship: Relationship }>;

function refresh() {
  revalidatePath("/network", "layout");
  revalidatePath("/profile/[username]", "page");
}

async function done(viewerId: string, otherId: string | null | undefined): Promise<Done> {
  refresh();
  const relationship = otherId
    ? await getRelationship(viewerId, otherId)
    : noRelationship;
  return { ok: true, relationship };
}

async function gate(userId: string) {
  const limited = await checkRateLimit("network", userId);
  return limited.ok ? null : limited.message;
}

export async function sendConnectionRequest(memberId: string): Promise<Done> {
  const { user } = await requireMember();
  if (!memberIdSchema.safeParse(memberId).success) return fail(CANNOT);
  if (memberId === user.id) return fail("You can't connect with yourself.");
  const blocked = await gate(user.id);
  if (blocked) return fail(blocked);

  const supabase = await createClient();
  const { error } = await supabase
    .from("connections")
    .insert({ requester_id: user.id, addressee_id: memberId });

  // 23505: a request (either direction) or connection already exists. That is the outcome the
  // member wanted, so report the current state instead of an error.
  if (error && error.code !== "23505") {
    // 42501: row level security (a block, or a member who has not finished joining).
    if (error.code === "42501") return fail(CANNOT);
    reportError("connections.insert", error);
    return fail(friendly(error));
  }
  return done(user.id, memberId);
}

export async function acceptRequest(connectionId: string): Promise<Done> {
  const { user } = await requireMember();
  if (!connectionIdSchema.safeParse(connectionId).success) return fail(UNAVAILABLE);
  const blocked = await gate(user.id);
  if (blocked) return fail(blocked);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .update({ status: "accepted" })
    .eq("id", connectionId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select("id, requester_id")
    .overrideTypes<{ id: string; requester_id: string }[], { merge: false }>();
  if (error) {
    reportError("connections.accept", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(UNAVAILABLE);
  return done(user.id, data[0].requester_id);
}

type Parties = { requester_id: string; addressee_id: string }[];

const otherParty = (viewerId: string, rows: Parties | null) =>
  rows?.[0]
    ? rows[0].requester_id === viewerId
      ? rows[0].addressee_id
      : rows[0].requester_id
    : null;

export async function declineRequest(connectionId: string): Promise<Done> {
  const { user } = await requireMember();
  if (!connectionIdSchema.safeParse(connectionId).success) return fail(UNAVAILABLE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId)
    .eq("addressee_id", user.id)
    .eq("status", "pending")
    .select("requester_id, addressee_id")
    .overrideTypes<Parties, { merge: false }>();
  if (error) {
    reportError("connections.decline", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(UNAVAILABLE);
  return done(user.id, otherParty(user.id, data));
}

export async function withdrawRequest(connectionId: string): Promise<Done> {
  const { user } = await requireMember();
  if (!connectionIdSchema.safeParse(connectionId).success) return fail(UNAVAILABLE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId)
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .select("requester_id, addressee_id")
    .overrideTypes<Parties, { merge: false }>();
  if (error) {
    reportError("connections.withdraw", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(UNAVAILABLE);
  return done(user.id, otherParty(user.id, data));
}

export async function removeConnection(connectionId: string): Promise<Done> {
  const { user } = await requireMember();
  if (!connectionIdSchema.safeParse(connectionId).success) return fail(UNAVAILABLE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("connections")
    .delete()
    .eq("id", connectionId)
    .eq("status", "accepted")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .select("requester_id, addressee_id")
    .overrideTypes<Parties, { merge: false }>();
  if (error) {
    reportError("connections.remove", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("That connection no longer exists.");
  return done(user.id, otherParty(user.id, data));
}

/** Idempotent: following twice or unfollowing twice leaves the same state. */
export async function setFollow(memberId: string, follow: boolean): Promise<Done> {
  const { user } = await requireMember();
  if (!memberIdSchema.safeParse(memberId).success) return fail(CANNOT);
  if (memberId === user.id) return fail("You can't follow yourself.");
  const blocked = await gate(user.id);
  if (blocked) return fail(blocked);

  const supabase = await createClient();
  if (follow) {
    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: user.id, followee_id: memberId });
    if (error && error.code !== "23505") {
      if (error.code === "42501") return fail(CANNOT);
      reportError("follows.insert", error);
      return fail(friendly(error));
    }
  } else {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followee_id", memberId);
    if (error) {
      reportError("follows.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  return done(user.id, memberId);
}

/** Blocking also ends any connection or follow between the two (a database trigger). */
export async function setBlock(
  memberId: string,
  block: boolean,
): Promise<NetworkActionResult> {
  const { user } = await requireMember();
  if (!memberIdSchema.safeParse(memberId).success) return fail(CANNOT);
  if (memberId === user.id) return fail("You can't block yourself.");

  const supabase = await createClient();
  if (block) {
    const { error } = await supabase
      .from("member_blocks")
      .insert({ blocker_id: user.id, blocked_id: memberId });
    if (error && error.code !== "23505") {
      reportError("member_blocks.insert", error);
      return fail(GENERIC_ERROR);
    }
  } else {
    const { error } = await supabase
      .from("member_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", memberId);
    if (error) {
      reportError("member_blocks.delete", error);
      return fail(GENERIC_ERROR);
    }
  }
  refresh();
  revalidatePath("/settings");
  return { ok: true };
}
