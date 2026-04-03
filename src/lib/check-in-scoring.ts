import type { DailyCheckInDraft } from "@/lib/check-in-model";

export type CheckInScoreBreakdown = {
  total: number;
  planExecution: number;
  productivity: number;
  wellness: number;
  blockerPenalty: number;
  selfAdjustment: number;
};

const PLAN_Q1_SCORE: Record<string, number> = {
  not_much: 0.1,
  some: 0.45,
  most: 0.78,
  almost_all: 1
};

const PLAN_Q2_SCORE: Record<string, number> = {
  yes: 1,
  partly: 0.62,
  no: 0.18,
  no_main_task: 0.5
};

const PLAN_Q3_SCORE: Record<string, number> = {
  very_off: 0.1,
  a_bit_off: 0.4,
  mostly_on: 0.76,
  fully_on: 1
};

const PRODUCTIVITY_Q4_SCORE: Record<string, number> = {
  very_low: 0.08,
  distracted: 0.36,
  okay: 0.68,
  strong: 1
};

const PRODUCTIVITY_Q5_SCORE: Record<string, number> = {
  poor: 0.12,
  okay: 0.5,
  good: 0.76,
  great: 1
};

const WELLNESS_Q7_SCORE: Record<string, number> = {
  poor: 0.1,
  okay: 0.52,
  good: 0.78,
  great: 1
};

const WELLNESS_Q8_SCORE: Record<string, number> = {
  none: 0.05,
  light: 0.42,
  moderate: 0.73,
  strong: 1
};

const WELLNESS_Q9_SCORE: Record<string, number> = {
  far_above: 0.06,
  slightly_above: 0.35,
  close: 0.76,
  on_target: 1
};

const BLOCKER_PENALTY: Record<string, number> = {
  low_energy: 4,
  too_many_tasks: 6,
  distractions: 7,
  stress_mood: 8
};

function toWeight(value: string, table: Record<string, number>): number {
  return table[value] ?? 0;
}

function round(value: number): number {
  return Math.round(value);
}

export function calculateCheckInScore(draft: DailyCheckInDraft): CheckInScoreBreakdown {
  const planAverage = (
    toWeight(draft.q1, PLAN_Q1_SCORE)
    + toWeight(draft.q2, PLAN_Q2_SCORE)
    + toWeight(draft.q3, PLAN_Q3_SCORE)
  ) / 3;

  const productivityAverage = (
    toWeight(draft.q4, PRODUCTIVITY_Q4_SCORE)
    + toWeight(draft.q5, PRODUCTIVITY_Q5_SCORE)
  ) / 2;

  const wellnessAverage = (
    toWeight(draft.q7, WELLNESS_Q7_SCORE)
    + toWeight(draft.q8, WELLNESS_Q8_SCORE)
    + toWeight(draft.q9, WELLNESS_Q9_SCORE)
  ) / 3;

  const planExecution = round(planAverage * 40);
  const productivity = round(productivityAverage * 25);
  const wellness = round(wellnessAverage * 20);

  const blockerPenaltyBase = BLOCKER_PENALTY[draft.q6] ?? 0;
  const blockerPenalty = blockerPenaltyBase + (draft.blocker_other.trim().length > 0 ? 2 : 0);

  const sliderValue = Number.isFinite(draft.q10) ? draft.q10 : 5;
  const selfAdjustment = round((sliderValue - 5.5) * 1.5);

  const rawTotal = planExecution + productivity + wellness - blockerPenalty + selfAdjustment;
  const total = Math.max(0, Math.min(100, round(rawTotal)));

  return {
    total,
    planExecution,
    productivity,
    wellness,
    blockerPenalty,
    selfAdjustment
  };
}
