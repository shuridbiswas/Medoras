"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOnboardingPending } from "@/lib/auth/session";
import { checkAvatar } from "@/features/onboarding/avatar";
import { sendToMember } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";
import { recordPolicyConsent } from "@/features/privacy/actions";
import {
  onboardingSchema,
  STEP_OF_FIELD,
  type OnboardingState,
} from "@/features/onboarding/schemas";

const GENERIC_ERROR = "We couldn't save your profile. Please try again.";

const str = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const strings = (formData: FormData, key: string) =>
  formData.getAll(key).filter((v): v is string => typeof v === "string");

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  // Authorization first: only a verified member who hasn't finished onboarding gets past here.
  const { user, profile } = await requireOnboardingPending();

  const parsed = onboardingSchema.safeParse({
    memberType: str(formData, "memberType"),
    fields: strings(formData, "fields"),
    institution: str(formData, "institution"),
    qualification: str(formData, "qualification"),
    specialty: str(formData, "specialty"),
    careerStage: str(formData, "careerStage"),
    country: str(formData, "country"),
    city: str(formData, "city"),
    purposes: strings(formData, "purposes"),
    username: str(formData, "username"),
    headline: str(formData, "headline"),
    bio: str(formData, "bio"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    const step = Math.min(
      ...Object.keys(fieldErrors).map((k) => STEP_OF_FIELD[k] ?? 4),
    );
    return { status: "error", fieldErrors, step };
  }

  const input = parsed.data;
  const supabase = await createClient();

  // Optional profile photo, validated by real content type and size.
  let avatarPath: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const check = await checkAvatar(avatar);
    if (!check.ok) {
      return {
        status: "error",
        step: 4,
        fieldErrors: { avatar: [check.message] },
      };
    }
    avatarPath = `${user.id}/${crypto.randomUUID()}.${check.extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(avatarPath, avatar, { contentType: check.contentType });
    if (uploadError) {
      return {
        status: "error",
        step: 4,
        fieldErrors: {
          avatar: ["We couldn't upload that photo. Try another."],
        },
      };
    }
  }

  const { error: prefsError } = await supabase
    .from("onboarding_preferences")
    .update({ purposes: input.purposes, city: input.city ?? null })
    .eq("user_id", user.id);

  if (prefsError) {
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    return { status: "error", message: GENERIC_ERROR };
  }

  // The profile update goes last: onboarding_completed flips only when everything else is saved.
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      username: input.username,
      headline: input.headline,
      bio: input.bio ?? null,
      member_type: input.memberType,
      fields: input.fields,
      institution: input.institution,
      qualification: input.qualification,
      specialty: input.specialty ?? null,
      career_stage: input.careerStage,
      country: input.country,
      ...(avatarPath ? { avatar_path: avatarPath } : {}),
      onboarding_completed: true,
    })
    .eq("id", user.id);

  if (profileError) {
    if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
    // 23505 = unique_violation on profiles.username
    if (profileError.code === "23505") {
      return {
        status: "error",
        step: 4,
        fieldErrors: { username: ["That username is already taken."] },
      };
    }
    return { status: "error", message: GENERIC_ERROR };
  }

  if (avatarPath && profile?.avatar_path) {
    await supabase.storage.from("avatars").remove([profile.avatar_path]);
  }

  // Record which version of the terms, privacy policy and guidelines the member accepted
  // (they ticked the box at sign-up). Best effort; never blocks onboarding.
  await recordPolicyConsent(user.id);

  // Best effort: a failed or unconfigured email never blocks onboarding (sendToMember never throws).
  await sendToMember(
    user,
    welcomeEmail({ firstName: profile?.first_name ?? "", username: input.username }),
    "transactional",
  );

  redirect("/");
}
