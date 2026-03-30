export type UserRole = "user" | "manager";
export type Locale = "en" | "ko";

export interface RuleChangeLogItem {
  version: number;
  title: string;
  description: string;
  sections: string[];
  updated_at: string;
}

export interface PenaltyReward {
  threshold: number;
  label: string;
  value: string;
}

export interface RuleConfig {
  checkin_points: number;
  submission_points: number;
  productive_points: number;
  non_productive_penalty: number;
  inactivity_penalty_enabled: boolean;
  inactivity_penalty_points_per_day: number;
  streak_days: number;
  multiplier_trigger_days: number;
  multiplier_value: number;
  greeting_message: string;
  success_message: string;
  rule_description_text: string;
  manager_logic_text: string;
  penalty_thresholds: number[];
  penalty_rewards: PenaltyReward[];
  penalty_description: string;
  penalty_action_rules: string[];
  rewards_blurb: string;
  rule_version: number;
  rule_version_pinned_at?: string;
  last_updated: string;
  changelog: RuleChangeLogItem[];
}

export interface UserProfile {
  id: string;
  login_id: string;
  email?: string;
  role: UserRole;
  name: string;
  locale: Locale;
  character_glasses?: boolean;
  profile_avatar_type?: "emoji" | "image";
  profile_avatar_emoji?: string;
  profile_avatar_url?: string;
  auth_provider?: "password" | "google";
  password_hash?: string;
  password_salt?: string;
  last_login_point_date?: string;
  last_inactivity_penalty_date?: string;
  last_seen_rule_version: number;
  last_seen_manager_update_at?: string;
  last_seen_notification_at?: string;
  created_at: string;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  user_id: string;
  date: string;
  mood: string;
  feeling: string;
  calories: number;
  productive: boolean;
  custom_answers: Record<string, string>;
  task_list: string[];
  file_url?: string;
  status: SubmissionStatus;
  manager_note?: string;
  points_awarded: number;
  base_points_awarded?: number;
  bonus_points_awarded?: number;
  bonus_message?: string;
  created_at: string;
  reviewed_at?: string;
}

export interface ScoreState {
  user_id: string;
  total_points: number;
  lifetime_points: number;
  current_streak: number;
  longest_streak: number;
  multiplier_active: boolean;
  multiplier_value: number;
  penalty_active: boolean;
  negative_balance: number;
  updated_at: string;
  last_approved_at?: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  required_points: number;
  created_by: string;
  created_at: string;
}

export type RewardClaimStatus = "available" | "claimed";

export interface RewardClaim {
  id: string;
  user_id: string;
  reward_id: string;
  status: RewardClaimStatus;
  claimed_at?: string;
  manager_notified_at?: string | null;
  created_at: string;
}

export interface ManagerUpdateNotification {
  id: string;
  kind: "rule_update" | "reward_update" | "submission_review";
  title: string;
  message: string;
  created_at: string;
  review_points?: number;
  bonus_points?: number;
  bonus_message?: string;
  deep_link?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  image_url?: string;
  created_by: string;
  created_at: string;
}

export type AppNotificationKind =
  | "manager_update"
  | "announcement"
  | "reward_claim_request"
  | "checkin_arrived";

export type AppNotificationCategory =
  | "all"
  | "manager_message"
  | "mission"
  | "review_points"
  | "rules"
  | "checkin"
  | "reward_claim";

export interface AppNotification {
  id: string;
  kind: AppNotificationKind;
  title: string;
  message: string;
  created_at: string;
  is_new: boolean;
  image_url?: string;
  source_id?: string;
  deep_link?: string;
  review_points?: number;
  bonus_points?: number;
  bonus_message?: string;
  category?: AppNotificationCategory;
  cta_label?: string;
  cta_link?: string;
  mission_start_date?: string;
  mission_due_date?: string;
  mission_duration_days?: number;
  mission_bonus_points?: number;
}

export interface PenaltyEvent {
  id: string;
  user_id: string;
  threshold: number;
  negative_balance: number;
  description: string;
  reward_label: string;
  reward_value: string;
  manager_reward_unlocked: boolean;
  claimed_by_manager: boolean;
  triggered_at: string;
  recovered_at?: string;
}

export interface ManagerAuditLog {
  id: string;
  actor_user_id: string;
  action: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ManagerReviewInput {
  submissionId: string;
  approved: boolean;
  note?: string;
  points: number;
  bonus_points?: number;
  bonus_message?: string;
}

export interface NextRewardState {
  reward: Reward | null;
  pointsRemaining: number;
  progressPercent: number;
}

export interface PenaltyComputation {
  penalty_active: boolean;
  negative_balance: number;
  crossed_thresholds: number[];
  recovered: boolean;
}

export interface DashboardBundle {
  user: UserProfile;
  score: ScoreState;
  rules: RuleConfig;
  rewards: Reward[];
  rewardClaims: RewardClaim[];
  submissions: Submission[];
  penaltyHistory: PenaltyEvent[];
  managerUpdates: ManagerUpdateNotification[];
  notifications: AppNotification[];
  unread_notification_count: number;
}
