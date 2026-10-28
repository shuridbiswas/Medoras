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

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        // Rows are created by a database trigger, never by clients.
        Insert: never;
        Update: Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>;
        Relationships: [];
      };
      onboarding_preferences: {
        Row: OnboardingPreferencesRow;
        Insert: never;
        Update: Partial<Pick<OnboardingPreferencesRow, "purposes" | "city">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
