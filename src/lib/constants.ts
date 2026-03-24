import { RuleConfig, Reward } from "@/lib/types";

const now = new Date().toISOString();

export const DEFAULT_RULES: RuleConfig = {
  checkin_points: 2,
  submission_points: 5,
  productive_points: 3,
  non_productive_penalty: -1,
  streak_days: 3,
  multiplier_trigger_days: 7,
  multiplier_value: 1.5,
  greeting_message: "Hello, Work Monster!",
  success_message: "Great work today!",
  rule_description_text:
    "Complete check-ins, submit your work, and stack streaks to unlock rewards.",
  manager_logic_text:
    "Manager reviews each submission, assigns points, and can fine-tune all game rules.",
  penalty_thresholds: [-1, -5, -10],
  penalty_rewards: [
    { threshold: -1, label: "Manager reward unlocked", value: "$50 equivalent" },
    { threshold: -5, label: "Manager reward unlocked", value: "$200 equivalent" },
    { threshold: -10, label: "Manager reward unlocked", value: "$500 equivalent" }
  ],
  penalty_description:
    "Risk Zone is active when points go below zero. You can recover by earning points.",
  rewards_blurb: "Keep momentum. Every step unlocks better rewards.",
  rule_version: 1,
  last_updated: now,
  changelog: [
    {
      version: 1,
      title: "Initial Work Monster rules",
      description: "Points, streaks, multipliers, rewards, and Risk Zone are now active.",
      sections: ["points", "streak", "multiplier", "rewards", "penalty", "manager"],
      updated_at: now
    }
  ]
};

export const DEFAULT_REWARDS: Reward[] = [
  {
    id: "reward_focus_break",
    title: "Focus Break",
    description: "30-minute guilt-free break coupon.",
    required_points: 20,
    created_by: "seed_manager",
    created_at: now
  },
  {
    id: "reward_weekend_treat",
    title: "Weekend Treat",
    description: "Manager-approved premium snack budget.",
    required_points: 50,
    created_by: "seed_manager",
    created_at: now
  },
  {
    id: "reward_golden_day",
    title: "Golden Day",
    description: "One custom reward day with manager approval.",
    required_points: 100,
    created_by: "seed_manager",
    created_at: now
  }
];

export const APP_NAME = "Work Monster";
