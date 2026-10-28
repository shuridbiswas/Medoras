"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/session";
import { checkImage } from "@/features/onboarding/avatar";
import {
  aboutSchema,
  AVATAR_MAX_BYTES,
  basicsSchema,
  COVER_MAX_BYTES,
  deleteEntrySchema,
  educationEntrySchema,
  experienceEntrySchema,
  mentorshipSchema,
  monthToDate,
  SKILL_LIMITS,
  skillsSchema,
  type ProfileFormState,
} from "@/features/profile/schemas";
import type { SkillKind } from "@/lib/supabase/database.types";
import type { z } from "zod";

const GENERIC_ERROR = "We couldn't save that. Please try again.";

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};
const strings = (formData: FormData, key: string) =>
  formData.getAll(key).filter((v): v is string => typeof v === "string");
const bool = (formData: FormData, key: string) => formData.get(key) === "on";

function invalid(error: z.ZodError): ProfileFormState {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return {
    status: "error",
    fieldErrors,
    message: "Please fix the highlighted fields.",
  };
}

function refresh(username: string | null) {
  revalidatePath("/profile/edit");
  if (username) revalidatePath(`/profile/${username}`);
  revalidatePath("/home");
}

const saved = (message: string): ProfileFormState => ({
  status: "success",
  message,
});
const failed = (message = GENERIC_ERROR): ProfileFormState => ({
  status: "error",
  message,
});

/**
 * Every action starts with requireMember(): signed in, email verified, onboarding complete.
 * Writes are always scoped to the verified user's id, and the database policies enforce the
 * same rule again, so a forged id in the form can never touch someone else's data.
 */

export async function updateBasics(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = basicsSchema.safeParse({
    firstName: str(formData, "firstName"),
    lastName: str(formData, "lastName"),
    headline: str(formData, "headline"),
    locationLabel: str(formData, "locationLabel"),
    memberType: str(formData, "memberType"),
    fields: strings(formData, "fields"),
    institution: str(formData, "institution"),
    qualification: str(formData, "qualification"),
    specialty: str(formData, "specialty"),
    careerStage: str(formData, "careerStage"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: d.firstName,
      last_name: d.lastName,
      headline: d.headline,
      location_label: d.locationLabel ?? null,
      member_type: d.memberType,
      fields: d.fields,
      institution: d.institution,
      qualification: d.qualification,
      specialty: d.specialty ?? null,
      career_stage: d.careerStage,
    })
    .eq("id", user.id);
  if (error) return failed();
  refresh(profile.username);
  return saved("Profile details saved.");
}

export async function updateAbout(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = aboutSchema.safeParse({
    bio: str(formData, "bio"),
    professionalJourney: str(formData, "professionalJourney"),
    careerAspirations: str(formData, "careerAspirations"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      bio: parsed.data.bio ?? null,
      professional_journey: parsed.data.professionalJourney ?? null,
      career_aspirations: parsed.data.careerAspirations ?? null,
    })
    .eq("id", user.id);
  if (error) return failed();
  refresh(profile.username);
  return saved("About section saved.");
}

export async function updateMentorship(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = mentorshipSchema.safeParse({
    lookingForMentorship: bool(formData, "lookingForMentorship"),
    openToMentor: bool(formData, "openToMentor"),
  });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      looking_for_mentorship: parsed.data.lookingForMentorship,
      open_to_mentor: parsed.data.openToMentor,
    })
    .eq("id", user.id);
  if (error) return failed();
  refresh(profile.username);
  return saved("Mentorship preferences saved.");
}

/* ------------------------------ images ------------------------------ */

const IMAGE_KINDS = {
  avatar: {
    bucket: "avatars",
    column: "avatar_path",
    maxBytes: AVATAR_MAX_BYTES,
    label: "Profile photo",
  },
  cover: {
    bucket: "covers",
    column: "cover_path",
    maxBytes: COVER_MAX_BYTES,
    label: "Cover image",
  },
} as const;

type ImageKind = keyof typeof IMAGE_KINDS;

const imagePatch = (kind: ImageKind, value: string | null) =>
  kind === "avatar" ? { avatar_path: value } : { cover_path: value };

async function saveImage(
  kind: ImageKind,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const config = IMAGE_KINDS[kind];

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Choose an image to upload." };
  }
  const check = await checkImage(file, config.maxBytes);
  if (!check.ok) return { status: "error", message: check.message };

  const supabase = await createClient();
  // Own folder only (<user id>/<random>.<ext>); a new name each time avoids stale caches.
  const path = `${user.id}/${crypto.randomUUID()}.${check.extension}`;
  const { error: uploadError } = await supabase.storage
    .from(config.bucket)
    .upload(path, file, { contentType: check.contentType });
  if (uploadError)
    return failed("We couldn't upload that image. Please try again.");

  const { error: updateError } = await supabase
    .from("profiles")
    .update(imagePatch(kind, path))
    .eq("id", user.id);
  if (updateError) {
    await supabase.storage.from(config.bucket).remove([path]);
    return failed();
  }

  const previous = profile[config.column];
  if (previous) await supabase.storage.from(config.bucket).remove([previous]);

  refresh(profile.username);
  return saved(`${config.label} updated.`);
}

async function removeImage(kind: ImageKind): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const config = IMAGE_KINDS[kind];
  const previous = profile[config.column];
  if (!previous) return saved(`No ${config.label.toLowerCase()} to remove.`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update(imagePatch(kind, null))
    .eq("id", user.id);
  if (error) return failed();
  await supabase.storage.from(config.bucket).remove([previous]);
  refresh(profile.username);
  return saved(`${config.label} removed.`);
}

export async function uploadAvatar(
  _prev: ProfileFormState,
  formData: FormData,
) {
  return saveImage("avatar", formData);
}
export async function uploadCover(_prev: ProfileFormState, formData: FormData) {
  return saveImage("cover", formData);
}
export async function removeAvatar() {
  return removeImage("avatar");
}
export async function removeCover() {
  return removeImage("cover");
}

/* ------------------------------ education ------------------------------ */

export async function saveEducation(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = educationEntrySchema.safeParse({
    id: str(formData, "id"),
    institution: str(formData, "institution"),
    qualification: str(formData, "qualification"),
    fieldOfStudy: str(formData, "fieldOfStudy"),
    startYear: str(formData, "startYear"),
    endYear: str(formData, "endYear"),
    currentlyStudying: bool(formData, "currentlyStudying"),
    description: str(formData, "description"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const values = {
    institution: d.institution,
    qualification: d.qualification,
    field_of_study: d.fieldOfStudy ?? null,
    start_year: d.startYear ?? null,
    end_year: d.endYear ?? null,
    currently_studying: d.currentlyStudying,
    description: d.description ?? null,
  };
  const supabase = await createClient();

  if (d.id) {
    const { data, error } = await supabase
      .from("profile_education")
      .update(values)
      .eq("id", d.id)
      .eq("profile_id", user.id)
      .select("id");
    if (error) return failed();
    if (!data?.length) return failed("That education entry no longer exists.");
  } else {
    const { error } = await supabase
      .from("profile_education")
      .insert({ ...values, profile_id: user.id });
    if (error) {
      return failed(
        error.code === "23514"
          ? "You've reached the limit of 20 education entries."
          : GENERIC_ERROR,
      );
    }
  }
  refresh(profile.username);
  return saved(d.id ? "Education updated." : "Education added.");
}

export async function deleteEducation(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = deleteEntrySchema.safeParse({ id: str(formData, "id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_education")
    .delete()
    .eq("id", parsed.data.id)
    .eq("profile_id", user.id);
  if (error) return failed();
  refresh(profile.username);
  return saved("Education removed.");
}

/* ------------------------------ experience ------------------------------ */

export async function saveExperience(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = experienceEntrySchema.safeParse({
    id: str(formData, "id"),
    title: str(formData, "title"),
    organization: str(formData, "organization"),
    employmentType: str(formData, "employmentType"),
    startMonth: str(formData, "startMonth"),
    endMonth: str(formData, "endMonth"),
    isCurrent: bool(formData, "isCurrent"),
    description: str(formData, "description"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const values = {
    title: d.title,
    organization: d.organization,
    employment_type: d.employmentType ?? null,
    start_date: monthToDate(d.startMonth),
    end_date: d.endMonth ? monthToDate(d.endMonth) : null,
    is_current: d.isCurrent,
    description: d.description ?? null,
  };
  const supabase = await createClient();

  if (d.id) {
    const { data, error } = await supabase
      .from("profile_experience")
      .update(values)
      .eq("id", d.id)
      .eq("profile_id", user.id)
      .select("id");
    if (error) return failed();
    if (!data?.length) return failed("That experience entry no longer exists.");
  } else {
    const { error } = await supabase
      .from("profile_experience")
      .insert({ ...values, profile_id: user.id });
    if (error) {
      return failed(
        error.code === "23514"
          ? "You've reached the limit of 30 experience entries."
          : GENERIC_ERROR,
      );
    }
  }
  refresh(profile.username);
  return saved(d.id ? "Experience updated." : "Experience added.");
}

export async function deleteExperience(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = deleteEntrySchema.safeParse({ id: str(formData, "id") });
  if (!parsed.success) return invalid(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_experience")
    .delete()
    .eq("id", parsed.data.id)
    .eq("profile_id", user.id);
  if (error) return failed();
  refresh(profile.username);
  return saved("Experience removed.");
}

/* ------------------------------ skills and interests ------------------------------ */

/** Replaces one list (skills, interests or mentorship areas) with the submitted set. */
export async function saveSkills(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const { user, profile } = await requireMember();
  const parsed = skillsSchema.safeParse({
    kind: str(formData, "kind"),
    names: strings(formData, "names"),
  });
  if (!parsed.success) return invalid(parsed.error);
  const kind: SkillKind = parsed.data.kind;

  // De-duplicate case-insensitively, keeping the first spelling.
  const unique = new Map<string, string>();
  for (const name of parsed.data.names) {
    if (!unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name);
  }
  if (unique.size > SKILL_LIMITS[kind]) {
    return failed(`You can add up to ${SKILL_LIMITS[kind]} items here.`);
  }

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("profile_skills")
    .select("id, name")
    .eq("profile_id", user.id)
    .eq("kind", kind);
  if (readError) return failed();

  const keep = new Set<string>();
  const remove: string[] = [];
  for (const row of existing ?? []) {
    if (unique.has(row.name.toLowerCase())) keep.add(row.name.toLowerCase());
    else remove.push(row.id);
  }
  const add = [...unique.entries()]
    .filter(([key]) => !keep.has(key))
    .map(([, name]) => ({ profile_id: user.id, name, kind }));

  if (remove.length) {
    const { error } = await supabase
      .from("profile_skills")
      .delete()
      .in("id", remove)
      .eq("profile_id", user.id);
    if (error) return failed();
  }
  if (add.length) {
    const { error } = await supabase.from("profile_skills").insert(add);
    if (error) return failed();
  }

  refresh(profile.username);
  return saved("Saved.");
}
