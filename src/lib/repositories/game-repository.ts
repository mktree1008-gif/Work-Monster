import { DEFAULT_REWARDS, DEFAULT_RULES } from "@/lib/constants";
import { getAdminDb, isFirebaseServerConfigured } from "@/lib/firebase/admin";
import {
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
}

export interface RuleUpdatePayload extends Partial<RuleConfig> {
  note?: string;
}

export interface GameRepository {
  signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile>;
  getUser(uid: string): Promise<UserProfile | null>;
  updateUser(uid: string, patch: Partial<UserProfile>): Promise<UserProfile>;
  getRules(): Promise<RuleConfig>;
  saveRules(nextRules: RuleConfig): Promise<RuleConfig>;
  getScore(uid: string): Promise<ScoreState>;
  saveScore(score: ScoreState): Promise<ScoreState>;
  listRewards(): Promise<Reward[]>;
  saveReward(reward: Reward): Promise<Reward>;
  listRewardClaims(userId: string): Promise<RewardClaim[]>;
  saveRewardClaim(claim: RewardClaim): Promise<RewardClaim>;
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

const seedUserId = "seed_user";
const seedManagerId = "seed_manager";

type MemoryDB = {
  users: Map<string, UserProfile>;
  rules: RuleConfig;
  scores: Map<string, ScoreState>;
  submissions: Map<string, Submission>;
  rewards: Map<string, Reward>;
  rewardClaims: Map<string, RewardClaim>;
  penaltyHistory: Map<string, PenaltyEvent>;
  auditLogs: Map<string, ManagerAuditLog>;
};

function createMemoryDB(): MemoryDB {
  const now = nowISO();
  const users = new Map<string, UserProfile>([
    [
      seedUserId,
      {
        id: seedUserId,
        email: "user@workmonster.app",
        role: "user",
        name: "Ashton",
        locale: "en",
        last_seen_rule_version: 0,
        created_at: now
      }
    ],
    [
      seedManagerId,
      {
        id: seedManagerId,
        email: "manager@workmonster.app",
        role: "manager",
        name: "Manager",
        locale: "en",
        last_seen_rule_version: DEFAULT_RULES.rule_version,
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
    penaltyHistory: new Map<string, PenaltyEvent>(),
    auditLogs: new Map<string, ManagerAuditLog>()
  };
}

class MemoryGameRepository implements GameRepository {
  private db: MemoryDB = createMemoryDB();

  async signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile> {
    const normalized = email.trim().toLowerCase();
    const existing = [...this.db.users.values()].find((user) => user.email === normalized);

    if (existing) {
      const updated: UserProfile = { ...existing, role, locale };
      this.db.users.set(updated.id, updated);
      return updated;
    }

    const id = createId("user");
    const user: UserProfile = {
      id,
      email: normalized,
      role,
      locale,
      name: normalized.split("@")[0] ?? "Player",
      last_seen_rule_version: 0,
      created_at: nowISO()
    };

    this.db.users.set(id, user);
    this.db.scores.set(id, defaultScore(id));
    return user;
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
    return this.db.rules;
  }

  async saveRules(nextRules: RuleConfig): Promise<RuleConfig> {
    this.db.rules = nextRules;
    return nextRules;
  }

  async getScore(uid: string): Promise<ScoreState> {
    const score = this.db.scores.get(uid);
    if (score) return score;

    const seeded = defaultScore(uid);
    this.db.scores.set(uid, seeded);
    return seeded;
  }

  async saveScore(score: ScoreState): Promise<ScoreState> {
    this.db.scores.set(score.user_id, score);
    return score;
  }

  async listRewards(): Promise<Reward[]> {
    return [...this.db.rewards.values()].sort((a, b) => a.required_points - b.required_points);
  }

  async saveReward(reward: Reward): Promise<Reward> {
    this.db.rewards.set(reward.id, reward);
    return reward;
  }

  async listRewardClaims(userId: string): Promise<RewardClaim[]> {
    return [...this.db.rewardClaims.values()].filter((claim) => claim.user_id === userId);
  }

  async saveRewardClaim(claim: RewardClaim): Promise<RewardClaim> {
    this.db.rewardClaims.set(claim.id, claim);
    return claim;
  }

  async listSubmissionsByUser(userId: string): Promise<Submission[]> {
    return [...this.db.submissions.values()]
      .filter((submission) => submission.user_id === userId)
      .sort((a, b) => (a.date > b.date ? -1 : 1));
  }

  async listPendingSubmissions(): Promise<Submission[]> {
    return [...this.db.submissions.values()]
      .filter((submission) => submission.status === "pending")
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
      penaltyHistory
    };
  }
}

class FirestoreGameRepository implements GameRepository {
  private db = getAdminDb();

  async signIn(email: string, role: UserRole, locale: Locale): Promise<UserProfile> {
    const normalized = email.trim().toLowerCase();
    const query = await this.db.collection("users").where("email", "==", normalized).limit(1).get();

    if (query.empty) {
      const id = createId("user");
      const user: UserProfile = {
        id,
        email: normalized,
        role,
        locale,
        name: normalized.split("@")[0] ?? "Player",
        last_seen_rule_version: 0,
        created_at: nowISO()
      };

      await this.db.collection("users").doc(id).set(user);
      await this.db.collection("scores").doc(id).set(defaultScore(id));
      return user;
    }

    const doc = query.docs[0];
    const user = doc.data() as UserProfile;
    const next = { ...user, role, locale };
    await this.db.collection("users").doc(doc.id).set(next, { merge: true });
    return next;
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
    return snap.data() as RuleConfig;
  }

  async saveRules(nextRules: RuleConfig): Promise<RuleConfig> {
    await this.db.collection("rules").doc("current").set(nextRules);
    return nextRules;
  }

  async getScore(uid: string): Promise<ScoreState> {
    const ref = this.db.collection("scores").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const seeded = defaultScore(uid);
      await ref.set(seeded);
      return seeded;
    }

    return snap.data() as ScoreState;
  }

  async saveScore(score: ScoreState): Promise<ScoreState> {
    await this.db.collection("scores").doc(score.user_id).set(score, { merge: true });
    return score;
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

  async listRewardClaims(userId: string): Promise<RewardClaim[]> {
    const snap = await this.db.collection("reward_claims").where("user_id", "==", userId).get();
    return snap.docs.map((doc) => doc.data() as RewardClaim);
  }

  async saveRewardClaim(claim: RewardClaim): Promise<RewardClaim> {
    await this.db.collection("reward_claims").doc(claim.id).set(claim, { merge: true });
    return claim;
  }

  async listSubmissionsByUser(userId: string): Promise<Submission[]> {
    const snap = await this.db.collection("submissions").where("user_id", "==", userId).get();
    return snap.docs
      .map((doc) => doc.data() as Submission)
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));
  }

  async listPendingSubmissions(): Promise<Submission[]> {
    const snap = await this.db.collection("submissions").where("status", "==", "pending").get();
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
      penaltyHistory
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

export function makeSubmissionFromDraft(draft: SubmissionDraft): Submission {
  return {
    id: createId("submission"),
    user_id: draft.user_id,
    date: toISODate(new Date()),
    mood: draft.mood,
    feeling: draft.feeling,
    calories: draft.calories,
    productive: draft.productive,
    custom_answers: draft.custom_answers,
    task_list: draft.task_list,
    file_url: draft.file_url,
    status: "pending",
    points_awarded: 0,
    created_at: nowISO()
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
