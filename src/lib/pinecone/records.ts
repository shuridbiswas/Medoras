import { FIELDS } from "@/features/onboarding/options";
import type { ProfileRow, SkillRow } from "@/lib/supabase/database.types";

/**
 * What may be embedded, and how vectors link back to PostgreSQL. Pure functions, no network.
 *
 * Privacy rules (enforced here, and covered by tests):
 *  - Only STRUCTURED, member-chosen fields are embedded: headline, specialty, fields of practice,
 *    career stage and chosen skill/interest/mentorship tags.
 *  - Never embedded: bio, professional journey, aspirations, posts, comments, messages, names,
 *    email, location, onboarding answers, or anything clinical.
 *  - A profile that has not finished onboarding is never embedded.
 */

export type VectorKind = "profile";

/** Vector id = "<kind>:<postgres uuid>". PostgreSQL stays the source of truth. */
export const vectorId = (kind: VectorKind, id: string) => `${kind}:${id}`;

const ID_PATTERN = /^(profile):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function parseVectorId(value: string): { kind: VectorKind; id: string } | null {
  const m = ID_PATTERN.exec(value);
  return m ? { kind: m[1] as VectorKind, id: m[2].toLowerCase() } : null;
}

export type EmbeddableDocument = {
  id: string;
  text: string;
  metadata: {
    kind: VectorKind;
    pgId: string;
    visibility: "members";
    fields: string[];
    careerStage: string;
  };
};

type ProfileInput = Pick<
  ProfileRow,
  "id" | "headline" | "specialty" | "fields" | "career_stage" | "onboarding_completed"
>;

export function profileDocument(
  profile: ProfileInput,
  skills: Pick<SkillRow, "name" | "kind">[],
): EmbeddableDocument | null {
  if (!profile.onboarding_completed) return null;

  const fieldLabels = profile.fields.flatMap((f) => {
    const label: string | undefined = FIELDS.find((o) => o.value === f)?.label;
    return label ? [label] : [];
  });

  const tags = (kind: SkillRow["kind"]) =>
    skills.filter((s) => s.kind === kind).map((s) => s.name);

  const parts = [
    profile.headline ? `Headline: ${profile.headline}` : null,
    profile.specialty ? `Specialty: ${profile.specialty}` : null,
    fieldLabels.length ? `Fields: ${fieldLabels.join(", ")}` : null,
    profile.career_stage ? `Career stage: ${profile.career_stage.replace(/_/g, " ")}` : null,
    tags("skill").length ? `Skills: ${tags("skill").join(", ")}` : null,
    tags("interest").length ? `Interests: ${tags("interest").join(", ")}` : null,
    tags("mentorship_area").length
      ? `Mentorship areas: ${tags("mentorship_area").join(", ")}`
      : null,
  ].filter((p): p is string => p !== null);

  if (parts.length === 0) return null;

  return {
    id: vectorId("profile", profile.id),
    text: parts.join("\n"),
    metadata: {
      kind: "profile",
      pgId: profile.id,
      visibility: "members",
      fields: profile.fields,
      careerStage: profile.career_stage ?? "",
    },
  };
}
