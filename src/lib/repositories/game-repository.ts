import { DEFAULT_REWARDS, DEFAULT_RULES } from "@/lib/constants";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { getAdminDb, isFirebaseServerConfigured } from "@/lib/firebase/admin";
import {
  Announcement,
  DashboardBundle,
  Locale,
  ManagerAuditLog,
  PenaltyEvent,
  Reward,
  RewardClaim,
  RuleConfig,
  ScoreState,
  Submission,
  UserProfile,
  UserRole
} from "@/lib/types";
import { createId, nowISO, toISODate } from "@/lib/utils";

export interface SubmissionDraft {
  user_id: string;
  mood: string;
  feeling: string;
  calories: number;
  productive: boolean;
  custom_answers: Record<string, string>;
  task_list: string[];
  file_url?: string;
  status?: Submission["status"];
  step_index?: number;
  feeling_state?: string;
  primary_productivity_factor?: string;
  primary_productivity_factor_note?: string;
  completed_top_priorities?: boolean;
  worked_on_high_impact?: boolean;
  avoided_low_value_work?: boolean;
  self_productivity_rating?: string;
  tomorrow_improvement_focus?: string;
  tomorrow_improvement_note?: string;
  completed_work_summary?: string;
  mission_tags?: string[];
  evidence_files?: string[];
  evidence_links?: string[];
  performance_score_preview?: number;
  coach_insight_text?: string;
  top_focus_summary?: string;
  energy_peak_summary?: string;
  submitted_at?: string;
  updated_at?: string;
}

export interface RuleUpdatePayload extends Partial<RuleConfig> {
  note?: string;
  target_rule_version?: number;
}

function normalizeLoginId(loginId: string): string {
  return loginId.trim().toLowerCase();
}

function isValidLoginId(loginId: string): boolean {
  const customIdPattern = /^[a-z0-9._-]{3,32}$/;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return customIdPattern.test(loginId) || emailPattern.test(loginId);
}

function loginIdFromEmail(email: string): string {
  const base = email.split("@")[0] ?? "player";
  const cleaned = base.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return cleaned.length >= 3 ? cleaned.slice(0, 32) : `user_${cleaned}`.slice(0, 32);
}

export interface GameRepository {
  signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile>;
  createAccountWithPassword(loginId: string, password: string, role: UserRole, locale: Locale): Promise<UserProfile>;
  signInWithPassword(
    loginId: string,
    password: string,
    role: UserRole,
    locale: Locale
  ): Promise<UserProfile>;
  listUsers(): Promise<UserProfile[]>;
  getUser(uid: string): Promise<UserProfile | null>;
  updateUser(uid: string, patch: Partial<UserProfile>): Promise<UserProfile>;
  getRules(): Promise<RuleConfig>;
  saveRules(nextRules: RuleConfig): Promise<RuleConfig>;
  getScore(uid: string): Promise<ScoreState>;
  saveScore(score: ScoreState): Promise<ScoreState>;
  listRewards(): Promise<Reward[]>;
  saveReward(reward: Reward): Promise<Reward>;
  deleteReward(rewardId: string): Promise<void>;
  listRewardClaims(userId: string): Promise<RewardClaim[]>;
  listPendingRewardClaimAlerts(limit?: number): Promise<RewardClaim[]>;
  saveRewardClaim(claim: RewardClaim): Promise<RewardClaim>;
  markRewardClaimsNotified(claimIds: string[], notifiedAtISO: string): Promise<void>;
  listAnnouncements(limit?: number): Promise<Announcement[]>;
  getAnnouncement(announcementId: string): Promise<Announcement | null>;
  saveAnnouncement(announcement: Announcement): Promise<Announcement>;
  deleteAnnouncement(announcementId: string): Promise<void>;
  listSubmissionsByUser(userId: string): Promise<Submission[]>;
  listPendingSubmissions(): Promise<Submission[]>;
  getSubmission(submissionId: string): Promise<Submission | null>;
  saveSubmission(submission: Submission): Promise<Submission>;
  listPenaltyEvents(userId: string): Promise<PenaltyEvent[]>;
  listOpenPenaltyEvents(userId: string): Promise<PenaltyEvent[]>;
  listOpenPenaltyEventsAll(): Promise<PenaltyEvent[]>;
  savePenaltyEvent(event: PenaltyEvent): Promise<PenaltyEvent>;
  listAuditLogs(limit?: number): Promise<ManagerAuditLog[]>;
  saveAuditLog(log: ManagerAuditLog): Promise<ManagerAuditLog>;
  getDashboardBundle(uid: string): Promise<DashboardBundle>;
}

function defaultScore(userId: string): ScoreState {
  return {
    user_id: userId,
    total_points: 0,
    lifetime_points: 0,
    current_streak: 0,
    longest_streak: 0,
    multiplier_active: false,
    multiplier_value: 1,
    penalty_active: false,
    negative_balance: 0,
    updated_at: nowISO()
  };
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeScoreState(userId: string, raw: Partial<ScoreState> | null | undefined): ScoreState {
  const seeded = defaultScore(userId);
  const merged: ScoreState = {
    ...seeded,
    ...(raw ?? {}),
    user_id: userId,
    total_points: Math.round(toFiniteNumber(raw?.total_points, seeded.total_points)),
    lifetime_points: Math.round(toFiniteNumber(raw?.lifetime_points, seeded.lifetime_points)),
    current_streak: Math.max(0, Math.round(toFiniteNumber(raw?.current_streak, seeded.current_streak))),
    longest_streak: Math.max(0, Math.round(toFiniteNumber(raw?.longest_streak, seeded.longest_streak))),
    multiplier_active: typeof raw?.multiplier_active === "boolean" ? raw.multiplier_active : seeded.multiplier_active,
    multiplier_value: toFiniteNumber(raw?.multiplier_value, seeded.multiplier_value),
    penalty_active: typeof raw?.penalty_active === "boolean" ? raw.penalty_active : seeded.penalty_active,
    negative_balance: Math.max(0, Math.round(toFiniteNumber(raw?.negative_balance, seeded.negative_balance))),
    updated_at: typeof raw?.updated_at === "string" && raw.updated_at.trim().length > 0 ? raw.updated_at : seeded.updated_at
  };

  if (typeof raw?.last_approved_at === "string" && raw.last_approved_at.trim().length > 0) {
    merged.last_approved_at = raw.last_approved_at;
  } else {
    delete merged.last_approved_at;
  }

  return merged;
}

const seedUserId = "seed_user";
const seedManagerId = "seed_manager";

type MemoryDB = {
  users: Map<string, UserProfile>;
  rules: RuleConfig;
  scores: Map<string, ScoreState>;
  submissions: Map<string, Submission>;
  rewards: Map<string, Reward>;
  rewardClaims: Map<string, RewardClaim>;
  announcements: Map<string, Announcement>;
  penaltyHistory: Map<string, PenaltyEvent>;
  auditLogs: Map<string, ManagerAuditLog>;
};

function createMemoryDB(): MemoryDB {
  const now = nowISO();
  const userSeedCredential = hashPassword("ashton1234");
  const managerSeedCredential = hashPassword("manager1234");
  const users = new Map<string, UserProfile>([
    [
      seedUserId,
      {
        id: seedUserId,
        login_id: "ashton",
        email: "user@workmonster.app",
        role: "user",
        name: "Ashton",
        locale: "en",
        character_glasses: true,
        profile_avatar_type: "emoji",
        profile_avatar_emoji: "😺",
        auth_provider: "password",
        password_hash: userSeedCredential.hash,
        password_salt: userSeedCredential.salt,
        last_seen_rule_version: 0,
        last_seen_manager_update_at: now,
        last_seen_notification_at: now,
        created_at: now
      }
    ],
    [
      seedManagerId,
      {
        id: seedManagerId,
        login_id: "manager",
        email: "manager@workmonster.app",
        role: "manager",
        name: "Manager",
        locale: "en",
        character_glasses: false,
        profile_avatar_type: "emoji",
        profile_avatar_emoji: "🧑‍💼",
        auth_provider: "password",
        password_hash: managerSeedCredential.hash,
        password_salt: managerSeedCredential.salt,
        last_seen_rule_version: DEFAULT_RULES.rule_version,
        last_seen_manager_update_at: now,
        last_seen_notification_at: now,
        created_at: now
      }
    ]
  ]);

  const scores = new Map<string, ScoreState>([
    [seedUserId, defaultScore(seedUserId)],
    [seedManagerId, defaultScore(seedManagerId)]
  ]);

  return {
    users,
    rules: structuredClone(DEFAULT_RULES),
    scores,
    submissions: new Map<string, Submission>(),
    rewards: new Map(DEFAULT_REWARDS.map((reward) => [reward.id, reward])),
    rewardClaims: new Map<string, RewardClaim>(),
    announcements: new Map<string, Announcement>(),
    penaltyHistory: new Map<string, PenaltyEvent>(),
    auditLogs: new Map<string, ManagerAuditLog>()
  };
}

function normalizeRuleVersionForLaunch<T extends RuleConfig>(rules: T): T {
  if (rules.rule_version_pinned_at || rules.rule_version <= 1) {
    return rules;
  }

  return {
    ...rules,
    rule_version: 1,
    rule_version_pinned_at: nowISO()
  };
}

function normalizeRules(raw: Partial<RuleConfig> | null | undefined): RuleConfig {
  const seeded: RuleConfig = {
    ...DEFAULT_RULES,
    ...(raw ?? {})
  };

  const penaltyThresholds = Array.isArray(raw?.penalty_thresholds)
    ? raw.penalty_thresholds
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item < 0)
        .map((item) => Math.floor(item))
    : [...DEFAULT_RULES.penalty_thresholds];

  const uniqueThresholds = [...new Set(penaltyThresholds)].sort((a, b) => b - a);

  const penaltyRewards = Array.isArray(raw?.penalty_rewards)
    ? raw.penalty_rewards
        .map((item) => ({
          threshold: Number(item?.threshold),
          label: String(item?.label ?? "").trim(),
          value: String(item?.value ?? "").trim()
        }))
        .filter((item) => Number.isFinite(item.threshold) && item.threshold < 0)
        .map((item) => ({
          threshold: Math.floor(item.threshold),
          label: item.label || "Manager reward unlocked",
          value: item.value || "$0 equivalent"
        }))
    : [...DEFAULT_RULES.penalty_rewards];

  const penaltyActionRules = Array.isArray((raw as { penalty_action_rules?: unknown[] } | null)?.penalty_action_rules)
    ? ((raw as { penalty_action_rules?: unknown[] }).penalty_action_rules ?? [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
        .slice(0, 20)
    : [...DEFAULT_RULES.penalty_action_rules];

  const normalized = normalizeRuleVersionForLaunch({
    ...seeded,
    inactivity_penalty_enabled:
      typeof raw?.inactivity_penalty_enabled === "boolean"
        ? raw.inactivity_penalty_enabled
        : DEFAULT_RULES.inactivity_penalty_enabled,
    inactivity_penalty_points_per_day: Math.min(
      0,
      Math.round(toFiniteNumber(raw?.inactivity_penalty_points_per_day, DEFAULT_RULES.inactivity_penalty_points_per_day))
    ),
    penalty_thresholds: uniqueThresholds.length > 0 ? uniqueThresholds : [...DEFAULT_RULES.penalty_thresholds],
    penalty_rewards: penaltyRewards.length > 0 ? penaltyRewards : [...DEFAULT_RULES.penalty_rewards],
    penalty_action_rules: penaltyActionRules
  });

  return normalized;
}

class MemoryGameRepository implements GameRepository {
  private db: MemoryDB = createMemoryDB();
  private findByEmail(email: string): UserProfile | undefined {
    return [...this.db.users.values()].find((user) => user.email === email);
  }

  private findByLoginId(loginId: string): UserProfile | undefined {
    return [...this.db.users.values()].find((user) => user.login_id === loginId);
  }

  private uniqueLoginId(baseLoginId: string): string {
    let candidate = baseLoginId;
    let suffix = 1;
    while (this.findByLoginId(candidate)) {
      candidate = `${baseLoginId}${suffix}`;
      suffix += 1;
    }
    return candidate.slice(0, 32);
  }

  async signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile> {
    const normalized = email.trim().toLowerCase();
    const existing = this.findByEmail(normalized);

    if (existing) {
      const fallbackLoginId = this.uniqueLoginId(loginIdFromEmail(normalized));
      const updated: UserProfile = {
        ...existing,
        login_id: existing.login_id || fallbackLoginId,
        role,
        locale,
        character_glasses: existing.character_glasses ?? true,
        profile_avatar_type: existing.profile_avatar_type ?? "emoji",
        profile_avatar_emoji: existing.profile_avatar_emoji ?? (role === "manager" ? "🧑‍💼" : "😺"),
        auth_provider: existing.auth_provider ?? "google",
        last_seen_notification_at: existing.last_seen_notification_at ?? nowISO()
      };
      this.db.users.set(updated.id, updated);
      return updated;
    }

    const rawLoginId = loginIdFromEmail(normalized);
    const loginId = this.uniqueLoginId(rawLoginId);
    const id = createId("user");
    const user: UserProfile = {
      id,
      login_id: loginId,
      email: normalized,
      role,
      locale,
      name: normalized.split("@")[0] ?? "Player",
      character_glasses: true,
      profile_avatar_type: "emoji",
      profile_avatar_emoji: role === "manager" ? "🧑‍💼" : "😺",
      auth_provider: "google",
      last_seen_rule_version: 0,
      last_seen_manager_update_at: nowISO(),
      last_seen_notification_at: nowISO(),
      created_at: nowISO()
    };

    this.db.users.set(id, user);
    this.db.scores.set(id, defaultScore(id));
    return user;
  }

  async createAccountWithPassword(
    loginIdInput: string,
    password: string,
    role: UserRole,
    locale: Locale
  ): Promise<UserProfile> {
    const loginId = normalizeLoginId(loginIdInput);
    if (!isValidLoginId(loginId)) {
      throw new Error("Use a valid email or an ID with 3-32 lowercase letters, numbers, ., _, -");
    }

    if (password.length < 6) {
      throw new Error("Security code must be at least 6 characters.");
    }

    if (this.findByLoginId(loginId)) {
      throw new Error("This ID is already taken.");
    }
    if (loginId.includes("@") && this.findByEmail(loginId)) {
      throw new Error("This email is already in use.");
    }

    const { hash, salt } = hashPassword(password);
    const id = createId("user");
    const email = loginId.includes("@") ? loginId : undefined;
    const user: UserProfile = {
      id,
      login_id: loginId,
      role,
      locale,
      name: "",
      character_glasses: true,
      profile_avatar_type: "emoji",
      profile_avatar_emoji: role === "manager" ? "🧑‍💼" : "😺",
      auth_provider: "password",
      password_hash: hash,
      password_salt: salt,
      last_seen_rule_version: 0,
      last_seen_manager_update_at: nowISO(),
      last_seen_notification_at: nowISO(),
      created_at: nowISO()
    };
    if (email) {
      user.email = email;
    }

    this.db.users.set(id, user);
    this.db.scores.set(id, defaultScore(id));
    return user;
  }

  async signInWithPassword(
    loginIdInput: string,
    password: string,
    role: UserRole,
    locale: Locale
  ): Promise<UserProfile> {
    const loginId = normalizeLoginId(loginIdInput);
    const found = this.findByLoginId(loginId);
    if (!found) {
      throw new Error("Account not found. Please create an account first.");
    }

    if (!found.password_hash || !found.password_salt) {
      throw new Error("This account uses Google sign-in.");
    }

    const valid = verifyPassword(password, found.password_salt, found.password_hash);
    if (!valid) {
      throw new Error("Incorrect ID or security code.");
    }

    const updated: UserProfile = { ...found, role, locale };
    this.db.users.set(updated.id, updated);
    return updated;
  }

  async listUsers(): Promise<UserProfile[]> {
    return [...this.db.users.values()].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
  }

  async getUser(uid: string): Promise<UserProfile | null> {
    return this.db.users.get(uid) ?? null;
  }

  async updateUser(uid: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const found = this.db.users.get(uid);
    if (!found) {
      throw new Error("User not found");
    }
    const next: UserProfile = { ...found, ...patch, id: found.id };
    this.db.users.set(uid, next);
    return next;
  }

  async getRules(): Promise<RuleConfig> {
    const normalized = normalizeRules(this.db.rules);
    this.db.rules = normalized;
    return normalized;
  }

  async saveRules(nextRules: RuleConfig): Promise<RuleConfig> {
    const normalized = normalizeRules(nextRules);
    this.db.rules = normalized;
    return normalized;
  }

  async getScore(uid: string): Promise<ScoreState> {
    const score = this.db.scores.get(uid);
    if (score) {
      const normalized = normalizeScoreState(uid, score);
      this.db.scores.set(uid, normalized);
      return normalized;
    }

    const seeded = defaultScore(uid);
    this.db.scores.set(uid, seeded);
    return seeded;
  }

  async saveScore(score: ScoreState): Promise<ScoreState> {
    const normalized = normalizeScoreState(score.user_id, score);
    this.db.scores.set(score.user_id, normalized);
    return normalized;
  }

  async listRewards(): Promise<Reward[]> {
    return [...this.db.rewards.values()].sort((a, b) => a.required_points - b.required_points);
  }

  async saveReward(reward: Reward): Promise<Reward> {
    this.db.rewards.set(reward.id, reward);
    return reward;
  }

  async deleteReward(rewardId: string): Promise<void> {
    this.db.rewards.delete(rewardId);
    for (const [claimId, claim] of this.db.rewardClaims.entries()) {
      if (claim.reward_id === rewardId) {
        this.db.rewardClaims.delete(claimId);
      }
    }
  }

  async listRewardClaims(userId: string): Promise<RewardClaim[]> {
    return [...this.db.rewardClaims.values()].filter((claim) => claim.user_id === userId);
  }

  async listPendingRewardClaimAlerts(limit = 20): Promise<RewardClaim[]> {
    return [...this.db.rewardClaims.values()]
      .filter((claim) => claim.status === "claimed" && !claim.manager_notified_at)
      .sort((a, b) => (a.claimed_at ?? "") > (b.claimed_at ?? "") ? -1 : 1)
      .slice(0, limit);
  }

  async saveRewardClaim(claim: RewardClaim): Promise<RewardClaim> {
    this.db.rewardClaims.set(claim.id, { ...claim, manager_notified_at: claim.manager_notified_at ?? null });
    return claim;
  }

  async markRewardClaimsNotified(claimIds: string[], notifiedAtISO: string): Promise<void> {
    for (const claimId of claimIds) {
      const found = this.db.rewardClaims.get(claimId);
      if (!found) continue;
      this.db.rewardClaims.set(claimId, { ...found, manager_notified_at: notifiedAtISO });
    }
  }

  async listAnnouncements(limit = 20): Promise<Announcement[]> {
    return [...this.db.announcements.values()]
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
      .slice(0, limit);
  }

  async getAnnouncement(announcementId: string): Promise<Announcement | null> {
    return this.db.announcements.get(announcementId) ?? null;
  }

  async saveAnnouncement(announcement: Announcement): Promise<Announcement> {
    this.db.announcements.set(announcement.id, announcement);
    return announcement;
  }

  async deleteAnnouncement(announcementId: string): Promise<void> {
    this.db.announcements.delete(announcementId);
  }

  async listSubmissionsByUser(userId: string): Promise<Submission[]> {
    return [...this.db.submissions.values()]
      .filter((submission) => submission.user_id === userId)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }

  async listPendingSubmissions(): Promise<Submission[]> {
    return [...this.db.submissions.values()]
      .filter((submission) => submission.status === "pending" || submission.status === "submitted" || submission.status === "in_review")
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  }

  async getSubmission(submissionId: string): Promise<Submission | null> {
    return this.db.submissions.get(submissionId) ?? null;
  }

  async saveSubmission(submission: Submission): Promise<Submission> {
    this.db.submissions.set(submission.id, submission);
    return submission;
  }

  async listPenaltyEvents(userId: string): Promise<PenaltyEvent[]> {
    return [...this.db.penaltyHistory.values()]
      .filter((event) => event.user_id === userId)
      .sort((a, b) => (a.triggered_at > b.triggered_at ? -1 : 1));
  }

  async listOpenPenaltyEvents(userId: string): Promise<PenaltyEvent[]> {
    return [...this.db.penaltyHistory.values()].filter(
      (event) => event.user_id === userId && event.recovered_at === undefined
    );
  }

  async listOpenPenaltyEventsAll(): Promise<PenaltyEvent[]> {
    return [...this.db.penaltyHistory.values()].filter((event) => event.recovered_at === undefined);
  }

  async savePenaltyEvent(event: PenaltyEvent): Promise<PenaltyEvent> {
    this.db.penaltyHistory.set(event.id, event);
    return event;
  }

  async listAuditLogs(limit = 30): Promise<ManagerAuditLog[]> {
    return [...this.db.auditLogs.values()]
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
      .slice(0, limit);
  }

  async saveAuditLog(log: ManagerAuditLog): Promise<ManagerAuditLog> {
    this.db.auditLogs.set(log.id, log);
    return log;
  }

  async getDashboardBundle(uid: string): Promise<DashboardBundle> {
    const user = await this.getUser(uid);
    if (!user) {
      throw new Error("User not found");
    }

    const [score, rewards, rewardClaims, submissions, penaltyHistory] = await Promise.all([
      this.getScore(uid),
      this.listRewards(),
      this.listRewardClaims(uid),
      this.listSubmissionsByUser(uid),
      this.listPenaltyEvents(uid)
    ]);

    return {
      user,
      score,
      rules: this.db.rules,
      rewards,
      rewardClaims,
      submissions,
      penaltyHistory,
      managerUpdates: [],
      notifications: [],
      unread_notification_count: 0
    };
  }
}

class FirestoreGameRepository implements GameRepository {
  private db = getAdminDb();
  private async findUserByEmail(email: string): Promise<{ id: string; user: UserProfile } | null> {
    const query = await this.db.collection("users").where("email", "==", email).limit(1).get();
    if (query.empty) return null;
    const doc = query.docs[0];
    return { id: doc.id, user: doc.data() as UserProfile };
  }

  private async findUserByLoginId(loginId: string): Promise<{ id: string; user: UserProfile } | null> {
    const query = await this.db.collection("users").where("login_id", "==", loginId).limit(1).get();
    if (query.empty) return null;
    const doc = query.docs[0];
    return { id: doc.id, user: doc.data() as UserProfile };
  }

  private async uniqueLoginId(baseLoginId: string): Promise<string> {
    let candidate = baseLoginId;
    let suffix = 1;
    while (await this.findUserByLoginId(candidate)) {
      candidate = `${baseLoginId}${suffix}`;
      suffix += 1;
    }
    return candidate.slice(0, 32);
  }

  async signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile> {
    const normalized = email.trim().toLowerCase();
    const found = await this.findUserByEmail(normalized);

    if (!found) {
      const rawLoginId = loginIdFromEmail(normalized);
      const loginId = await this.uniqueLoginId(rawLoginId);
      const id = createId("user");
      const user: UserProfile = {
        id,
        login_id: loginId,
        email: normalized,
        role,
        locale,
        name: normalized.split("@")[0] ?? "Player",
        character_glasses: true,
        profile_avatar_type: "emoji",
        profile_avatar_emoji: role === "manager" ? "🧑‍💼" : "😺",
        auth_provider: "google",
        last_seen_rule_version: 0,
        last_seen_manager_update_at: nowISO(),
        last_seen_notification_at: nowISO(),
        created_at: nowISO()
      };

      await this.db.collection("users").doc(id).set(user);
      await this.db.collection("scores").doc(id).set(defaultScore(id));
      return user;
    }

    const fallbackLoginId = await this.uniqueLoginId(loginIdFromEmail(normalized));
    const next = {
      ...found.user,
      login_id: found.user.login_id || fallbackLoginId,
      role,
      locale,
      character_glasses: found.user.character_glasses ?? true,
      profile_avatar_type: found.user.profile_avatar_type ?? "emoji",
      profile_avatar_emoji: found.user.profile_avatar_emoji ?? (role === "manager" ? "🧑‍💼" : "😺"),
      auth_provider: found.user.auth_provider ?? "google",
      last_seen_notification_at: found.user.last_seen_notification_at ?? nowISO()
    };
    await this.db.collection("users").doc(found.id).set(next, { merge: true });
    return next;
  }

  async createAccountWithPassword(
    loginIdInput: string,
    password: string,
    role: UserRole,
    locale: Locale
  ): Promise<UserProfile> {
    const loginId = normalizeLoginId(loginIdInput);
    if (!isValidLoginId(loginId)) {
      throw new Error("Use a valid email or an ID with 3-32 lowercase letters, numbers, ., _, -");
    }
    if (password.length < 6) {
      throw new Error("Security code must be at least 6 characters.");
    }
    if (await this.findUserByLoginId(loginId)) {
      throw new Error("This ID is already taken.");
    }
    if (loginId.includes("@") && (await this.findUserByEmail(loginId))) {
      throw new Error("This email is already in use.");
    }

    const credential = hashPassword(password);
    const id = createId("user");
    const email = loginId.includes("@") ? loginId : undefined;
    const user: UserProfile = {
      id,
      login_id: loginId,
      role,
      locale,
      name: "",
      character_glasses: true,
      profile_avatar_type: "emoji",
      profile_avatar_emoji: role === "manager" ? "🧑‍💼" : "😺",
      auth_provider: "password",
      password_hash: credential.hash,
      password_salt: credential.salt,
      last_seen_rule_version: 0,
      last_seen_manager_update_at: nowISO(),
      last_seen_notification_at: nowISO(),
      created_at: nowISO()
    };
    if (email) {
      user.email = email;
    }

    await this.db.collection("users").doc(id).set(user);
    await this.db.collection("scores").doc(id).set(defaultScore(id));
    return user;
  }

  async signInWithPassword(
    loginIdInput: string,
    password: string,
    role: UserRole,
    locale: Locale
  ): Promise<UserProfile> {
    const loginId = normalizeLoginId(loginIdInput);
    const found = await this.findUserByLoginId(loginId);
    if (!found) {
      throw new Error("Account not found. Please create an account first.");
    }

    const user = found.user;
    if (!user.password_hash || !user.password_salt) {
      throw new Error("This account uses Google sign-in.");
    }

    const valid = verifyPassword(password, user.password_salt, user.password_hash);
    if (!valid) {
      throw new Error("Incorrect ID or security code.");
    }

    const next = { ...user, role, locale };
    await this.db.collection("users").doc(found.id).set(next, { merge: true });
    return next;
  }

  async listUsers(): Promise<UserProfile[]> {
    const snap = await this.db.collection("users").orderBy("created_at", "asc").get();
    return snap.docs.map((doc) => doc.data() as UserProfile);
  }

  async getUser(uid: string): Promise<UserProfile | null> {
    const snap = await this.db.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    return snap.data() as UserProfile;
  }

  async updateUser(uid: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    const found = await this.getUser(uid);
    if (!found) throw new Error("User not found");
    const next = { ...found, ...patch, id: found.id };
    await this.db.collection("users").doc(uid).set(next, { merge: true });
    return next;
  }

  async getRules(): Promise<RuleConfig> {
    const snap = await this.db.collection("rules").doc("current").get();
    if (!snap.exists) {
      await this.db.collection("rules").doc("current").set(DEFAULT_RULES);
      return DEFAULT_RULES;
    }
    const raw = snap.data() as Partial<RuleConfig>;
    const normalized = normalizeRules(raw);
    if (
      normalized.rule_version !== raw.rule_version ||
      normalized.rule_version_pinned_at !== raw.rule_version_pinned_at ||
      !Array.isArray((raw as { penalty_action_rules?: unknown[] }).penalty_action_rules)
    ) {
      await this.db.collection("rules").doc("current").set(normalized, { merge: true });
    }
    return normalized;
  }

  async saveRules(nextRules: RuleConfig): Promise<RuleConfig> {
    const normalized = normalizeRules(nextRules);
    await this.db.collection("rules").doc("current").set(normalized);
    return normalized;
  }

  async getScore(uid: string): Promise<ScoreState> {
    const ref = this.db.collection("scores").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const seeded = defaultScore(uid);
      await ref.set(seeded);
      return seeded;
    }

    const raw = snap.data() as Partial<ScoreState>;
    const normalized = normalizeScoreState(uid, raw);
    await ref.set(normalized, { merge: true });
    return normalized;
  }

  async saveScore(score: ScoreState): Promise<ScoreState> {
    const normalized = normalizeScoreState(score.user_id, score);
    await this.db.collection("scores").doc(score.user_id).set(normalized, { merge: true });
    return normalized;
  }

  async listRewards(): Promise<Reward[]> {
    const snap = await this.db.collection("rewards").orderBy("required_points", "asc").get();

    if (snap.empty) {
      await Promise.all(
        DEFAULT_REWARDS.map((reward) => this.db.collection("rewards").doc(reward.id).set(reward))
      );
      return DEFAULT_REWARDS;
    }

    return snap.docs.map((doc) => doc.data() as Reward);
  }

  async saveReward(reward: Reward): Promise<Reward> {
    await this.db.collection("rewards").doc(reward.id).set(reward, { merge: true });
    return reward;
  }

  async deleteReward(rewardId: string): Promise<void> {
    await this.db.collection("rewards").doc(rewardId).delete();
    const claims = await this.db.collection("reward_claims").where("reward_id", "==", rewardId).get();
    if (!claims.empty) {
      const batch = this.db.batch();
      claims.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    }
  }

  async listRewardClaims(userId: string): Promise<RewardClaim[]> {
    const snap = await this.db.collection("reward_claims").where("user_id", "==", userId).get();
    return snap.docs.map((doc) => doc.data() as RewardClaim);
  }

  async listPendingRewardClaimAlerts(limit = 20): Promise<RewardClaim[]> {
    const snap = await this.db.collection("reward_claims").where("status", "==", "claimed").limit(limit * 2).get();
    return snap.docs
      .map((doc) => doc.data() as RewardClaim)
      .filter((claim) => !claim.manager_notified_at)
      .slice(0, limit);
  }

  async saveRewardClaim(claim: RewardClaim): Promise<RewardClaim> {
    await this.db
      .collection("reward_claims")
      .doc(claim.id)
      .set({ ...claim, manager_notified_at: claim.manager_notified_at ?? null }, { merge: true });
    return claim;
  }

  async markRewardClaimsNotified(claimIds: string[], notifiedAtISO: string): Promise<void> {
    if (claimIds.length === 0) return;
    const batch = this.db.batch();
    for (const claimId of claimIds) {
      const ref = this.db.collection("reward_claims").doc(claimId);
      batch.set(ref, { manager_notified_at: notifiedAtISO }, { merge: true });
    }
    await batch.commit();
  }

  async listAnnouncements(limit = 20): Promise<Announcement[]> {
    const snap = await this.db.collection("announcements").orderBy("created_at", "desc").limit(limit).get();
    return snap.docs.map((doc) => doc.data() as Announcement);
  }

  async getAnnouncement(announcementId: string): Promise<Announcement | null> {
    const snap = await this.db.collection("announcements").doc(announcementId).get();
    if (!snap.exists) return null;
    return snap.data() as Announcement;
  }

  async saveAnnouncement(announcement: Announcement): Promise<Announcement> {
    await this.db.collection("announcements").doc(announcement.id).set(announcement, { merge: true });
    return announcement;
  }

  async deleteAnnouncement(announcementId: string): Promise<void> {
    await this.db.collection("announcements").doc(announcementId).delete();
  }

  async listSubmissionsByUser(userId: string): Promise<Submission[]> {
    const snap = await this.db.collection("submissions").where("user_id", "==", userId).get();
    return snap.docs
      .map((doc) => doc.data() as Submission)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  }

  async listPendingSubmissions(): Promise<Submission[]> {
    const snap = await this.db.collection("submissions").where("status", "in", ["pending", "submitted", "in_review"]).get();
    return snap.docs
      .map((doc) => doc.data() as Submission)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  }

  async getSubmission(submissionId: string): Promise<Submission | null> {
    const snap = await this.db.collection("submissions").doc(submissionId).get();
    if (!snap.exists) return null;
    return snap.data() as Submission;
  }

  async saveSubmission(submission: Submission): Promise<Submission> {
    await this.db.collection("submissions").doc(submission.id).set(submission, { merge: true });
    return submission;
  }

  async listPenaltyEvents(userId: string): Promise<PenaltyEvent[]> {
    const snap = await this.db.collection("penalty_history").where("user_id", "==", userId).get();
    return snap.docs
      .map((doc) => {
        const data = doc.data() as PenaltyEvent;
        if (data.recovered_at === null) {
          delete data.recovered_at;
        }
        return data;
      })
      .sort((a, b) => (a.triggered_at > b.triggered_at ? -1 : 1));
  }

  async listOpenPenaltyEvents(userId: string): Promise<PenaltyEvent[]> {
    const base = this.db
      .collection("penalty_history")
      .where("user_id", "==", userId)
      .where("recovered_at", "==", null);
    const snap = await base.get();

    return snap.docs.map((doc) => {
      const data = doc.data() as PenaltyEvent;
      if (data.recovered_at === null) {
        delete data.recovered_at;
      }
      return data;
    });
  }

  async listOpenPenaltyEventsAll(): Promise<PenaltyEvent[]> {
    const snap = await this.db.collection("penalty_history").where("recovered_at", "==", null).get();

    return snap.docs.map((doc) => {
      const data = doc.data() as PenaltyEvent;
      if (data.recovered_at === null) {
        delete data.recovered_at;
      }
      return data;
    });
  }

  async savePenaltyEvent(event: PenaltyEvent): Promise<PenaltyEvent> {
    const payload = {
      ...event,
      recovered_at: event.recovered_at ?? null
    };
    await this.db.collection("penalty_history").doc(event.id).set(payload, { merge: true });
    return event;
  }

  async listAuditLogs(limit = 30): Promise<ManagerAuditLog[]> {
    const snap = await this.db
      .collection("audit_logs")
      .orderBy("created_at", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((doc) => doc.data() as ManagerAuditLog);
  }

  async saveAuditLog(log: ManagerAuditLog): Promise<ManagerAuditLog> {
    await this.db.collection("audit_logs").doc(log.id).set(log, { merge: true });
    return log;
  }

  async getDashboardBundle(uid: string): Promise<DashboardBundle> {
    const [user, score, rules, rewards, rewardClaims, submissions, penaltyHistory] = await Promise.all([
      this.getUser(uid),
      this.getScore(uid),
      this.getRules(),
      this.listRewards(),
      this.listRewardClaims(uid),
      this.listSubmissionsByUser(uid),
      this.listPenaltyEvents(uid)
    ]);

    if (!user) {
      throw new Error("User not found");
    }

    return {
      user,
      score,
      rules,
      rewards,
      rewardClaims,
      submissions,
      penaltyHistory,
      managerUpdates: [],
      notifications: [],
      unread_notification_count: 0
    };
  }
}

let memoryRepo: MemoryGameRepository = new MemoryGameRepository();
let firestoreRepo: FirestoreGameRepository | null = null;

export function getGameRepository(): GameRepository {
  if (isFirebaseServerConfigured()) {
    firestoreRepo = firestoreRepo ?? new FirestoreGameRepository();
    return firestoreRepo;
  }

  return memoryRepo;
}

export function resetInMemoryRepositoryForTests() {
  if (isFirebaseServerConfigured()) {
    return;
  }
  memoryRepo = new MemoryGameRepository();
}

export function makeSubmissionFromDraft(draft: SubmissionDraft, submissionDate?: string): Submission {
  const createdAt = nowISO();
  return {
    id: createId("submission"),
    user_id: draft.user_id,
    date: submissionDate ?? toISODate(new Date()),
    checkin_date: submissionDate ?? toISODate(new Date()),
    mood: draft.mood,
    feeling: draft.feeling,
    calories: draft.calories,
    productive: draft.productive,
    custom_answers: draft.custom_answers,
    task_list: draft.task_list,
    file_url: draft.file_url,
    status: draft.status ?? "submitted",
    points_awarded: 0,
    base_points_awarded: 0,
    bonus_points_awarded: 0,
    bonus_message: "",
    step_index: draft.step_index,
    feeling_state: draft.feeling_state,
    primary_productivity_factor: draft.primary_productivity_factor,
    primary_productivity_factor_note: draft.primary_productivity_factor_note,
    completed_top_priorities: draft.completed_top_priorities,
    worked_on_high_impact: draft.worked_on_high_impact,
    avoided_low_value_work: draft.avoided_low_value_work,
    self_productivity_rating: draft.self_productivity_rating,
    tomorrow_improvement_focus: draft.tomorrow_improvement_focus,
    tomorrow_improvement_note: draft.tomorrow_improvement_note,
    completed_work_summary: draft.completed_work_summary,
    mission_tags: draft.mission_tags ?? [],
    evidence_files: draft.evidence_files ?? [],
    evidence_links: draft.evidence_links ?? [],
    performance_score_preview: draft.performance_score_preview,
    coach_insight_text: draft.coach_insight_text,
    top_focus_summary: draft.top_focus_summary,
    energy_peak_summary: draft.energy_peak_summary,
    submission_time: draft.submitted_at ?? createdAt,
    submitted_at: draft.submitted_at,
    updated_at: draft.updated_at ?? createdAt,
    created_at: createdAt
  };
}

export function createAuditLog(
  actorUserId: string,
  action: string,
  targetId: string,
  details: Record<string, unknown>
): ManagerAuditLog {
  return {
    id: createId("audit"),
    actor_user_id: actorUserId,
    action,
    target_id: targetId,
    details,
    created_at: nowISO()
  };
}
