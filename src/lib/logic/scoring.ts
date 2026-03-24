import { NextRewardState, PenaltyComputation, PenaltyEvent, Reward } from "@/lib/types";
import { daysBetween, toISODate } from "@/lib/utils";

export function computeStreak(
  previousStreak: number,
  previousApprovedDateISO: string | undefined,
  newApprovedDateISO: string
): number {
  if (!previousApprovedDateISO) return 1;
  const diff = daysBetween(previousApprovedDateISO, newApprovedDateISO);
  if (diff <= 0) return previousStreak;
  if (diff === 1) return previousStreak + 1;
  return 1;
}

export function computeMultiplier(
  streak: number,
  triggerDays: number,
  multiplierValue: number
): { multiplier_active: boolean; multiplier_value: number } {
  if (streak >= triggerDays) {
    return { multiplier_active: true, multiplier_value: multiplierValue };
  }
  return { multiplier_active: false, multiplier_value: 1 };
}

export function computePenaltyState(
  totalPoints: number,
  penaltyThresholds: number[],
  openPenaltyEvents: PenaltyEvent[]
): PenaltyComputation {
  if (totalPoints >= 0) {
    return {
      penalty_active: false,
      negative_balance: 0,
      crossed_thresholds: [],
      recovered: openPenaltyEvents.length > 0
    };
  }

  const activeThresholds = new Set(openPenaltyEvents.map((event) => event.threshold));
  const crossed = penaltyThresholds
    .filter((threshold) => totalPoints <= threshold && !activeThresholds.has(threshold))
    .sort((a, b) => b - a);

  return {
    penalty_active: true,
    negative_balance: Math.abs(totalPoints),
    crossed_thresholds: crossed,
    recovered: false
  };
}

export function computeNextReward(totalPoints: number, rewards: Reward[]): NextRewardState {
  const sorted = [...rewards].sort((a, b) => a.required_points - b.required_points);
  const next = sorted.find((reward) => reward.required_points > totalPoints) ?? null;

  if (!next) {
    return {
      reward: null,
      pointsRemaining: 0,
      progressPercent: 100
    };
  }

  const previousThreshold =
    [...sorted].reverse().find((reward) => reward.required_points <= totalPoints)?.required_points ?? 0;
  const segment = next.required_points - previousThreshold;
  const progressed = totalPoints - previousThreshold;

  return {
    reward: next,
    pointsRemaining: Math.max(0, next.required_points - totalPoints),
    progressPercent: Math.max(0, Math.min(100, Math.round((progressed / segment) * 100)))
  };
}

export function todayISO(): string {
  return toISODate(new Date());
}
