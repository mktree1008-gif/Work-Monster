import { DEFAULT_RULES } from "@/lib/constants";
import { computeMultiplier, computePenaltyState, computeStreak } from "@/lib/logic/scoring";
import { encodeMissionAnnouncement, getMissionDueDate, isMissionForUser, parseMissionAnnouncement } from "@/lib/mission";
import {
  createAuditLog,
  getGameRepository,
  makeSubmissionFromDraft,
  RuleUpdatePayload,
  SubmissionDraft
} from "@/lib/repositories/game-repository";
import {
  Announcement,
  AppNotification,
  DashboardBundle,
  ManagerUpdateNotification,
  ManagerReviewInput,
  PenaltyEvent,
  Reward,
  RewardClaim,
  RuleConfig,
  ScoreState,
  Submission,
  UserProfile
} from "@/lib/types";
import { createId, isISODateString, nowISO, toISODate, toISODateInTimeZone } from "@/lib/utils";

function resolvePenaltyReward(rules: RuleConfig, threshold: number): { label: string; value: string } {
  const found = rules.penalty_rewards.find((reward) => reward.threshold === threshold);
  if (found) {
    return { label: found.label, value: found.value };
  }

  return { label: "Manager reward unlocked", value: "$0 equivalent" };
}

type CheckInClientMeta = {
  clientLocalDate?: string;
  clientTimeZone?: string;
};

type DailyLoginAwardResult = {
  awarded: boolean;
  points: number;
  date: string;
  inactivityPenaltyDetected?: {
    loginDate: string;
    missedDays: number;
    suggestedPoints: number;
  };
};

type SubmitDailyCheckInResult = {
  submission: Submission;
  mode: "created" | "updated";
  submissionPointsAwarded: number;
};

type DailyCheckInSaveMode = "draft" | "submit";

type StreakSummary = {
  current_streak: number;
  longest_streak: number;
  last_approved_at?: string;
};

type InactivityPenaltyDraft = {
  targetId: string;
  userId: string;
  baselineDate: string;
  loginDate: string;
  missedDays: number;
  pointsPerDay: number;
  suggestedPoints: number;
};

function toSafeInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function sortISODateAsc(values: string[]): string[] {
  return [...values].sort((a, b) => (a > b ? 1 : -1));
}

function dayDiff(fromISODate: string, toISODateValue: string): number {
  const from = new Date(`${fromISODate}T00:00:00.000Z`).getTime();
  const to = new Date(`${toISODateValue}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

function toPenaltyTargetId(userId: string, loginDate: string): string {
  return `inactivity-penalty:${userId}:${loginDate}`;
}

function parsePenaltyTargetId(targetId: string): { userId: string; loginDate: string } | null {
  const matched = targetId.match(/^inactivity-penalty:([^:]+):(\d{4}-\d{2}-\d{2})$/);
  if (!matched) return null;
  return { userId: matched[1], loginDate: matched[2] };
}

function latestReferenceDate(user: UserProfile): string {
  const lastLogin = isISODateString(user.last_login_point_date ?? "") ? (user.last_login_point_date as string) : "";
  const lastPenalty = isISODateString(user.last_inactivity_penalty_date ?? "") ? (user.last_inactivity_penalty_date as string) : "";
  if (!lastLogin) return lastPenalty;
  if (!lastPenalty) return lastLogin;
  return lastPenalty > lastLogin ? lastPenalty : lastLogin;
}

function resolveInactivityPenaltyDraft(
  user: UserProfile,
  rules: RuleConfig,
  loginDate: string
): InactivityPenaltyDraft | null {
  if (user.role !== "user") return null;
  if (!rules.inactivity_penalty_enabled) return null;
  if (!isISODateString(loginDate)) return null;
  const baselineDate = latestReferenceDate(user);
  if (!baselineDate || !isISODateString(baselineDate)) return null;
  const diff = dayDiff(baselineDate, loginDate);
  if (!Number.isFinite(diff) || diff <= 1) return null;

  const missedDays = Math.max(0, diff - 1);
  if (missedDays <= 0) return null;
  const pointsPerDay = Math.round(rules.inactivity_penalty_points_per_day ?? -3);
  const suggestedPoints = pointsPerDay * missedDays;

  return {
    targetId: toPenaltyTargetId(user.id, loginDate),
    userId: user.id,
    baselineDate,
    loginDate,
    missedDays,
    pointsPerDay,
    suggestedPoints
  };
}

const RULE_SECTION_LABELS: Record<string, string> = {
  checkin_points: "Check-in points",
  submission_points: "Submission points",
  productive_points: "Productive bonus",
  non_productive_penalty: "Penalty points",
  inactivity_penalty_enabled: "Inactive login penalty toggle",
  inactivity_penalty_points_per_day: "Inactive login penalty per day",
  streak_days: "Streak rule",
  multiplier_trigger_days: "Multiplier trigger",
  multiplier_value: "Multiplier value",
  greeting_message: "Greeting copy",
  success_message: "Success copy",
  rule_description_text: "Rule description",
  manager_logic_text: "Manager logic text",
  penalty_description: "Penalty description",
  rewards_blurb: "Rewards copy",
  penalty_thresholds: "Penalty thresholds",
  penalty_rewards: "Penalty rewards",
  penalty_action_rules: "Penalty actions"
};

function summarizeRuleSections(sections: string[], locale: UserProfile["locale"]): string {
  const labels = sections
    .map((section) => RULE_SECTION_LABELS[section] ?? section.replaceAll("_", " "))
    .slice(0, 4);
  if (labels.length === 0) {
    return locale === "ko" ? "세부 업데이트가 적용되었습니다." : "Detailed updates were applied.";
  }
  if (locale === "ko") {
    return `변경 항목: ${labels.join(", ")}${sections.length > labels.length ? " 외" : ""}`;
  }
  return `Updated: ${labels.join(", ")}${sections.length > labels.length ? ", and more" : ""}`;
}

function toISODateOnly(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function extractISODate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return isISODateString(text) ? text : null;
}

function computeMissionDuration(startDate: string, dueDate: string): number {
  const start = toISODateOnly(startDate);
  const due = toISODateOnly(dueDate);
  if (!start || !due) return 0;
  const startTime = new Date(`${start}T00:00:00.000Z`).getTime();
  const dueTime = new Date(`${due}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(dueTime) || dueTime < startTime) return 0;
  return Math.max(1, Math.round((dueTime - startTime) / 86_400_000) + 1);
}

function summarizeApprovedStreak(approvedDates: string[]): StreakSummary {
  const uniqueSorted = sortISODateAsc([...new Set(approvedDates.filter(isISODateString))]);
  if (uniqueSorted.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0
    };
  }

  let current = 1;
  let longest = 1;

  for (let i = 1; i < uniqueSorted.length; i += 1) {
    const prev = uniqueSorted[i - 1];
    const now = uniqueSorted[i];
    if (dayDiff(prev, now) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > longest) {
      longest = current;
    }
  }

  let tail = 1;
  for (let i = uniqueSorted.length - 1; i > 0; i -= 1) {
    if (dayDiff(uniqueSorted[i - 1], uniqueSorted[i]) === 1) {
      tail += 1;
      continue;
    }
    break;
  }

  return {
    current_streak: tail,
    longest_streak: longest,
    last_approved_at: uniqueSorted[uniqueSorted.length - 1]
  };
}

export class DailyCheckInAlreadySubmittedError extends Error {
  readonly code = "already_submitted" as const;
  readonly submissionId?: string;

  constructor(message: string, submissionId?: string) {
    super(message);
    this.name = "DailyCheckInAlreadySubmittedError";
    this.submissionId = submissionId;
  }
}

function resolveSubmissionDate(meta?: CheckInClientMeta): string {
  const rawDate = (meta?.clientLocalDate ?? "").trim();
  if (rawDate && isISODateString(rawDate)) {
    return rawDate;
  }

  const rawTimeZone = (meta?.clientTimeZone ?? "").trim();
  if (rawTimeZone) {
    try {
      return toISODateInTimeZone(rawTimeZone);
    } catch {
      return toISODate();
    }
  }

  return toISODate();
}

async function awardSubmissionBasePointsOnce(params: {
  userId: string;
  submissionId: string;
  submissionDate: string;
  points: number;
}): Promise<number> {
  const repo = getGameRepository();
  const safePoints = Math.round(params.points);
  if (safePoints === 0) return 0;

  const logs = await repo.listAuditLogs(500);
  const alreadyAwarded = logs.some(
    (log) => log.action === "submission.base_points_awarded" && log.target_id === params.submissionId
  );
  if (alreadyAwarded) return 0;

  const score = await repo.getScore(params.userId);
  await repo.saveScore({
    ...score,
    total_points: score.total_points + safePoints,
    lifetime_points: score.lifetime_points + Math.max(0, safePoints),
    updated_at: nowISO()
  });
  await recalculateScore(params.userId);
  await repo.saveAuditLog(
    createAuditLog(params.userId, "submission.base_points_awarded", params.submissionId, {
      points: safePoints,
      date: params.submissionDate
    })
  );

  return safePoints;
}

export async function submitDailyCheckIn(
  userId: string,
  draft: Omit<SubmissionDraft, "user_id">,
  meta?: CheckInClientMeta,
  saveMode: DailyCheckInSaveMode = "submit"
): Promise<SubmitDailyCheckInResult> {
  const repo = getGameRepository();
  const targetDate = resolveSubmissionDate(meta);
  const submissions = await repo.listSubmissionsByUser(userId);
  const sameDateSubmissions = submissions
    .filter((item) => item.date === targetDate)
    .sort((a, b) => {
      const left = a.created_at ?? "";
      const right = b.created_at ?? "";
      return left > right ? -1 : 1;
    });

  const reviewedSameDate = sameDateSubmissions.find((item) => item.status === "approved" || item.status === "rejected");
  if (reviewedSameDate) {
    throw new DailyCheckInAlreadySubmittedError(
      "You already submitted today. Check your score after manager review.",
      reviewedSameDate.id
    );
  }

  const editableSameDate = sameDateSubmissions.find(
    (item) =>
      item.status === "pending"
      || item.status === "submitted"
      || item.status === "draft"
      || item.status === "in_review"
      || item.status === "needs_revision"
  );
  if (editableSameDate) {
    const nextStatus = saveMode === "draft" ? "draft" : "submitted";
    const submittedAt = saveMode === "submit" ? nowISO() : editableSameDate.submitted_at;
    const updatedPending: Submission = {
      ...editableSameDate,
      mood: draft.mood,
      feeling: draft.feeling,
      calories: draft.calories,
      productive: draft.productive,
      custom_answers: draft.custom_answers,
      task_list: draft.task_list,
      file_url: draft.file_url ?? "",
      checkin_date: targetDate,
      status: nextStatus,
      step_index: draft.step_index ?? editableSameDate.step_index,
      feeling_state: draft.feeling_state ?? editableSameDate.feeling_state,
      primary_productivity_factor: draft.primary_productivity_factor ?? editableSameDate.primary_productivity_factor,
      primary_productivity_factor_note: draft.primary_productivity_factor_note ?? editableSameDate.primary_productivity_factor_note,
      completed_top_priorities: draft.completed_top_priorities ?? editableSameDate.completed_top_priorities,
      worked_on_high_impact: draft.worked_on_high_impact ?? editableSameDate.worked_on_high_impact,
      avoided_low_value_work: draft.avoided_low_value_work ?? editableSameDate.avoided_low_value_work,
      self_productivity_rating: draft.self_productivity_rating ?? editableSameDate.self_productivity_rating,
      tomorrow_improvement_focus: draft.tomorrow_improvement_focus ?? editableSameDate.tomorrow_improvement_focus,
      tomorrow_improvement_note: draft.tomorrow_improvement_note ?? editableSameDate.tomorrow_improvement_note,
      completed_work_summary: draft.completed_work_summary ?? editableSameDate.completed_work_summary,
      mission_tags: draft.mission_tags ?? editableSameDate.mission_tags ?? [],
      evidence_files: draft.evidence_files ?? editableSameDate.evidence_files ?? [],
      evidence_links: draft.evidence_links ?? editableSameDate.evidence_links ?? [],
      performance_score_preview: draft.performance_score_preview ?? editableSameDate.performance_score_preview,
      coach_insight_text: draft.coach_insight_text ?? editableSameDate.coach_insight_text,
      top_focus_summary: draft.top_focus_summary ?? editableSameDate.top_focus_summary,
      energy_peak_summary: draft.energy_peak_summary ?? editableSameDate.energy_peak_summary,
      ...(submittedAt ? { submitted_at: submittedAt } : {}),
      submission_time: submittedAt ?? editableSameDate.submission_time ?? nowISO(),
      updated_at: nowISO()
    };
    await repo.saveSubmission(updatedPending);
    let submissionPointsAwarded = 0;
    if (saveMode === "submit") {
      const rules = await repo.getRules();
      submissionPointsAwarded = await awardSubmissionBasePointsOnce({
        userId,
        submissionId: updatedPending.id,
        submissionDate: updatedPending.date,
        points: Math.round(rules.submission_points ?? 0)
      });
    }
    return { submission: updatedPending, mode: "updated" as const, submissionPointsAwarded };
  }

  const createdAt = nowISO();
  const submittedAt = saveMode === "submit" ? createdAt : undefined;
  const submission = makeSubmissionFromDraft(
    {
      ...draft,
      user_id: userId,
      status: saveMode === "draft" ? "draft" : "submitted",
      ...(submittedAt ? { submitted_at: submittedAt } : {}),
      updated_at: createdAt
    },
    targetDate
  );
  await repo.saveSubmission(submission);

  let submissionPointsAwarded = 0;
  if (saveMode === "submit") {
    const rules = await repo.getRules();
    submissionPointsAwarded = await awardSubmissionBasePointsOnce({
      userId,
      submissionId: submission.id,
      submissionDate: submission.date,
      points: Math.round(rules.submission_points ?? 0)
    });
  }

  return { submission, mode: "created" as const, submissionPointsAwarded };
}

export async function awardDailyLoginPoints(userId: string): Promise<DailyLoginAwardResult> {
  const repo = getGameRepository();
  const [user, rules, score] = await Promise.all([
    repo.getUser(userId),
    repo.getRules(),
    repo.getScore(userId)
  ]);

  if (!user) {
    throw new Error("User not found.");
  }
  if (user.role === "manager") {
    return { awarded: false, points: 0, date: toISODate() };
  }

  const loginDate = toISODate();
  const inactivityDraft = resolveInactivityPenaltyDraft(user, rules, loginDate);
  if (user.last_login_point_date === loginDate) {
    return { awarded: false, points: 0, date: loginDate };
  }

  const loginPoints = Math.round(rules.checkin_points ?? 0);
  const celebrateAward = loginPoints > 0;

  if (loginPoints !== 0) {
    await repo.saveScore({
      ...score,
      total_points: score.total_points + loginPoints,
      lifetime_points: score.lifetime_points + Math.max(0, loginPoints),
      updated_at: nowISO()
    });
    await recalculateScore(userId);
    await repo.saveAuditLog(
      createAuditLog(userId, "login.base_points_awarded", `users/${userId}`, {
        points: loginPoints,
        date: loginDate
      })
    );
  }

  if (inactivityDraft) {
    const logs = await repo.listAuditLogs(2000);
    const alreadyTracked = logs.some(
      (log) =>
        log.target_id === inactivityDraft.targetId
        && (
          log.action === "login.inactivity_penalty_detected"
          || log.action === "login.inactivity_penalty_applied"
          || log.action === "login.inactivity_penalty_skipped"
        )
    );

    if (!alreadyTracked) {
      await repo.saveAuditLog(
        createAuditLog(user.id, "login.inactivity_penalty_detected", inactivityDraft.targetId, {
          user_id: inactivityDraft.userId,
          login_date: inactivityDraft.loginDate,
          baseline_date: inactivityDraft.baselineDate,
          missed_days: inactivityDraft.missedDays,
          points_per_day: inactivityDraft.pointsPerDay,
          suggested_points: inactivityDraft.suggestedPoints
        })
      );
    }
  }

  await repo.updateUser(userId, { last_login_point_date: loginDate });
  return {
    awarded: celebrateAward,
    points: loginPoints,
    date: loginDate,
    inactivityPenaltyDetected: inactivityDraft
      ? {
          loginDate: inactivityDraft.loginDate,
          missedDays: inactivityDraft.missedDays,
          suggestedPoints: inactivityDraft.suggestedPoints
        }
      : undefined
  };
}

export async function applyInactivityPenalty(
  managerId: string,
  payload: {
    target_id: string;
    points?: number;
    note?: string;
  }
): Promise<{ userId: string; loginDate: string; missedDays: number; appliedPoints: number }> {
  const repo = getGameRepository();
  const targetId = String(payload.target_id ?? "").trim();
  const parsedTarget = parsePenaltyTargetId(targetId);
  if (!parsedTarget) {
    throw new Error("Invalid inactivity penalty target.");
  }

  const [user, logs, score] = await Promise.all([
    repo.getUser(parsedTarget.userId),
    repo.listAuditLogs(4000),
    repo.getScore(parsedTarget.userId)
  ]);
  if (!user) {
    throw new Error("Target user not found.");
  }
  if (user.role !== "user") {
    throw new Error("Inactive login penalties are only for user accounts.");
  }

  const detectedLog = logs
    .filter((log) => log.target_id === targetId && log.action === "login.inactivity_penalty_detected")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  if (!detectedLog) {
    throw new Error("No pending inactivity penalty candidate found.");
  }

  const alreadyResolved = logs.some(
    (log) =>
      log.target_id === targetId
      && (log.action === "login.inactivity_penalty_applied" || log.action === "login.inactivity_penalty_skipped")
  );
  if (alreadyResolved) {
    throw new Error("This inactivity penalty has already been resolved.");
  }

  const missedDays = toSafeInt(detectedLog.details.missed_days);
  const suggestedPoints = toSafeInt(detectedLog.details.suggested_points);
  const appliedPoints = Number.isFinite(payload.points) ? Math.round(payload.points ?? 0) : suggestedPoints;

  if (appliedPoints !== 0) {
    await repo.saveScore({
      ...score,
      total_points: score.total_points + appliedPoints,
      lifetime_points: score.lifetime_points + Math.max(0, appliedPoints),
      updated_at: nowISO()
    });
    await recalculateScore(parsedTarget.userId);
  }

  await repo.updateUser(parsedTarget.userId, { last_inactivity_penalty_date: parsedTarget.loginDate });
  await repo.saveAuditLog(
    createAuditLog(managerId, "login.inactivity_penalty_applied", targetId, {
      user_id: parsedTarget.userId,
      login_date: parsedTarget.loginDate,
      baseline_date: String(detectedLog.details.baseline_date ?? ""),
      missed_days: missedDays,
      suggested_points: suggestedPoints,
      points_applied: appliedPoints,
      note: String(payload.note ?? "").trim()
    })
  );

  return {
    userId: parsedTarget.userId,
    loginDate: parsedTarget.loginDate,
    missedDays,
    appliedPoints
  };
}

export async function skipInactivityPenalty(
  managerId: string,
  payload: {
    target_id: string;
    note?: string;
  }
): Promise<{ userId: string; loginDate: string; missedDays: number }> {
  const repo = getGameRepository();
  const targetId = String(payload.target_id ?? "").trim();
  const parsedTarget = parsePenaltyTargetId(targetId);
  if (!parsedTarget) {
    throw new Error("Invalid inactivity penalty target.");
  }

  const [user, logs] = await Promise.all([
    repo.getUser(parsedTarget.userId),
    repo.listAuditLogs(4000)
  ]);
  if (!user) {
    throw new Error("Target user not found.");
  }

  const detectedLog = logs
    .filter((log) => log.target_id === targetId && log.action === "login.inactivity_penalty_detected")
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  if (!detectedLog) {
    throw new Error("No pending inactivity penalty candidate found.");
  }

  const alreadyResolved = logs.some(
    (log) =>
      log.target_id === targetId
      && (log.action === "login.inactivity_penalty_applied" || log.action === "login.inactivity_penalty_skipped")
  );
  if (alreadyResolved) {
    throw new Error("This inactivity penalty has already been resolved.");
  }

  const missedDays = toSafeInt(detectedLog.details.missed_days);
  await repo.updateUser(parsedTarget.userId, { last_inactivity_penalty_date: parsedTarget.loginDate });
  await repo.saveAuditLog(
    createAuditLog(managerId, "login.inactivity_penalty_skipped", targetId, {
      user_id: parsedTarget.userId,
      login_date: parsedTarget.loginDate,
      baseline_date: String(detectedLog.details.baseline_date ?? ""),
      missed_days: missedDays,
      suggested_points: toSafeInt(detectedLog.details.suggested_points),
      note: String(payload.note ?? "").trim()
    })
  );

  return {
    userId: parsedTarget.userId,
    loginDate: parsedTarget.loginDate,
    missedDays
  };
}

export async function approveSubmission(
  input: ManagerReviewInput,
  managerId: string
): Promise<Submission> {
  const repo = getGameRepository();
  const submission = await repo.getSubmission(input.submissionId);

  if (!submission) {
    throw new Error("Submission not found.");
  }

  const rawPoints = Number.isFinite(input.points) ? Math.round(input.points) : 0;
  const normalizedPoints = input.approved ? rawPoints : Math.min(0, rawPoints);
  const bonusRaw = Number.isFinite(input.bonus_points) ? Math.round(input.bonus_points ?? 0) : 0;
  const normalizedBonus = Math.max(0, bonusRaw);
  const normalizedBonusMessage = normalizedBonus > 0 ? String(input.bonus_message ?? "").trim().slice(0, 180) : "";
  const now = nowISO();
  const score = await repo.getScore(submission.user_id);

  let appliedPoints = 0;
  let baseAppliedPoints = 0;
  let nextScore: ScoreState | null = null;

  if (input.approved) {
    const rules = await repo.getRules();
    const streak = computeStreak(score.current_streak, score.last_approved_at, submission.date);
    const multiplierState = computeMultiplier(streak, rules.multiplier_trigger_days, rules.multiplier_value);
    const scoredBasePoints =
      normalizedPoints > 0
        ? Math.round(normalizedPoints * multiplierState.multiplier_value)
        : normalizedPoints;
    baseAppliedPoints = scoredBasePoints;
    appliedPoints = scoredBasePoints + normalizedBonus;

    nextScore = {
      ...score,
      total_points: score.total_points + appliedPoints,
      lifetime_points: score.lifetime_points + Math.max(0, appliedPoints),
      current_streak: streak,
      longest_streak: Math.max(score.longest_streak, streak),
      multiplier_active: multiplierState.multiplier_active,
      multiplier_value: multiplierState.multiplier_value,
      updated_at: now,
      last_approved_at: submission.date
    };
  } else if (normalizedPoints !== 0 || normalizedBonus > 0) {
    baseAppliedPoints = normalizedPoints;
    appliedPoints = normalizedPoints + normalizedBonus;
    nextScore = {
      ...score,
      total_points: score.total_points + appliedPoints,
      lifetime_points: score.lifetime_points + Math.max(0, appliedPoints),
      updated_at: now
    };
  }

  const reviewed: Submission = {
    ...submission,
    status: input.approved ? "approved" : "rejected",
    manager_note: input.note,
    points_awarded: appliedPoints,
    base_points_awarded: baseAppliedPoints,
    bonus_points_awarded: normalizedBonus,
    bonus_message: normalizedBonusMessage,
    reviewed_at: now
  };

  await repo.saveSubmission(reviewed);

  if (nextScore) {
    await repo.saveScore(nextScore);
    await recalculateScore(submission.user_id);
  }

  await repo.saveAuditLog(
    createAuditLog(managerId, "submission.reviewed", reviewed.id, {
      approved: input.approved,
      points: reviewed.points_awarded,
      base_points: reviewed.base_points_awarded ?? 0,
      bonus_points: reviewed.bonus_points_awarded ?? 0,
      bonus_message: reviewed.bonus_message ?? "",
      note: reviewed.manager_note ?? ""
    })
  );

  await rebuildUserScoreFromHistory(submission.user_id);

  return reviewed;
}

export async function recalculateScore(userId: string): Promise<ScoreState> {
  const repo = getGameRepository();
  const [score, rules, openEvents] = await Promise.all([
    repo.getScore(userId),
    repo.getRules(),
    repo.listOpenPenaltyEvents(userId)
  ]);

  const penaltyState = computePenaltyState(score.total_points, rules.penalty_thresholds, openEvents);

  if (penaltyState.recovered) {
    await Promise.all(
      openEvents.map((event) =>
        repo.savePenaltyEvent({
          ...event,
          recovered_at: nowISO(),
          manager_reward_unlocked: false
        })
      )
    );
  }

  if (penaltyState.crossed_thresholds.length > 0) {
    const newEvents: PenaltyEvent[] = penaltyState.crossed_thresholds.map((threshold) => {
      const reward = resolvePenaltyReward(rules, threshold);
      return {
        id: createId("penalty"),
        user_id: userId,
        threshold,
        negative_balance: Math.abs(score.total_points),
        description: rules.penalty_description,
        reward_label: reward.label,
        reward_value: reward.value,
        manager_reward_unlocked: true,
        claimed_by_manager: false,
        triggered_at: nowISO()
      };
    });

    await Promise.all(newEvents.map((event) => repo.savePenaltyEvent(event)));
  }

  const needsScorePatch =
    score.penalty_active !== penaltyState.penalty_active
    || score.negative_balance !== penaltyState.negative_balance;

  if (!needsScorePatch) {
    return score;
  }

  const patched: ScoreState = {
    ...score,
    penalty_active: penaltyState.penalty_active,
    negative_balance: penaltyState.negative_balance,
    updated_at: nowISO()
  };

  return repo.saveScore(patched);
}

export async function rebuildUserScoreFromHistory(userId: string): Promise<ScoreState> {
  const repo = getGameRepository();
  const [existingScore, rules, submissions, logs] = await Promise.all([
    repo.getScore(userId),
    repo.getRules(),
    repo.listSubmissionsByUser(userId),
    repo.listAuditLogs(5000)
  ]);

  const submissionMap = new Map(submissions.map((submission) => [submission.id, submission] as const));
  const reviewedLogBySubmission = new Map<string, { created_at: string; points: number }>();
  const awardedSubmissionBase = new Set<string>();

  let totalPoints = 0;
  let lifetimePoints = 0;

  const addDelta = (delta: number) => {
    totalPoints += delta;
    if (delta > 0) {
      lifetimePoints += delta;
    }
  };

  for (const log of logs) {
    if (log.action === "login.base_points_awarded" && log.actor_user_id === userId) {
      addDelta(toSafeInt(log.details.points));
      continue;
    }

    if (log.action === "login.inactivity_penalty_applied" && String(log.details.user_id ?? "") === userId) {
      addDelta(toSafeInt(log.details.points_applied));
      continue;
    }

    if (
      log.action === "submission.base_points_awarded"
      && log.actor_user_id === userId
      && submissionMap.has(log.target_id)
      && !awardedSubmissionBase.has(log.target_id)
    ) {
      awardedSubmissionBase.add(log.target_id);
      addDelta(toSafeInt(log.details.points));
      continue;
    }

    if (log.action === "submission.reviewed" && submissionMap.has(log.target_id)) {
      const parsedPoints = Number(log.details.points);
      const points = Number.isFinite(parsedPoints)
        ? Math.round(parsedPoints)
        : toSafeInt(log.details.base_points) + Math.max(0, toSafeInt(log.details.bonus_points));
      const found = reviewedLogBySubmission.get(log.target_id);
      if (!found || log.created_at > found.created_at) {
        reviewedLogBySubmission.set(log.target_id, { created_at: log.created_at, points });
      }
    }
  }

  const reflectedReviewSubmissionIds = new Set<string>();
  for (const [submissionId, item] of reviewedLogBySubmission.entries()) {
    reflectedReviewSubmissionIds.add(submissionId);
    addDelta(item.points);
  }

  for (const submission of submissions) {
    const isReviewed = submission.status === "approved" || submission.status === "rejected";
    if (!isReviewed) continue;
    if (reflectedReviewSubmissionIds.has(submission.id)) continue;
    addDelta(toSafeInt(submission.points_awarded));
  }

  const streakSummary = summarizeApprovedStreak(
    submissions
      .filter((submission) => submission.status === "approved")
      .map((submission) => submission.date)
  );
  const multiplier = computeMultiplier(
    streakSummary.current_streak,
    rules.multiplier_trigger_days,
    rules.multiplier_value
  );

  const rebuiltScore: ScoreState = {
    ...existingScore,
    user_id: userId,
    total_points: totalPoints,
    lifetime_points: lifetimePoints,
    current_streak: streakSummary.current_streak,
    longest_streak: streakSummary.longest_streak,
    multiplier_active: multiplier.multiplier_active,
    multiplier_value: multiplier.multiplier_value,
    updated_at: nowISO(),
    last_approved_at: streakSummary.last_approved_at
  };

  if (!rebuiltScore.last_approved_at) {
    delete rebuiltScore.last_approved_at;
  }

  const normalizedExistingLastApproved = (existingScore.last_approved_at ?? "").trim();
  const normalizedRebuiltLastApproved = (rebuiltScore.last_approved_at ?? "").trim();
  const scoreNeedsSync =
    existingScore.total_points !== rebuiltScore.total_points
    || existingScore.lifetime_points !== rebuiltScore.lifetime_points
    || existingScore.current_streak !== rebuiltScore.current_streak
    || existingScore.longest_streak !== rebuiltScore.longest_streak
    || existingScore.multiplier_active !== rebuiltScore.multiplier_active
    || existingScore.multiplier_value !== rebuiltScore.multiplier_value
    || normalizedExistingLastApproved !== normalizedRebuiltLastApproved;

  if (scoreNeedsSync) {
    await repo.saveScore(rebuiltScore);
  }

  return recalculateScore(userId);
}

export async function rebuildAllUserScores(): Promise<void> {
  const repo = getGameRepository();
  const users = await repo.listUsers();
  const userIds = users.filter((user) => user.role === "user").map((user) => user.id);
  for (const userId of userIds) {
    await rebuildUserScoreFromHistory(userId);
  }
}

export async function updateRules(
  payload: RuleUpdatePayload,
  managerId: string
): Promise<RuleConfig> {
  const repo = getGameRepository();
  const current = await repo.getRules();
  const { note, target_rule_version, ...rulePatch } = payload;

  const changedFields = Object.keys(rulePatch);
  const manualTarget = Number.isFinite(target_rule_version) && Number(target_rule_version) > 0
    ? Math.floor(Number(target_rule_version))
    : null;
  const nextVersion = manualTarget ?? current.rule_version + 1;
  const updatedAt = nowISO();
  const changeTitle = note?.trim()
    ? note.trim()
    : manualTarget
      ? `Rule version set to v${nextVersion}`
      : "Manager updated the rules";
  const sectionSummary = summarizeRuleSections(changedFields, "en");
  const changeDescription = note?.trim()
    ? `${note.trim()} • ${sectionSummary}`
    : manualTarget
      ? `Manager adjusted the rule version label. ${sectionSummary}`
      : `${sectionSummary}. Open Rules tab for full details.`;
  const changeEntry = {
    version: nextVersion,
    title: changeTitle,
    description: changeDescription,
    sections: changedFields.length > 0 ? changedFields : ["rule_version"],
    updated_at: updatedAt
  };

  const nextChangelog =
    manualTarget && nextVersion <= 1
      ? [changeEntry]
      : [
          changeEntry,
          ...current.changelog.filter((item) => !manualTarget || item.version < nextVersion)
        ];

  const next: RuleConfig = {
    ...current,
    ...rulePatch,
    rule_version: nextVersion,
    last_updated: updatedAt,
    changelog: nextChangelog
  };

  const saved = await repo.saveRules(next);

  await repo.saveAuditLog(
    createAuditLog(managerId, "rules.updated", "rules/current", {
      version: saved.rule_version,
      fields: changedFields
    })
  );

  return saved;
}

export async function claimPenaltyReward(eventId: string, managerId: string): Promise<PenaltyEvent> {
  const repo = getGameRepository();
  const allOpen = await repo.listOpenPenaltyEventsAll();
  const found = allOpen.find((item) => item.id === eventId);

  if (!found) {
    throw new Error("Penalty event not found or already resolved.");
  }

  const updated: PenaltyEvent = {
    ...found,
    manager_reward_unlocked: false,
    claimed_by_manager: true
  };

  await repo.savePenaltyEvent(updated);

  await repo.saveAuditLog(
    createAuditLog(managerId, "penalty.reward_claimed", eventId, {
      reward_label: found.reward_label,
      reward_value: found.reward_value
    })
  );

  return updated;
}

export async function claimReward(userId: string, rewardId: string): Promise<RewardClaim> {
  const repo = getGameRepository();
  const [rewards, claims, score] = await Promise.all([
    repo.listRewards(),
    repo.listRewardClaims(userId),
    repo.getScore(userId)
  ]);

  const reward = rewards.find((item) => item.id === rewardId);
  if (!reward) {
    throw new Error("Reward not found.");
  }

  if (score.total_points < reward.required_points) {
    throw new Error("Reward is still locked.");
  }

  const existing = claims.find((claim) => claim.reward_id === rewardId);
  if (existing && existing.status === "claimed") {
    return existing;
  }

  const claim: RewardClaim = {
    id: existing?.id ?? createId("reward_claim"),
    user_id: userId,
    reward_id: rewardId,
    status: "claimed",
    claimed_at: nowISO(),
    manager_notified_at: existing?.manager_notified_at ?? null,
    created_at: existing?.created_at ?? nowISO()
  };

  return repo.saveRewardClaim(claim);
}

export async function createReward(
  managerId: string,
  payload: Pick<Reward, "title" | "description" | "required_points">
): Promise<Reward> {
  const repo = getGameRepository();

  const reward: Reward = {
    id: createId("reward"),
    title: payload.title,
    description: payload.description,
    required_points: payload.required_points,
    created_by: managerId,
    created_at: nowISO()
  };

  await repo.saveReward(reward);
  await repo.saveAuditLog(createAuditLog(managerId, "reward.created", reward.id, payload));
  return reward;
}

export async function updateReward(
  managerId: string,
  payload: Pick<Reward, "id" | "title" | "description" | "required_points">
): Promise<Reward> {
  const repo = getGameRepository();
  const existing = (await repo.listRewards()).find((reward) => reward.id === payload.id);
  if (!existing) {
    throw new Error("Reward not found.");
  }

  const next: Reward = {
    ...existing,
    title: payload.title,
    description: payload.description,
    required_points: payload.required_points
  };

  await repo.saveReward(next);
  await repo.saveAuditLog(
    createAuditLog(managerId, "reward.updated", next.id, {
      title: next.title,
      description: next.description,
      required_points: next.required_points
    })
  );
  return next;
}

export async function deleteReward(managerId: string, rewardId: string): Promise<void> {
  const repo = getGameRepository();
  const existing = (await repo.listRewards()).find((reward) => reward.id === rewardId);
  if (!existing) {
    throw new Error("Reward not found.");
  }

  await repo.deleteReward(rewardId);
  await repo.saveAuditLog(
    createAuditLog(managerId, "reward.deleted", rewardId, {
      title: existing.title,
      required_points: existing.required_points
    })
  );
}

export async function createAnnouncement(
  managerId: string,
  payload: {
    title?: string;
    message: string;
    image_url?: string;
  }
): Promise<Announcement> {
  const repo = getGameRepository();
  const message = payload.message.trim();
  if (!message) {
    throw new Error("Announcement message is required.");
  }

  const imageUrl = payload.image_url?.trim();
  const announcement: Announcement = {
    id: createId("announcement"),
    title: payload.title?.trim() || "Manager Announcement",
    message,
    created_by: managerId,
    created_at: nowISO(),
    ...(imageUrl ? { image_url: imageUrl } : {})
  };

  await repo.saveAnnouncement(announcement);
  await repo.saveAuditLog(
    createAuditLog(managerId, "announcement.created", announcement.id, {
      title: announcement.title
    })
  );

  return announcement;
}

export async function assignMission(
  managerId: string,
  payload: {
    target_user_id: string;
    title: string;
    objective: string;
    start_date?: string;
    due_date?: string;
    duration_days?: number;
    deadline?: string;
    bonus_points?: number;
  }
): Promise<Announcement> {
  const targetUserId = String(payload.target_user_id ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const objective = String(payload.objective ?? "").trim();
  const startDate = toISODateOnly(String(payload.start_date ?? "").trim());
  const dueDateFromInput = toISODateOnly(String(payload.due_date ?? "").trim());
  const legacyDeadline = toISODateOnly(String(payload.deadline ?? "").trim());
  const dueDate = dueDateFromInput || legacyDeadline;
  const durationDaysRaw = Number(payload.duration_days ?? 0);
  const computedDuration = Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
    ? Math.max(1, Math.round(durationDaysRaw))
    : computeMissionDuration(startDate || toISODate(), dueDate);
  const bonusPointsRaw = Number(payload.bonus_points ?? 0);
  const bonusPoints = Number.isFinite(bonusPointsRaw) ? Math.max(0, Math.round(bonusPointsRaw)) : 0;

  if (!targetUserId) {
    throw new Error("Target user is required.");
  }
  if (!title) {
    throw new Error("Mission title is required.");
  }
  if (!objective) {
    throw new Error("Mission objective is required.");
  }
  if (startDate && dueDate && dueDate < startDate) {
    throw new Error("Due date must be the same as or after start date.");
  }

  const repo = getGameRepository();
  const announcement = await createAnnouncement(managerId, {
    title,
    message: encodeMissionAnnouncement({
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: computedDuration,
      deadline: dueDate,
      bonus_points: bonusPoints
    })
  });

  await repo.saveAuditLog(
    createAuditLog(managerId, "mission.assigned", announcement.id, {
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: computedDuration,
      bonus_points: bonusPoints
    })
  );

  return announcement;
}

export async function updateMission(
  managerId: string,
  payload: {
    mission_announcement_id: string;
    target_user_id: string;
    title: string;
    objective: string;
    start_date?: string;
    due_date?: string;
    duration_days?: number;
    bonus_points?: number;
  }
): Promise<Announcement> {
  const repo = getGameRepository();
  const missionAnnouncementId = String(payload.mission_announcement_id ?? "").trim();
  if (!missionAnnouncementId) {
    throw new Error("Mission ID is required.");
  }

  const found = await repo.getAnnouncement(missionAnnouncementId);
  if (!found) {
    throw new Error("Mission not found.");
  }
  if (!parseMissionAnnouncement(found.message ?? "")) {
    throw new Error("This announcement is not a mission.");
  }

  const targetUserId = String(payload.target_user_id ?? "").trim();
  const title = String(payload.title ?? "").trim();
  const objective = String(payload.objective ?? "").trim();
  const startDate = toISODateOnly(String(payload.start_date ?? "").trim());
  const dueDate = toISODateOnly(String(payload.due_date ?? "").trim());
  const durationDaysRaw = Number(payload.duration_days ?? 0);
  const durationDays = Number.isFinite(durationDaysRaw) && durationDaysRaw > 0
    ? Math.max(1, Math.round(durationDaysRaw))
    : computeMissionDuration(startDate || toISODate(), dueDate);
  const bonusPointsRaw = Number(payload.bonus_points ?? 0);
  const bonusPoints = Number.isFinite(bonusPointsRaw) ? Math.max(0, Math.round(bonusPointsRaw)) : 0;

  if (!targetUserId) throw new Error("Target user is required.");
  if (!title) throw new Error("Mission title is required.");
  if (!objective) throw new Error("Mission objective is required.");
  if (startDate && dueDate && dueDate < startDate) {
    throw new Error("Due date must be the same as or after start date.");
  }

  const next: Announcement = {
    ...found,
    title,
    message: encodeMissionAnnouncement({
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: durationDays,
      deadline: dueDate,
      bonus_points: bonusPoints
    }),
    created_at: nowISO()
  };

  await repo.saveAnnouncement(next);
  await repo.saveAuditLog(
    createAuditLog(managerId, "mission.updated", missionAnnouncementId, {
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: durationDays,
      bonus_points: bonusPoints
    })
  );

  return next;
}

export async function deleteMission(
  managerId: string,
  payload: { mission_announcement_id: string }
): Promise<void> {
  const repo = getGameRepository();
  const missionAnnouncementId = String(payload.mission_announcement_id ?? "").trim();
  if (!missionAnnouncementId) {
    throw new Error("Mission ID is required.");
  }

  const found = await repo.getAnnouncement(missionAnnouncementId);
  if (!found) {
    throw new Error("Mission not found.");
  }
  if (!parseMissionAnnouncement(found.message ?? "")) {
    throw new Error("This announcement is not a mission.");
  }

  await repo.deleteAnnouncement(missionAnnouncementId);
  await repo.saveAuditLog(
    createAuditLog(managerId, "mission.deleted", missionAnnouncementId, {
      title: found.title
    })
  );
}

export async function acknowledgeRuleVersion(userId: string): Promise<UserProfile> {
  const repo = getGameRepository();
  const rules = await repo.getRules();
  return repo.updateUser(userId, { last_seen_rule_version: rules.rule_version });
}

export async function getDashboard(uid: string): Promise<DashboardBundle> {
  const repo = getGameRepository();
  const bundle = await repo.getDashboardBundle(uid);
  const isKo = bundle.user.locale === "ko";
  const threshold = bundle.user.last_seen_manager_update_at ?? bundle.user.created_at;
  const notificationsThreshold = bundle.user.last_seen_notification_at ?? bundle.user.created_at;
  const submissionIds = new Set(bundle.submissions.map((submission) => submission.id));
  const [logs, announcements] = await Promise.all([repo.listAuditLogs(40), repo.listAnnouncements(20)]);

  const managerUpdates: ManagerUpdateNotification[] = [];
  const managerUpdateFeed: ManagerUpdateNotification[] = [];
  const latestRuleChange = bundle.rules.changelog[0] ?? null;
  const latestRuleSummary = summarizeRuleSections(latestRuleChange?.sections ?? [], bundle.user.locale);
  const ruleUpdateItem: ManagerUpdateNotification = {
    id: `rule-${bundle.rules.rule_version}`,
    kind: "rule_update",
    title: latestRuleChange?.title?.trim()
      ? latestRuleChange.title
      : isKo
        ? `룰 v${bundle.rules.rule_version} 업데이트`
        : `Rules updated to v${bundle.rules.rule_version}`,
    message: latestRuleChange?.description?.trim()
      ? latestRuleChange.description
      : isKo
        ? `${latestRuleSummary} Rules 탭에서 변경 내용을 확인하세요.`
        : `${latestRuleSummary} Open Rules tab to review details.`,
    created_at: bundle.rules.last_updated,
    deep_link: "/app/rules"
  };

  managerUpdateFeed.push(ruleUpdateItem);

  if (bundle.rules.last_updated > threshold) {
    managerUpdates.push(ruleUpdateItem);
  }

  for (const log of logs) {
    if (log.action === "submission.reviewed" && submissionIds.has(log.target_id)) {
      const approved = Boolean(log.details.approved);
      const points = Number(log.details.points ?? 0);
      const bonusPoints = Number(log.details.bonus_points ?? 0);
      const bonusMessage = String(log.details.bonus_message ?? "").trim();
      const note = String(log.details.note ?? "").trim();
      let title = approved
        ? isKo
          ? "매니저가 체크인을 검토했어요"
          : "Manager reviewed your check-in"
        : isKo
          ? "매니저가 무점수 검토를 남겼어요"
          : "Manager left a no-points review";
      let fallbackMessage = approved
        ? isKo
          ? `${points > 0 ? `+${points}` : points} pts가 점수에 반영됐어요.`
          : `+${points} pts reflected in your score.`
        : isKo
          ? "Questions/Record에서 매니저 코멘트를 확인하세요."
          : "Check manager comment in Questions/Record.";

      if (points < 0) {
        title = isKo ? "매니저가 감점 점수를 반영했어요" : "Manager applied a point deduction";
        fallbackMessage = isKo ? `${points} pts가 점수에 반영됐어요.` : `${points} pts reflected in your score.`;
      } else if (points === 0 && approved) {
        title = isKo ? "매니저가 체크인을 검토했어요" : "Manager reviewed your check-in";
        fallbackMessage = isKo ? "이번 기록은 0 pts로 검토되었어요." : "0 pts reviewed for this entry.";
      } else if (points > 0 && !approved) {
        title = isKo ? "매니저가 점수를 업데이트했어요" : "Manager updated your score";
        fallbackMessage = isKo ? `+${points} pts가 점수에 반영됐어요.` : `+${points} pts reflected in your score.`;
      }
      if (bonusPoints > 0) {
        title = isKo ? "보너스 포인트 도착!" : "Bonus points surprise!";
        fallbackMessage = isKo
          ? `깜짝 선물 +${bonusPoints} 보너스 포인트가 지급됐어요.`
          : `Gift unlocked: +${bonusPoints} bonus pts.`;
      }

      const updateItem: ManagerUpdateNotification = {
        id: log.id,
        kind: "submission_review",
        title,
        message: note.length > 0 ? note : fallbackMessage,
        created_at: log.created_at,
        review_points: points,
        bonus_points: bonusPoints > 0 ? bonusPoints : 0,
        bonus_message: bonusMessage,
        deep_link: `/app/record?focus=${log.target_id}#submission-${log.target_id}`
      };
      managerUpdateFeed.push(updateItem);
      if (log.created_at > threshold) {
        managerUpdates.push(updateItem);
      }
    }

    if (log.action === "login.inactivity_penalty_applied" && String(log.details.user_id ?? "") === bundle.user.id) {
      const missedDays = Math.max(0, toSafeInt(log.details.missed_days));
      const pointsApplied = toSafeInt(log.details.points_applied);
      const note = String(log.details.note ?? "").trim();
      const loginDate = extractISODate(log.details.login_date) ?? "";
      const summaryMessage = isKo
        ? `${missedDays}일 미로그인으로 ${pointsApplied} pts가 반영됐습니다.${loginDate ? ` (${loginDate})` : ""}`
        : `${pointsApplied} pts applied for ${missedDays} inactive day(s).${loginDate ? ` (${loginDate})` : ""}`;
      const updateItem: ManagerUpdateNotification = {
        id: log.id,
        kind: "submission_review",
        title: isKo ? "미로그인 페널티가 반영됐어요" : "Inactive login penalty applied",
        message: note.length > 0 ? `${note} • ${summaryMessage}` : summaryMessage,
        created_at: log.created_at,
        review_points: pointsApplied,
        deep_link: "/app/score"
      };
      managerUpdateFeed.push(updateItem);
      if (log.created_at > threshold) {
        managerUpdates.push(updateItem);
      }
    }

    if (log.action === "reward.created" || log.action === "reward.updated" || log.action === "reward.deleted") {
      const updateItem: ManagerUpdateNotification = {
        id: log.id,
        kind: "reward_update",
        title: isKo ? "리워드 목록이 변경됐어요" : "Reward catalog updated",
        message: isKo ? "매니저가 리워드 설정을 수정했어요. Rewards 탭에서 확인하세요." : "Manager changed reward settings. Check Rewards tab.",
        created_at: log.created_at
      };
      managerUpdateFeed.push(updateItem);
      if (log.created_at > threshold) {
        managerUpdates.push(updateItem);
      }
    }
  }

  const sortedManagerUpdates = managerUpdates
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 8);
  const sortedManagerUpdateFeed = managerUpdateFeed
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 16);

  const managerUpdateNotifications: AppNotification[] = sortedManagerUpdateFeed.map((item) => ({
    id: `mu-${item.id}`,
    kind: "manager_update",
    title: item.title,
    message: item.message,
    created_at: item.created_at,
    is_new: item.created_at > notificationsThreshold,
    source_id: item.id,
    review_points: item.review_points,
    bonus_points: item.bonus_points,
    bonus_message: item.bonus_message,
    deep_link:
      item.kind === "rule_update"
        ? "/app/rules"
        : item.kind === "reward_update"
          ? "/app/rewards"
          : item.deep_link ?? "/app/record",
    category:
      item.kind === "rule_update"
        ? "rules"
        : item.kind === "submission_review"
          ? "review_points"
          : "manager_message",
    cta_label:
      item.kind === "rule_update"
        ? "Check updated rules"
        : item.kind === "submission_review"
          ? item.deep_link === "/app/score"
            ? "Open score"
            : "Open review"
          : "Open update",
    cta_link:
      item.kind === "rule_update"
        ? "/app/rules"
        : item.kind === "reward_update"
          ? "/app/rewards"
          : item.deep_link ?? "/app/record"
  }));

  const announcementNotifications: AppNotification[] = announcements.flatMap((item) => {
    const parsedMission = parseMissionAnnouncement(item.message ?? "");
    if (parsedMission && !isMissionForUser(parsedMission, bundle.user.id)) {
      return [];
    }

    const missionTitle = parsedMission?.title?.trim() ?? "";
    const missionObjective = parsedMission?.objective?.trim() ?? "";
    const missionStartDate = parsedMission?.start_date?.trim() ?? "";
    const missionDueDate = parsedMission ? getMissionDueDate(parsedMission) : "";
    const missionDurationDays = parsedMission?.duration_days ?? 0;
    const missionBonus = parsedMission?.bonus_points ?? 0;

    const hasMissionPayload = Boolean(parsedMission);
    const fallbackTitle = item.title?.trim() || (isKo ? "Manager로부터 메시지가 도착했습니다" : "A message arrived from Manager");
    const title = hasMissionPayload ? missionTitle || fallbackTitle : fallbackTitle;
    const missionMetaChunks = [
      missionStartDate ? `Start: ${missionStartDate}` : "",
      missionDueDate ? `Due: ${missionDueDate}` : "",
      missionBonus > 0 ? `Bonus: +${missionBonus} pts` : ""
    ].filter(Boolean);
    const message = hasMissionPayload
      ? [missionObjective, ...missionMetaChunks].filter(Boolean).join(" • ")
      : item.message;
    const lowerTitle = title.toLowerCase();
    const lowerMessage = String(message ?? "").toLowerCase();
    const isRulesNotice = !hasMissionPayload
      && (lowerTitle.includes("rule") || lowerTitle.includes("penalty") || lowerMessage.includes("rule version") || lowerMessage.includes("penalty rule"));

    return [
      {
        id: `announce-${item.id}`,
        kind: "announcement" as const,
        title,
        message,
        created_at: item.created_at,
        is_new: item.created_at > notificationsThreshold,
        image_url: item.image_url,
        source_id: item.id,
        deep_link: hasMissionPayload ? "/app/mission" : isRulesNotice ? "/app/rules" : undefined,
        category: hasMissionPayload ? "mission" : isRulesNotice ? "rules" : "manager_message",
        cta_label: hasMissionPayload ? "Open mission" : isRulesNotice ? "Check updated rules" : "View details",
        cta_link: hasMissionPayload ? "/app/mission" : isRulesNotice ? "/app/rules" : undefined,
        mission_start_date: hasMissionPayload ? missionStartDate : undefined,
        mission_due_date: hasMissionPayload ? missionDueDate : undefined,
        mission_duration_days: hasMissionPayload && missionDurationDays > 0 ? missionDurationDays : undefined,
        mission_bonus_points: hasMissionPayload ? missionBonus : undefined
      }
    ];
  });

  const notifications = [...managerUpdateNotifications, ...announcementNotifications]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 20);

  return {
    ...bundle,
    managerUpdates: sortedManagerUpdates,
    notifications,
    unread_notification_count: notifications.filter((item) => item.is_new).length
  };
}

export async function getManagerOverview(managerId: string) {
  await rebuildAllUserScores();
  const repo = getGameRepository();
  const [managerUser, users, pendingSubmissions, rules, rewards, openPenaltyEvents, auditLogs, rewardClaimAlerts, announcements] = await Promise.all([
    repo.getUser(managerId),
    repo.listUsers(),
    repo.listPendingSubmissions(),
    repo.getRules(),
    repo.listRewards(),
    repo.listOpenPenaltyEventsAll(),
    repo.listAuditLogs(2000),
    repo.listPendingRewardClaimAlerts(20),
    repo.listAnnouncements(12)
  ]);
  const isKo = managerUser?.locale === "ko";
  const userMap = new Map(users.map((item) => [item.id, item]));

  const claimAlerts = await Promise.all(
    rewardClaimAlerts.map(async (claim) => {
      const [user] = await Promise.all([repo.getUser(claim.user_id)]);
      const reward = rewards.find((item) => item.id === claim.reward_id) ?? null;
      return {
        claim,
        userDisplay: (user?.name ?? "").trim() || user?.login_id || claim.user_id,
        rewardTitle: reward?.title ?? claim.reward_id,
        rewardPoints: reward?.required_points ?? 0
      };
    })
  );

  const inactivityDetectedByTarget = new Map<string, (typeof auditLogs)[number]>();
  const resolvedInactivityTargets = new Set<string>();

  for (const log of auditLogs) {
    if (log.action === "login.inactivity_penalty_detected") {
      const prev = inactivityDetectedByTarget.get(log.target_id);
      if (!prev || log.created_at > prev.created_at) {
        inactivityDetectedByTarget.set(log.target_id, log);
      }
      continue;
    }
    if (log.action === "login.inactivity_penalty_applied" || log.action === "login.inactivity_penalty_skipped") {
      resolvedInactivityTargets.add(log.target_id);
    }
  }

  const inactivityPenaltyAlerts = [...inactivityDetectedByTarget.values()]
    .filter((log) => !resolvedInactivityTargets.has(log.target_id))
    .map((log) => {
      const userId = String(log.details.user_id ?? "");
      const targetUser = userMap.get(userId);
      const userDisplay = (targetUser?.name ?? "").trim() || targetUser?.login_id || userId;
      const missedDays = Math.max(0, toSafeInt(log.details.missed_days));
      const suggestedPoints = toSafeInt(log.details.suggested_points);
      const pointsPerDay = toSafeInt(log.details.points_per_day);
      const loginDate = String(log.details.login_date ?? "").trim();
      const baselineDate = String(log.details.baseline_date ?? "").trim();

      return {
        id: log.id,
        targetId: log.target_id,
        userId,
        userDisplay,
        missedDays,
        pointsPerDay,
        suggestedPoints,
        loginDate,
        baselineDate,
        createdAt: log.created_at
      };
    })
    .filter((item) => item.userId.length > 0 && item.missedDays > 0)
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

  const notificationsThreshold = managerUser?.last_seen_notification_at ?? managerUser?.created_at ?? "";

  const checkinNotifications: AppNotification[] = pendingSubmissions.map((submission) => {
    const user = userMap.get(submission.user_id);
    const displayName = (user?.name ?? "").trim() || user?.login_id || submission.user_id;
    return {
      id: `checkin-${submission.id}`,
      kind: "checkin_arrived",
      title: isKo ? "새로운 Daily Check-in이 도착했습니다" : "A new daily check-in has arrived",
      message: `${displayName} submitted ${submission.date}`,
      created_at: submission.created_at,
      is_new: notificationsThreshold ? submission.created_at > notificationsThreshold : true,
      source_id: submission.id,
      deep_link: `/manager?manager_tab=review&focus_submission=${submission.id}#submission-${submission.id}`,
      category: "checkin",
      cta_label: isKo ? "리뷰 열기" : "Open review",
      cta_link: `/manager?manager_tab=review&focus_submission=${submission.id}#submission-${submission.id}`
    };
  });

  const rewardClaimNotifications: AppNotification[] = claimAlerts.map((item) => ({
    id: `claim-${item.claim.id}`,
    kind: "reward_claim_request",
    title: isKo ? "보상 Claim 요청이 도착했습니다" : "A reward claim request has arrived",
    message: `${item.userDisplay} · ${item.rewardTitle} (${item.rewardPoints} pts)`,
    created_at: item.claim.claimed_at ?? item.claim.created_at,
    is_new: notificationsThreshold
      ? (item.claim.claimed_at ?? item.claim.created_at) > notificationsThreshold
      : true,
    source_id: item.claim.id,
    deep_link: "/manager?manager_tab=inbox#reward-claim-inbox",
    category: "reward_claim",
    cta_label: isKo ? "요청 확인" : "Open claim",
    cta_link: "/manager?manager_tab=inbox#reward-claim-inbox"
  }));

  const announcementNotifications: AppNotification[] = announcements.map((item) => {
    const parsedMission = parseMissionAnnouncement(item.message ?? "");
    if (parsedMission) {
      return {
        id: `announce-self-${item.id}`,
        kind: "announcement" as const,
        title: isKo ? "할당된 미션 공지" : "Assigned mission notice",
        message: `${parsedMission.title} • ${parsedMission.objective}`,
        created_at: item.created_at,
        is_new: notificationsThreshold ? item.created_at > notificationsThreshold : false,
        source_id: item.id,
        deep_link: "/manager?manager_tab=inbox#mission-assignment",
        category: "mission",
        cta_label: isKo ? "미션 편집" : "Edit mission",
        cta_link: "/manager?manager_tab=inbox#mission-assignment"
      };
    }
    return {
      id: `announce-self-${item.id}`,
      kind: "announcement" as const,
      title: isKo ? "최근 공지" : "Recent announcement",
      message: item.message,
      created_at: item.created_at,
      is_new: notificationsThreshold ? item.created_at > notificationsThreshold : false,
      image_url: item.image_url,
      source_id: item.id,
      category: "manager_message"
    };
  });

  const inactivityNotifications: AppNotification[] = inactivityPenaltyAlerts.map((item) => ({
    id: `inactive-${item.targetId}`,
    kind: "announcement",
    title: isKo
      ? `${item.userDisplay} 사용자가 ${item.missedDays}일 미로그인 상태입니다`
      : `${item.userDisplay} has ${item.missedDays} inactive day(s)`,
    message: isKo
      ? `권장 페널티 ${item.suggestedPoints} pts (${item.pointsPerDay}/day). 점수 수정 후 적용할 수 있습니다.`
      : `Suggested penalty ${item.suggestedPoints} pts (${item.pointsPerDay}/day). You can edit points before applying.`,
    created_at: item.createdAt,
    is_new: notificationsThreshold ? item.createdAt > notificationsThreshold : true,
    source_id: item.targetId,
    deep_link: "/manager?manager_tab=inbox#inactivity-penalty-inbox",
    category: "manager_message",
    cta_label: isKo ? "페널티 검토" : "Review penalty",
    cta_link: "/manager?manager_tab=inbox#inactivity-penalty-inbox"
  }));

  const notifications = [...checkinNotifications, ...rewardClaimNotifications, ...inactivityNotifications, ...announcementNotifications]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 20);

  return {
    pendingSubmissions,
    rules: rules ?? DEFAULT_RULES,
    rewards,
    openPenaltyEvents,
    auditLogs,
    rewardClaimAlerts: claimAlerts,
    inactivityPenaltyAlerts,
    announcements,
    notifications,
    unreadNotificationCount: notifications.filter((item) => item.is_new).length
  };
}

export async function markRewardClaimAlertsSeen(claimIds: string[]): Promise<void> {
  if (claimIds.length === 0) return;
  const repo = getGameRepository();
  await repo.markRewardClaimsNotified(claimIds, nowISO());
}
