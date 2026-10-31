"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import type { CommunityFormState } from "@/features/communities/types";
import {
  announcementSchema,
  banSchema,
  communityFieldsSchema,
  idSchema,
  removeSchema,
  requestMessageSchema,
  roleSchema,
  slugify,
} from "@/features/communities/schemas";

/**
 * Every action starts with requireMember(). The acting member always comes from that verified
 * session, never from the form. Moderator powers are not decided here: the database functions
 * check the caller's role and write the community audit log, and row level security repeats the
 * membership rules. A "not allowed" from the database is reported without saying why.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const NOT_ALLOWED = "You don't have permission to do that.";

type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

function invalid(error: z.ZodError): CommunityFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return { status: "error", fieldErrors, message: "Please fix the highlighted fields." };
}

/** Messages the database writes for members are safe to show; everything else stays generic. */
function friendly(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  if (error.code === "42501") return NOT_ALLOWED;
  const message = error.message ?? "";
  if (/too quickly/i.test(message)) return message;
  if (/no longer (open|available)|cannot be (changed|removed)|not in a community/i.test(message)) return message;
  return GENERIC_ERROR;
}

function formFields(formData: FormData) {
  return {
    name: str(formData, "name"),
    description: str(formData, "description"),
    kind: str(formData, "kind"),
    visibility: str(formData, "visibility"),
    rules: str(formData, "rules"),
    institution: str(formData, "institution"),
    regionLabel: str(formData, "regionLabel"),
    country: str(formData, "country"),
  };
}

export async function createCommunity(_prev: CommunityFormState, formData: FormData): Promise<CommunityFormState> {
  const { user } = await requireMember();
  const parsed = communityFieldsSchema.safeParse(formFields(formData));
  if (!parsed.success) return invalid(parsed.error);

  const limited = await checkRateLimit("community", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const base = slugify(parsed.data.name);
  let slug = base;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { error } = await supabase.from("communities").insert({
      slug,
      name: parsed.data.name,
      description: parsed.data.description,
      kind: parsed.data.kind,
      visibility: parsed.data.visibility,
      rules: parsed.data.rules ?? null,
      institution: parsed.data.institution ?? null,
      region_label: parsed.data.regionLabel ?? null,
      country: parsed.data.country ?? null,
      created_by: user.id,
    });
    if (!error) {
      revalidatePath("/communities");
      redirect(`/communities/${slug}`);
    }
    // 23505: the address is taken. Try a distinct one before giving up.
    if (error.code !== "23505") {
      if (error.code !== "23514") reportError("communities.insert", error);
      return { status: "error", message: friendly(error) };
    }
    slug = `${base.slice(0, 43)}-${randomBytes(2).toString("hex")}`;
  }
  return { status: "error", message: "We couldn't find a free address for that name. Try a slightly different name." };
}

export async function updateCommunity(_prev: CommunityFormState, formData: FormData): Promise<CommunityFormState> {
  const { user } = await requireMember();
  const id = idSchema.safeParse(str(formData, "communityId"));
  const parsed = communityFieldsSchema.safeParse(formFields(formData));
  if (!id.success) return { status: "error", message: GENERIC_ERROR };
  if (!parsed.success) return invalid(parsed.error);

  const limited = await checkRateLimit("community", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("communities")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
      rules: parsed.data.rules ?? null,
      institution: parsed.data.institution ?? null,
      region_label: parsed.data.regionLabel ?? null,
      country: parsed.data.country ?? null,
    })
    .eq("id", id.data)
    .select("id");
  if (error) {
    reportError("communities.update", error);
    return { status: "error", message: friendly(error) };
  }
  if (!data || data.length === 0) return { status: "error", message: "Only the owner can change these settings." };
  revalidatePath("/communities", "layout");
  return { status: "success", message: "Saved.", nonce: Date.now() };
}

export async function joinCommunity(communityId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(communityId).success) return fail(GENERIC_ERROR);
  const limited = await checkRateLimit("community", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.from("community_members").insert({ community_id: communityId, user_id: user.id });
  // 23505: already a member. 42501: private, closed, or not allowed to join; the reason stays private.
  if (error && error.code !== "23505") {
    if (error.code === "42501") return fail("You can't join this community.");
    reportError("community_members.insert", error);
    return fail(friendly(error));
  }
  revalidatePath("/communities", "layout");
  return { ok: true };
}

export async function leaveCommunity(communityId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(communityId).success) return fail(GENERIC_ERROR);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("community_members")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .select("user_id");
  if (error) {
    reportError("community_members.delete", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail("The owner can't leave a community.");
  revalidatePath("/communities", "layout");
  return { ok: true };
}

export async function requestToJoin(communityId: string, message: string): Promise<Result> {
  const { user } = await requireMember();
  const parsed = requestMessageSchema.safeParse({ communityId, message });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const limited = await checkRateLimit("community", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.from("community_requests").insert({
    community_id: parsed.data.communityId,
    user_id: user.id,
    message: parsed.data.message ?? null,
  });
  if (error && error.code !== "23505") {
    if (error.code === "42501") return fail("You can't ask to join this community.");
    reportError("community_requests.insert", error);
    return fail(friendly(error));
  }
  revalidatePath("/communities", "layout");
  return { ok: true };
}

export async function withdrawRequest(communityId: string): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(communityId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase
    .from("community_requests")
    .delete()
    .eq("community_id", communityId)
    .eq("user_id", user.id)
    .eq("status", "pending");
  if (error) {
    reportError("community_requests.delete", error);
    return fail(GENERIC_ERROR);
  }
  revalidatePath("/communities", "layout");
  return { ok: true };
}

async function rpc<T extends "decide_join_request" | "set_community_role" | "community_set_ban" | "community_remove_post">(
  name: T,
  args: Parameters<Awaited<ReturnType<typeof createClient>>["rpc"]>[1],
  userId: string,
): Promise<Result> {
  const limited = await checkRateLimit("community", userId);
  if (!limited.ok) return fail(limited.message);
  const supabase = await createClient();
  const { error } = await (supabase.rpc as (n: string, a: unknown) => PromiseLike<{ error: { code?: string; message?: string } | null }>)(
    name,
    args,
  );
  if (error) {
    if (error.code !== "42501" && error.code !== "P0002") reportError(`community.${name}`, error);
    return fail(friendly(error));
  }
  revalidatePath("/communities", "layout");
  return { ok: true };
}

export async function decideRequest(requestId: string, approve: boolean): Promise<Result> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(requestId).success) return fail(GENERIC_ERROR);
  return rpc("decide_join_request", { p_request: requestId, p_approve: approve }, user.id);
}

export async function setMemberRole(communityId: string, memberId: string, role: string): Promise<Result> {
  const { user } = await requireMember();
  const parsed = roleSchema.safeParse({ communityId, memberId, role });
  if (!parsed.success) return fail(GENERIC_ERROR);
  return rpc(
    "set_community_role",
    { p_community: parsed.data.communityId, p_user: parsed.data.memberId, p_role: parsed.data.role },
    user.id,
  );
}

export async function setMemberBan(
  communityId: string,
  memberId: string,
  banned: boolean,
  reason: string = "other",
): Promise<Result> {
  const { user } = await requireMember();
  const parsed = banSchema.safeParse({ communityId, memberId, banned, reason });
  if (!parsed.success) return fail(GENERIC_ERROR);
  return rpc(
    "community_set_ban",
    { p_community: parsed.data.communityId, p_user: parsed.data.memberId, p_banned: parsed.data.banned, p_reason: parsed.data.reason },
    user.id,
  );
}

export async function removeCommunityPost(postId: string, reason: string): Promise<Result> {
  const { user } = await requireMember();
  const parsed = removeSchema.safeParse({ id: postId, reason });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  return rpc("community_remove_post", { p_post: parsed.data.id, p_reason: parsed.data.reason }, user.id);
}

export async function createAnnouncement(_prev: CommunityFormState, formData: FormData): Promise<CommunityFormState> {
  const { user } = await requireMember();
  const parsed = announcementSchema.safeParse({
    communityId: str(formData, "communityId"),
    title: str(formData, "title"),
    body: str(formData, "body"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const limited = await checkRateLimit("community", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const supabase = await createClient();
  const { error } = await supabase.from("community_announcements").insert({
    community_id: parsed.data.communityId,
    author_id: user.id,
    title: parsed.data.title,
    body: parsed.data.body,
  });
  if (error) {
    if (error.code !== "42501") reportError("community_announcements.insert", error);
    return { status: "error", message: error.code === "42501" ? "Only moderators can post announcements." : GENERIC_ERROR };
  }
  revalidatePath("/communities", "layout");
  return { status: "success", message: "Announcement published.", nonce: Date.now() };
}

export async function deleteAnnouncement(announcementId: string): Promise<Result> {
  await requireMember();
  if (!idSchema.safeParse(announcementId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { data, error } = await supabase.from("community_announcements").delete().eq("id", announcementId).select("id");
  if (error) {
    reportError("community_announcements.delete", error);
    return fail(GENERIC_ERROR);
  }
  if (!data || data.length === 0) return fail(NOT_ALLOWED);
  revalidatePath("/communities", "layout");
  return { ok: true };
}
