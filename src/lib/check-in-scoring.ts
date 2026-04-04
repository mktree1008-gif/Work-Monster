import type { DailyCheckInDraft } from "@/lib/check-in-model";

export type CheckInScoreBreakdown = {
  total: number;
  baseScore: number;
  calculatedScore: number;
  planAdjustment: number;
  productivityAdjustment: number;
  wellnessAdjustment: number;
  reflectionBonus: number;
  blockerPenalty: number;
  label: "Excellent day" | "Strong day" | "Meaningful progress" | "Tough but honest day" | "Reset and recover";
};

const PLAN_Q1_SCORE: Record<string, number> = {
  not_much: 0.32,
  some: 0.58,
  most: 0.82,
  almost_all: 1
};

const PLAN_Q2_SCORE: Record<string, number> = {
  yes: 1,
  partly: 0.72,
  no: 0.34,
  no_main_task: 0.62
};

const PLAN_Q3_SCORE: Record<string, number> = {
  very_off: 0.32,
  a_bit_off: 0.56,
  mostly_on: 0.82,
  fully_on: 1
};

const PRODUCTIVITY_Q4_SCORE: Record<string, number> = {
  very_low: 0.3,
  distracted: 0.55,
  okay: 0.78,
  strong: 1
};

const PRODUCTIVITY_Q5_SCORE: Record<string, number> = {
  poor: 0.34,
  okay: 0.6,
  good: 0.82,
  great: 1
};

const WELLNESS_Q7_SCORE: Record<string, number> = {
  poor: 0.34,
  okay: 0.6,
  good: 0.82,
  great: 1
};

const WELLNESS_Q8_SCORE: Record<string, number> = {
  none: 0.24,
  light: 0.54,
  moderate: 0.8,
  strong: 1
};

const WELLNESS_Q9_SCORE: Record<string, number> = {
  far_above: 0.28,
  slightly_above: 0.56,
  close: 0.82,
  on_target: 1
};

const BLOCKER_PENALTY: Record<string, number> = {
  low_energy: 0.6,
  too_many_tasks: 1.1,
  distractions: 1.6,
  stress_mood: 2
};

function toWeight(value: string, table: Record<string, number>): number {
  return table[value] ?? 0;
}

function round(value: number): number {
  return Math.round(value);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeSelfScore(sliderValue: number): number {
  const safe = Number.isFinite(sliderValue) ? sliderValue : 5;
  const clamped = Math.max(1, Math.min(10, safe));
  return clamped * 10;
}

function adjustmentFromAverage(average: number, min: number, max: number): number {
  const safe = clamp(average, 0, 1);
  return roundOne(min + safe * (max - min));
}

function reflectionCompleteness(draft: DailyCheckInDraft): number {
  const hasWorkNote = draft.work_note.trim().length >= 8;
  const hasManagerMessage = draft.manager_message.trim().length >= 8;
  const hasAttachment = draft.evidence_files.length + draft.evidence_links.length > 0;

  let points = 0;
  if (hasWorkNote) points += 2;
  if (hasManagerMessage) points += 2;
  if (hasAttachment) points += 1;
  return points;
}

export function getCheckInScoreLabel(total: number): CheckInScoreBreakdown["label"] {
  if (total >= 90) return "Excellent day";
  if (total >= 75) return "Strong day";
  if (total >= 60) return "Meaningful progress";
  if (total >= 45) return "Tough but honest day";
  return "Reset and recover";
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

  const baseScore = round(normalizeSelfScore(draft.q10));
  const planAdjustment = adjustmentFromAverage(planAverage, -2, 4);
  const productivityAdjustment = adjustmentFromAverage(productivityAverage, -2, 4);
  const wellnessAdjustment = adjustmentFromAverage(wellnessAverage, -1, 3);
  const reflectionBonus = roundOne((reflectionCompleteness(draft) / 5) * 3);

  const blockerPenaltyBase = draft.q6.length > 0
    ? Math.max(...draft.q6.map((item) => BLOCKER_PENALTY[item] ?? 0))
    : 0;
  const blockerPenalty = roundOne(clamp(blockerPenaltyBase, 0, 2));

  const rawCalculated = baseScore + planAdjustment + productivityAdjustment + wellnessAdjustment + reflectionBonus - blockerPenalty;
  const calculatedScore = clamp(round(rawCalculated), 0, 100);
  const total = clamp(Math.max(baseScore, calculatedScore), 0, 100);

  return {
    total,
    baseScore,
    calculatedScore,
    planAdjustment,
    productivityAdjustment,
    wellnessAdjustment,
    reflectionBonus,
    blockerPenalty,
    label: getCheckInScoreLabel(total)
  };
}
