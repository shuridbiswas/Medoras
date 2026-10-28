/**
 * Types for the tables in supabase/migrations. Hand-written to match the SQL; once the project
 * is linked, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > src/lib/supabase/database.types.ts
 */
export type ProfileRow = {
  id: string;
  username: string | null;
  first_name: string;
  last_name: string;
  headline: string | null;
  bio: string | null;
  avatar_path: string | null;
  cover_path: string | null;
  location_label: string | null;
  professional_journey: string | null;
  career_aspirations: string | null;
  looking_for_mentorship: boolean;
  open_to_mentor: boolean;
  member_type: string | null;
  fields: string[];
  institution: string | null;
  qualification: string | null;
  specialty: string | null;
  career_stage: string | null;
  country: string | null;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type OnboardingPreferencesRow = {
  user_id: string;
  purposes: string[];
  city: string | null;
  created_at: string;
  updated_at: string;
};

export type EducationRow = {
  id: string;
  profile_id: string;
  institution: string;
  qualification: string;
  field_of_study: string | null;
  start_year: number | null;
  end_year: number | null;
  currently_studying: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ExperienceRow = {
  id: string;
  profile_id: string;
  title: string;
  organization: string;
  employment_type: string | null;
  /** ISO date; the app always stores the first day of the month. */
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type SkillKind = "skill" | "interest" | "mentorship_area";

export type SkillRow = {
  id: string;
  profile_id: string;
  name: string;
  kind: SkillKind;
  created_at: string;
};

type Updatable<Row, Omit_ extends keyof Row> = Partial<Omit<Row, Omit_>>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        // Rows are created by a database trigger, never by clients.
        Insert: never;
        Update: Updatable<ProfileRow, "id" | "created_at" | "updated_at">;
        Relationships: [];
      };
      onboarding_preferences: {
        Row: OnboardingPreferencesRow;
        Insert: never;
        Update: Partial<Pick<OnboardingPreferencesRow, "purposes" | "city">>;
        Relationships: [];
      };
      profile_education: {
        Row: EducationRow;
        Insert: Omit<EducationRow, "id" | "created_at" | "updated_at">;
        Update: Updatable<
          EducationRow,
          "id" | "profile_id" | "created_at" | "updated_at"
        >;
        Relationships: [];
      };
      profile_experience: {
        Row: ExperienceRow;
        Insert: Omit<ExperienceRow, "id" | "created_at" | "updated_at">;
        Update: Updatable<
          ExperienceRow,
          "id" | "profile_id" | "created_at" | "updated_at"
        >;
        Relationships: [];
      };
      profile_skills: {
        Row: SkillRow;
        Insert: Omit<SkillRow, "id" | "created_at">;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
