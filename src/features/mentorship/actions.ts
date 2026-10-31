"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportError } from "@/lib/monitoring/report";
import {
  availabilitySchema,
  decideSchema,
  feedbackSchema,
  idSchema,
  mentorProfileSchema,
  requestSchema,
  statusSchema,
} from "@/features/mentorship/schemas";
import type { MentorFormState, Outcome } from "@/features/mentorship/state";

/**
 * Every action starts with requireMember(). The acting member is always the verified session;
 * a mentor profile, request or feedback is written as that member, and row level security plus
 * the database functions decide who may do what (students can't list as mentors, only the mentor
 * decides a request, feedback needs a completed mentorship). Nothing here claims a mentor is
 * verified or accredited.
 */

const GENERIC_ERROR = "Something went wrong. Please try again.";
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function invalid(error: z.ZodError): MentorFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) (fieldErrors[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  return { status: "error", fieldErrors, message: "Please fix the highlighted fields." };
}

function friendly(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (/too quickly|capacity|no longer (open|available)|up to 14/i.test(message)) return message;
  if (error?.code === "42501") return "You can't do that.";
  return GENERIC_ERROR;
}

const refresh = () => revalidatePath("/mentorship", "layout");

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

export async function saveMentorProfile(_prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const { user } = await requireMember();
  const parsed = mentorProfileSchema.safeParse({
    bio: str(formData, "bio"),
    expertise: str(formData, "expertise"),
    experienceYears: str(formData, "experienceYears"),
    organization: str(formData, "organization"),
    topics: str(formData, "topics"),
    languages: str(formData, "languages"),
    capacity: str(formData, "capacity"),
    formats: formData.getAll("formats").filter((v): v is string => typeof v === "string"),
    accepting: formData.get("accepting") === "on",
    acknowledged: formData.get("acknowledged") === "on",
  });
  if (!parsed.success) return invalid(parsed.error);
  const limited = await checkRateLimit("mentorship", user.id);
  if (!limited.ok) return { status: "error", message: limited.message };

  const d = parsed.data;
  const row = {
    bio: d.bio,
    expertise: d.expertise,
    experience_years: d.experienceYears,
    organization: d.organization ?? null,
    topics: d.topics,
    languages: d.languages,
    capacity: d.capacity,
    session_formats: d.formats,
    accepting: d.accepting,
    acknowledged: d.acknowledged,
  };

  const supabase = await createClient();
  // An upsert would write the owner column, which column grants forbid: update first, else insert.
  const updated = await supabase.from("mentor_profiles").update(row).eq("user_id", user.id).select("user_id");
  if (updated.error) {
    reportError("mentor_profiles.update", updated.error);
    return { status: "error", message: friendly(updated.error) };
  }
  if (!updated.data || updated.data.length === 0) {
    const { error } = await supabase.from("mentor_profiles").insert({ user_id: user.id, ...row });
    if (error) {
      if (error.code === "42501") {
        return { status: "error", message: "Students can't list as mentors. You can ask a mentor to guide you instead." };
      }
      reportError("mentor_profiles.insert", error);
      return { status: "error", message: friendly(error) };
    }
  }
  refresh();
  return { status: "success", message: "Your mentor listing is saved." };
}

export async function removeMentorProfile(): Promise<Outcome> {
  const { user } = await requireMember();
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_profiles").delete().eq("user_id", user.id);
  if (error) {
    reportError("mentor_profiles.delete", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true };
}

export async function addAvailability(_prev: MentorFormState, formData: FormData): Promise<MentorFormState> {
  const { user } = await requireMember();
  const parsed = availabilitySchema.safeParse({
    weekday: str(formData, "weekday"),
    start: str(formData, "start"),
    end: str(formData, "end"),
    timezone: str(formData, "timezone"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("mentor_availability").insert({
    mentor_id: user.id,
    weekday: parsed.data.weekday,
    start_minute: parsed.data.start as number,
    end_minute: parsed.data.end as number,
    timezone: parsed.data.timezone,
  });
  if (error) {
    // 23503 / 42501: no mentor listing yet.
    if (error.code !== "23503" && error.code !== "42501") reportError("mentor_availability.insert", error);
    return { status: "error", message: error.code === "23503" || error.code === "42501" ? "Save your mentor listing first." : friendly(error) };
  }
  refresh();
  return { status: "success", message: "Added." };
}

export async function removeAvailability(id: string): Promise<Outcome> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(id).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.from("mentor_availability").delete().eq("id", id).eq("mentor_id", user.id);
  if (error) {
    reportError("mentor_availability.delete", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true };
}

export async function sendMentorshipRequest(mentorId: string, goals: string, format?: string): Promise<Outcome> {
  const { user } = await requireMember();
  const parsed = requestSchema.safeParse({ mentorId, goals, format: format || undefined });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  if (parsed.data.mentorId === user.id) return fail("You can't ask yourself to be your mentor.");
  const limited = await checkRateLimit("mentorship", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.from("mentorship_requests").insert({
    mentee_id: user.id,
    mentor_id: parsed.data.mentorId,
    goals: parsed.data.goals,
    preferred_format: parsed.data.format ?? null,
  });
  if (error) {
    if (error.code === "23505") return fail("You already have a request waiting with this mentor.");
    // 42501: the mentor isn't taking requests (or can't be asked); the reason stays private.
    if (error.code === "42501") return fail("This mentor isn't taking requests right now.");
    if (error.code !== "23514") reportError("mentorship_requests.insert", error);
    return fail(friendly(error));
  }
  refresh();
  return { ok: true };
}

export async function withdrawMentorshipRequest(requestId: string): Promise<Outcome> {
  const { user } = await requireMember();
  if (!idSchema.safeParse(requestId).success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase
    .from("mentorship_requests")
    .delete()
    .eq("id", requestId)
    .eq("mentee_id", user.id)
    .eq("status", "pending");
  if (error) {
    reportError("mentorship_requests.delete", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true };
}

export async function decideMentorshipRequest(requestId: string, accept: boolean, note?: string): Promise<Outcome> {
  const { user } = await requireMember();
  const parsed = decideSchema.safeParse({ requestId, accept, note: note || undefined });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const limited = await checkRateLimit("mentorship", user.id);
  if (!limited.ok) return fail(limited.message);

  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_mentorship_request", {
    p_request: parsed.data.requestId,
    p_accept: parsed.data.accept,
    p_note: parsed.data.note ?? null,
  });
  if (error) {
    if (error.code !== "P0002" && error.code !== "23514") reportError("mentorship.decide", error);
    return fail(friendly(error));
  }
  refresh();
  revalidatePath("/messages", "layout");
  return { ok: true };
}

export async function changeMentorshipStatus(mentorshipId: string, status: string): Promise<Outcome> {
  await requireMember();
  const parsed = statusSchema.safeParse({ mentorshipId, status });
  if (!parsed.success) return fail(GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_mentorship_status", {
    p_mentorship: parsed.data.mentorshipId,
    p_status: parsed.data.status,
  });
  if (error) {
    if (error.code !== "P0002" && error.code !== "42501") reportError("mentorship.status", error);
    return fail(error.code === "42501" ? "Only the mentor can pause or resume a mentorship." : friendly(error));
  }
  refresh();
  return { ok: true };
}

export async function submitMentorshipFeedback(mentorshipId: string, rating: number, comment?: string): Promise<Outcome> {
  const { user } = await requireMember();
  const parsed = feedbackSchema.safeParse({ mentorshipId, rating, comment: comment || undefined });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? GENERIC_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.from("mentorship_feedback").insert({
    mentorship_id: parsed.data.mentorshipId,
    author_id: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment ?? null,
  });
  if (error) {
    if (error.code === "23505") return fail("You have already left feedback for this mentorship.");
    if (error.code === "42501") return fail("Feedback can be left once a mentorship is completed.");
    reportError("mentorship_feedback.insert", error);
    return fail(GENERIC_ERROR);
  }
  refresh();
  return { ok: true };
}
