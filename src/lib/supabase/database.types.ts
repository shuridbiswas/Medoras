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
  /** "members": every member sees details. "connections": only accepted connections do. */
  profile_visibility: "members" | "connections";
  directory_listed: boolean;
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

export type PostRow = {
  id: string;
  author_id: string;
  category: string;
  body: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
  /** Set for a community post; null for a post on the home feed. */
  community_id: string | null;
};

export type PostLikeRow = {
  post_id: string;
  user_id: string;
  created_at: string;
};

export type PostCommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export type NotificationPreferencesRow = {
  user_id: string;
  notify_activity: boolean;
  inapp_connections: boolean;
  inapp_comments: boolean;
  created_at: string;
  updated_at: string;
};

export type ConnectionStatus = "pending" | "accepted";

export type ConnectionRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: ConnectionStatus;
  created_at: string;
  accepted_at: string | null;
};

export type FollowRow = {
  follower_id: string;
  followee_id: string;
  created_at: string;
};

export type MemberBlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
};

/** Add a value here and to saved_items_type_valid when a new kind of content can be bookmarked. */
export type SavedItemType = "post" | "forum_question" | "forum_answer";

export type SavedItemRow = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  item_id: string;
  created_at: string;
};

export type NotificationType =
  | "connection_request"
  | "connection_accepted"
  | "post_comment"
  | "comment_reply"
  | "mention"
  | "community_event"
  | "mentorship_event"
  | "community_join_request"
  | "community_request_approved"
  | "community_post_removed"
  | "forum_answer"
  | "forum_reply"
  | "forum_answer_accepted";

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  entity_type: "post" | "connection" | "community" | "mentorship" | "forum_question" | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
};

export type ReportTargetType = "post" | "comment" | "profile" | "question" | "answer" | "reply" | "community";
export type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";

export type ReportRow = {
  id: string;
  reporter_id: string | null;
  target_type: ReportTargetType;
  target_id: string;
  target_member_id: string | null;
  reason: string;
  details: string | null;
  excerpt: string | null;
  status: ReportStatus;
  created_at: string;
  reviewed_by: string | null;
  resolved_at: string | null;
};

export type MemberStatusRow = {
  user_id: string;
  status: "active" | "suspended";
  reason: string | null;
  updated_at: string;
};

export type StaffRoleRow = { user_id: string; role: "admin"; granted_at: string };

export type MemberMuteRow = { muter_id: string; muted_id: string; created_at: string };

export type MemberNoticeRow = {
  id: string;
  member_id: string;
  kind: "warning" | "content_removed" | "suspended" | "restored" | "appeal_decision";
  message: string;
  created_at: string;
};

export type AppealRow = {
  id: string;
  notice_id: string;
  member_id: string;
  message: string;
  status: "open" | "upheld" | "overturned";
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  decided_at: string | null;
};

export type ModerationActionRow = {
  id: string;
  report_id: string | null;
  moderator_id: string | null;
  member_id: string | null;
  action: string;
  note: string | null;
  created_at: string;
};

export type AuditLogRow = {
  id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type TwoFactorEventRow = {
  id: number;
  user_id: string;
  kind: "send" | "failure";
  at: string;
};

export type ConsentRecordRow = {
  id: string;
  user_id: string;
  kind: "terms" | "privacy" | "community_guidelines";
  version: string;
  accepted_at: string;
};

export type DataRequestRow = {
  id: string;
  user_id: string | null;
  kind: "export" | "deletion";
  status: "requested" | "cancelled" | "completed";
  requested_at: string;
  scheduled_for: string;
  completed_at: string | null;
};

export type RetentionPolicyRow = { key: string; days: number; description: string };

export type CommunityKind = "profession" | "institution" | "research" | "regional" | "interest";
export type CommunityVisibility = "public" | "private";
export type CommunityRole = "owner" | "moderator" | "member";

export type CommunityRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: CommunityKind;
  visibility: CommunityVisibility;
  rules: string | null;
  institution: string | null;
  region_label: string | null;
  country: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type CommunityMemberRow = { community_id: string; user_id: string; role: CommunityRole; joined_at: string };

export type CommunityRequestRow = {
  id: string;
  community_id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
};

export type CommunityBanRow = {
  community_id: string;
  user_id: string;
  banned_by: string | null;
  reason: string;
  created_at: string;
};

export type CommunityAnnouncementRow = {
  id: string;
  community_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type CommunityAuditLogRow = {
  id: string;
  community_id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ForumTopicRow = { slug: string; name: string; description: string; sort_order: number };
export type ForumContentType = "question" | "answer" | "reply";

/** Only the writer can read their rows. Never selected for anyone else. */
export type ForumIdentityRow = { content_type: ForumContentType; content_id: string; author_id: string; created_at: string };

export type ForumQuestionRow = {
  id: string;
  topic_slug: string;
  kind: string;
  title: string;
  body: string;
  /** Null when the question is anonymous. */
  author_id: string | null;
  is_anonymous: boolean;
  accepted_answer_id: string | null;
  confirmed_deidentified: boolean;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
};

export type ForumAnswerRow = {
  id: string;
  question_id: string;
  author_id: string | null;
  is_anonymous: boolean;
  body: string;
  created_at: string;
  updated_at: string;
  edited_at: string | null;
};

export type ForumReplyRow = {
  id: string;
  answer_id: string;
  author_id: string | null;
  is_anonymous: boolean;
  body: string;
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
      posts: {
        Row: PostRow;
        Insert: Pick<PostRow, "author_id" | "category" | "body"> & Partial<Pick<PostRow, "community_id">>;
        Update: Partial<Pick<PostRow, "category" | "body">>;
        Relationships: [];
      };
      post_likes: {
        Row: PostLikeRow;
        Insert: Pick<PostLikeRow, "post_id" | "user_id">;
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: NotificationPreferencesRow;
        Insert: Partial<
          Pick<
            NotificationPreferencesRow,
            "notify_activity" | "inapp_connections" | "inapp_comments"
          >
        > &
          Pick<NotificationPreferencesRow, "user_id">;
        Update: Partial<
          Pick<
            NotificationPreferencesRow,
            "notify_activity" | "inapp_connections" | "inapp_comments"
          >
        >;
        Relationships: [];
      };
      post_comments: {
        Row: PostCommentRow;
        Insert: Pick<PostCommentRow, "post_id" | "author_id" | "body">;
        Update: never;
        Relationships: [];
      };
      connections: {
        Row: ConnectionRow;
        Insert: Pick<ConnectionRow, "requester_id" | "addressee_id">;
        Update: Partial<Pick<ConnectionRow, "status">>;
        Relationships: [];
      };
      follows: {
        Row: FollowRow;
        Insert: Pick<FollowRow, "follower_id" | "followee_id">;
        Update: never;
        Relationships: [];
      };
      member_blocks: {
        Row: MemberBlockRow;
        Insert: Pick<MemberBlockRow, "blocker_id" | "blocked_id">;
        Update: never;
        Relationships: [];
      };
      saved_items: {
        Row: SavedItemRow;
        Insert: Pick<SavedItemRow, "user_id" | "item_type" | "item_id">;
        Update: never;
        Relationships: [];
      };
      member_status: { Row: MemberStatusRow; Insert: never; Update: never; Relationships: [] };
      staff_roles: { Row: StaffRoleRow; Insert: never; Update: never; Relationships: [] };
      member_mutes: {
        Row: MemberMuteRow;
        Insert: Pick<MemberMuteRow, "muter_id" | "muted_id">;
        Update: never;
        Relationships: [];
      };
      reports: { Row: ReportRow; Insert: never; Update: never; Relationships: [] };
      member_notices: { Row: MemberNoticeRow; Insert: never; Update: never; Relationships: [] };
      appeals: {
        Row: AppealRow;
        Insert: Pick<AppealRow, "notice_id" | "member_id" | "message">;
        Update: never;
        Relationships: [];
      };
      moderation_actions: { Row: ModerationActionRow; Insert: never; Update: never; Relationships: [] };
      audit_logs: { Row: AuditLogRow; Insert: never; Update: never; Relationships: [] };
      two_factor_events: {
        Row: TwoFactorEventRow;
        Insert: Pick<TwoFactorEventRow, "user_id" | "kind">;
        Update: never;
        Relationships: [];
      };
      consent_records: {
        Row: ConsentRecordRow;
        Insert: Pick<ConsentRecordRow, "user_id" | "kind" | "version">;
        Update: never;
        Relationships: [];
      };
      data_requests: {
        Row: DataRequestRow;
        Insert: { user_id: string; kind: "deletion" };
        Update: { status: "cancelled" };
        Relationships: [];
      };
      retention_policies: { Row: RetentionPolicyRow; Insert: never; Update: never; Relationships: [] };
      communities: {
        Row: CommunityRow;
        Insert: Pick<CommunityRow, "slug" | "name" | "description" | "kind" | "created_by"> &
          Partial<Pick<CommunityRow, "visibility" | "rules" | "institution" | "region_label" | "country">>;
        Update: Partial<
          Pick<CommunityRow, "name" | "description" | "visibility" | "rules" | "institution" | "region_label" | "country">
        >;
        Relationships: [];
      };
      community_members: {
        Row: CommunityMemberRow;
        Insert: Pick<CommunityMemberRow, "community_id" | "user_id">;
        Update: never;
        Relationships: [];
      };
      community_requests: {
        Row: CommunityRequestRow;
        Insert: Pick<CommunityRequestRow, "community_id" | "user_id"> & Partial<Pick<CommunityRequestRow, "message">>;
        Update: never;
        Relationships: [];
      };
      community_bans: { Row: CommunityBanRow; Insert: never; Update: never; Relationships: [] };
      community_announcements: {
        Row: CommunityAnnouncementRow;
        Insert: Pick<CommunityAnnouncementRow, "community_id" | "author_id" | "title" | "body">;
        Update: Partial<Pick<CommunityAnnouncementRow, "title" | "body">>;
        Relationships: [];
      };
      community_audit_logs: { Row: CommunityAuditLogRow; Insert: never; Update: never; Relationships: [] };
      forum_topics: { Row: ForumTopicRow; Insert: never; Update: never; Relationships: [] };
      forum_identity: { Row: ForumIdentityRow; Insert: never; Update: never; Relationships: [] };
      forum_questions: {
        Row: ForumQuestionRow;
        Insert: never;
        Update: Partial<Pick<ForumQuestionRow, "topic_slug" | "kind" | "title" | "body" | "accepted_answer_id">>;
        Relationships: [];
      };
      forum_answers: {
        Row: ForumAnswerRow;
        Insert: never;
        Update: Partial<Pick<ForumAnswerRow, "body">>;
        Relationships: [];
      };
      forum_replies: { Row: ForumReplyRow; Insert: never; Update: never; Relationships: [] };
      forum_votes: {
        Row: { answer_id: string; user_id: string; created_at: string };
        Insert: { answer_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      forum_follows: {
        Row: { question_id: string; user_id: string; created_at: string };
        Insert: { question_id: string; user_id: string };
        Update: never;
        Relationships: [];
      };
      // Rows are created by database triggers, never by clients.
      notifications: {
        Row: NotificationRow;
        Insert: never;
        Update: Partial<Pick<NotificationRow, "read_at">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      submit_report: {
        Args: { p_target_type: ReportTargetType; p_target_id: string; p_reason: string; p_details?: string | null };
        Returns: string;
      };
      claim_report: { Args: { p_report: string }; Returns: undefined };
      moderate_report: {
        Args: { p_report: string; p_decision: string; p_note?: string | null; p_member_message?: string | null };
        Returns: undefined;
      };
      set_member_status: {
        Args: { p_member: string; p_status: string; p_reason?: string | null; p_message?: string | null };
        Returns: undefined;
      };
      decide_appeal: {
        Args: { p_appeal: string; p_decision: string; p_note?: string | null };
        Returns: undefined;
      };
      decide_join_request: { Args: { p_request: string; p_approve: boolean }; Returns: undefined };
      set_community_role: { Args: { p_community: string; p_user: string; p_role: string }; Returns: undefined };
      community_set_ban: {
        Args: { p_community: string; p_user: string; p_banned: boolean; p_reason?: string };
        Returns: undefined;
      };
      community_remove_post: { Args: { p_post: string; p_reason?: string }; Returns: undefined };
      community_remove_comment: { Args: { p_comment: string; p_reason?: string }; Returns: undefined };
      ask_question: {
        Args: {
          p_topic: string;
          p_kind: string;
          p_title: string;
          p_body: string;
          p_anonymous: boolean;
          p_confirmed: boolean;
        };
        Returns: string;
      };
      post_answer: { Args: { p_question: string; p_body: string; p_anonymous?: boolean }; Returns: string };
      post_reply: { Args: { p_answer: string; p_body: string; p_anonymous?: boolean }; Returns: string };
      record_data_export: { Args: Record<string, never>; Returns: string };
      admin_execute_deletion: { Args: { p_request: string }; Returns: undefined };
      set_retention_days: { Args: { p_key: string; p_days: number }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
