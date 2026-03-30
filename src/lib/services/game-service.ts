import { DEFAULT_RULES } from "@/lib/constants";
import { computeMultiplier, computePenaltyState, computeStreak } from "@/lib/logic/scoring";
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
};

type SubmitDailyCheckInResult = {
  submission: Submission;
  mode: "created" | "updated";
  submissionPointsAwarded: number;
};

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
    } catch (_error) {
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
  meta?: CheckInClientMeta
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

  const pendingSameDate = sameDateSubmissions.find((item) => item.status === "pending");
  if (pendingSameDate) {
    const updatedPending: Submission = {
      ...pendingSameDate,
      mood: draft.mood,
      feeling: draft.feeling,
      calories: draft.calories,
      productive: draft.productive,
      custom_answers: draft.custom_answers,
      task_list: draft.task_list,
      file_url: draft.file_url ?? ""
    };
    await repo.saveSubmission(updatedPending);
    const rules = await repo.getRules();
    const submissionPointsAwarded = await awardSubmissionBasePointsOnce({
      userId,
      submissionId: updatedPending.id,
      submissionDate: updatedPending.date,
      points: Math.round(rules.submission_points ?? 0)
    });
    return { submission: updatedPending, mode: "updated" as const, submissionPointsAwarded };
  }

  const submission = makeSubmissionFromDraft({ ...draft, user_id: userId }, targetDate);
  await repo.saveSubmission(submission);

  const rules = await repo.getRules();
  const submissionPointsAwarded = await awardSubmissionBasePointsOnce({
    userId,
    submissionId: submission.id,
    submissionDate: submission.date,
    points: Math.round(rules.submission_points ?? 0)
  });

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

  await repo.updateUser(userId, { last_login_point_date: loginDate });
  return { awarded: celebrateAward, points: loginPoints, date: loginDate };
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

  const patched: ScoreState = {
    ...score,
    penalty_active: penaltyState.penalty_active,
    negative_balance: penaltyState.negative_balance,
    updated_at: nowISO()
  };

  return repo.saveScore(patched);
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
  const changeDescription = note?.trim()
    ? note.trim()
    : manualTarget
      ? "Manager adjusted the rule version label."
      : "Rules have been adjusted.";
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
  const ruleUpdateItem: ManagerUpdateNotification = {
    id: `rule-${bundle.rules.rule_version}`,
    kind: "rule_update",
    title: isKo ? `룰 v${bundle.rules.rule_version} 업데이트` : `Rules updated to v${bundle.rules.rule_version}`,
    message: isKo
      ? "매니저가 게임 규칙을 업데이트했어요. Rules 탭에서 변경 내용을 확인하세요."
      : "Manager updated game rules. Open Rules tab to check details.",
    created_at: bundle.rules.last_updated
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
          : item.deep_link ?? "/app/record"
  }));

  const announcementNotifications: AppNotification[] = announcements.map((item) => ({
    id: `announce-${item.id}`,
    kind: "announcement",
    title: isKo ? "Manager로부터 메시지가 도착했습니다" : "A message arrived from Manager",
    message: item.message,
    created_at: item.created_at,
    is_new: item.created_at > notificationsThreshold,
    image_url: item.image_url,
    source_id: item.id
  }));

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
  const repo = getGameRepository();
  const [managerUser, pendingSubmissions, rules, rewards, openPenaltyEvents, auditLogs, rewardClaimAlerts, announcements] = await Promise.all([
    repo.getUser(managerId),
    repo.listPendingSubmissions(),
    repo.getRules(),
    repo.listRewards(),
    repo.listOpenPenaltyEventsAll(),
    repo.listAuditLogs(20),
    repo.listPendingRewardClaimAlerts(20),
    repo.listAnnouncements(12)
  ]);
  const isKo = managerUser?.locale === "ko";
  const userIds = [...new Set(pendingSubmissions.map((submission) => submission.user_id))];
  const userPairs = await Promise.all(userIds.map(async (id) => [id, await repo.getUser(id)] as const));
  const userMap = new Map(userPairs);

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
      deep_link: `/manager?manager_tab=review&focus_submission=${submission.id}#submission-${submission.id}`
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
    deep_link: "/manager?manager_tab=inbox#reward-claim-inbox"
  }));

  const announcementNotifications: AppNotification[] = announcements.map((item) => ({
    id: `announce-self-${item.id}`,
    kind: "announcement",
    title: isKo ? "최근 공지" : "Recent announcement",
    message: item.message,
    created_at: item.created_at,
    is_new: notificationsThreshold ? item.created_at > notificationsThreshold : false,
    image_url: item.image_url,
    source_id: item.id
  }));

  const notifications = [...checkinNotifications, ...rewardClaimNotifications, ...announcementNotifications]
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
    .slice(0, 20);

  return {
    pendingSubmissions,
    rules: rules ?? DEFAULT_RULES,
    rewards,
    openPenaltyEvents,
    auditLogs,
    rewardClaimAlerts: claimAlerts,
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
