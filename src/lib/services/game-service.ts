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

export async function submitDailyCheckIn(
  userId: string,
  draft: Omit<SubmissionDraft, "user_id">,
  meta?: CheckInClientMeta
) {
  const repo = getGameRepository();
  const submission = makeSubmissionFromDraft({ ...draft, user_id: userId }, resolveSubmissionDate(meta));
  await repo.saveSubmission(submission);

  return submission;
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

  const reviewed: Submission = {
    ...submission,
    status: input.approved ? "approved" : "rejected",
    manager_note: input.note,
    points_awarded: input.approved ? input.points : 0,
    reviewed_at: nowISO()
  };

  await repo.saveSubmission(reviewed);

  if (input.approved) {
    const score = await repo.getScore(submission.user_id);
    const rules = await repo.getRules();

    const streak = computeStreak(score.current_streak, score.last_approved_at, submission.date);
    const multiplierState = computeMultiplier(
      streak,
      rules.multiplier_trigger_days,
      rules.multiplier_value
    );

    const multipliedPoints = Math.round(input.points * multiplierState.multiplier_value);
    const totalPoints = score.total_points + multipliedPoints;

    const nextScore: ScoreState = {
      ...score,
      total_points: totalPoints,
      lifetime_points: score.lifetime_points + Math.max(0, multipliedPoints),
      current_streak: streak,
      longest_streak: Math.max(score.longest_streak, streak),
      multiplier_active: multiplierState.multiplier_active,
      multiplier_value: multiplierState.multiplier_value,
      updated_at: nowISO(),
      last_approved_at: submission.date
    };

    await repo.saveScore(nextScore);
    await recalculateScore(submission.user_id);
  }

  await repo.saveAuditLog(
    createAuditLog(managerId, "submission.reviewed", reviewed.id, {
      approved: input.approved,
      points: reviewed.points_awarded,
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
  const { note, ...rulePatch } = payload;

  const changedFields = Object.keys(rulePatch);

  const next: RuleConfig = {
    ...current,
    ...rulePatch,
    rule_version: current.rule_version + 1,
    last_updated: nowISO(),
    changelog: [
      {
        version: current.rule_version + 1,
        title: note ?? "Manager updated the rules",
        description: note ?? "Rules have been adjusted.",
        sections: changedFields,
        updated_at: nowISO()
      },
      ...current.changelog
    ]
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

export async function acknowledgeRuleVersion(userId: string): Promise<UserProfile> {
  const repo = getGameRepository();
  const rules = await repo.getRules();
  return repo.updateUser(userId, { last_seen_rule_version: rules.rule_version });
}

export async function getDashboard(uid: string): Promise<DashboardBundle> {
  const repo = getGameRepository();
  const bundle = await repo.getDashboardBundle(uid);
  const threshold = bundle.user.last_seen_manager_update_at ?? bundle.user.created_at;
  const submissionIds = new Set(bundle.submissions.map((submission) => submission.id));
  const logs = await repo.listAuditLogs(40);

  const managerUpdates: ManagerUpdateNotification[] = [];

  if (bundle.rules.last_updated > threshold) {
    managerUpdates.push({
      id: `rule-${bundle.rules.rule_version}`,
      kind: "rule_update",
      title: `Rules updated to v${bundle.rules.rule_version}`,
      message: "Manager updated game rules. Open Rules tab to check details.",
      created_at: bundle.rules.last_updated
    });
  }

  for (const log of logs) {
    if (log.created_at <= threshold) continue;

    if (log.action === "submission.reviewed" && submissionIds.has(log.target_id)) {
      const approved = Boolean(log.details.approved);
      const points = Number(log.details.points ?? 0);
      const note = String(log.details.note ?? "").trim();
      managerUpdates.push({
        id: log.id,
        kind: "submission_review",
        title: approved ? "Manager reviewed your check-in" : "Manager left a no-points review",
        message: note.length > 0 ? note : approved ? `+${points} pts reflected in your score.` : "Check manager comment in Questions/Record.",
        created_at: log.created_at
      });
    }

    if (log.action === "reward.created" || log.action === "reward.updated" || log.action === "reward.deleted") {
      managerUpdates.push({
        id: log.id,
        kind: "reward_update",
        title: "Reward catalog updated",
        message: "Manager changed reward settings. Check Rewards tab.",
        created_at: log.created_at
      });
    }
  }

  return {
    ...bundle,
    managerUpdates: managerUpdates
      .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
      .slice(0, 4)
  };
}

export async function getManagerOverview() {
  const repo = getGameRepository();
  const [pendingSubmissions, rules, rewards, openPenaltyEvents, auditLogs, rewardClaimAlerts] = await Promise.all([
    repo.listPendingSubmissions(),
    repo.getRules(),
    repo.listRewards(),
    repo.listOpenPenaltyEventsAll(),
    repo.listAuditLogs(20),
    repo.listPendingRewardClaimAlerts(20)
  ]);

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

  return {
    pendingSubmissions,
    rules: rules ?? DEFAULT_RULES,
    rewards,
    openPenaltyEvents,
    auditLogs,
    rewardClaimAlerts: claimAlerts
  };
}

export async function markRewardClaimAlertsSeen(claimIds: string[]): Promise<void> {
  if (claimIds.length === 0) return;
  const repo = getGameRepository();
  await repo.markRewardClaimsNotified(claimIds, nowISO());
}
