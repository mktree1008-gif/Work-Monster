"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Brain,
  CalendarDays,
  Medal,
  Flame,
  Gauge,
  RefreshCcw,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import type { AppNotification, Locale, ScoreState, Submission } from "@/lib/types";

type RecordProductivityMode = "hub" | "performance" | "tasks" | "missions" | "insights";

type Props = {
  mode: RecordProductivityMode;
  locale: Locale;
  userId: string;
  score: ScoreState;
  submissions: Submission[];
  notifications: AppNotification[];
};

type Category = "work" | "mission" | "health" | "personal";

type AnalyticsTask = {
  id: string;
  date: string;
  user_id: string;
  title: string;
  category: Category;
  priority: "low" | "medium" | "high";
  duration: number;
  is_high_impact: boolean;
  is_completed: boolean;
  is_mission_linked: boolean;
  mission_id?: string;
  source: "plan" | "submission";
};

type DayMetric = {
  date: string;
  total: number;
  done: number;
  highTotal: number;
  highDone: number;
  missionTotal: number;
  missionDone: number;
  completionRate: number;
  highImpactRate: number;
  missionRate: number;
  consistencyRate: number;
  productivityScore: number;
  pointsDelta: number;
  focusMinutes: number;
  carryOverOut: number;
  carryOverIn: number;
  tasks: AnalyticsTask[];
};

type InsightCard = {
  id: string;
  title: string;
  body: string;
  level: "info" | "warning" | "success";
  ctaLabel?: string;
  ctaHref?: string;
};

type AnalyticsModel = {
  rangeDates: string[];
  dayMetrics: DayMetric[];
  latest7: DayMetric[];
  prev7: DayMetric[];
  unifiedScore: number;
  unifiedDelta: number;
  weeklyCompletion: number;
  weeklyCompletionDelta: number;
  highImpactRate: number;
  highImpactDoneCount: number;
  highImpactTotalCount: number;
  focusHours: number;
  carryOverRate: number;
  missionVelocity: number;
  streak: number;
  categoryShare: Record<Category, number>;
  categoryPerformance: Record<Category, number>;
  highImpactCount: number;
  normalCount: number;
  missionSuccessRate: number;
  missionAvgMinutes: number;
  missionMissed: number;
  missionContributionScore: number;
  topPercent: number;
  level: number;
  tier: "Bronze" | "Silver" | "Gold" | "Diamond";
  recentSubmissions: Submission[];
  insights: InsightCard[];
};

const STORAGE_PREFIX = "workmonster-plan-v2";
const LEGACY_STORAGE_PREFIX = "workmonster-plan";
const RANGE_DAYS = 56;
const CATEGORY_ORDER: Category[] = ["work", "mission", "health", "personal"];

function toLocalISODate(input = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(input);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function shiftISODate(baseISO: string, days: number): string {
  const d = new Date(`${baseISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\u3131-\uD79D\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function normalizePriority(value: unknown): "low" | "medium" | "high" {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return "medium";
}

function isMissionTitle(title: string): boolean {
  const t = normalizeText(title);
  return t.includes("mission") || t.includes("미션") || t.includes("objective");
}

function inferCategoryFromTitle(title: string, missionLinked: boolean): Category {
  if (missionLinked || isMissionTitle(title)) return "mission";
  const t = normalizeText(title);
  if (
    t.includes("workout") ||
    t.includes("run") ||
    t.includes("sleep") ||
    t.includes("health") ||
    t.includes("walk") ||
    t.includes("stretch") ||
    t.includes("운동") ||
    t.includes("수면") ||
    t.includes("건강")
  ) {
    return "health";
  }
  if (
    t.includes("report") ||
    t.includes("client") ||
    t.includes("meeting") ||
    t.includes("project") ||
    t.includes("review") ||
    t.includes("업무") ||
    t.includes("기획")
  ) {
    return "work";
  }
  return "personal";
}

function mapPlanCategory(rawCategory: string, missionLinked: boolean, title: string): Category {
  const raw = rawCategory.toLowerCase();
  if (missionLinked || raw === "mission") return "mission";
  if (raw === "health") return "health";
  if (raw === "work" || raw === "study" || raw === "admin") return "work";
  if (raw === "personal") return "personal";
  return inferCategoryFromTitle(title, missionLinked);
}

function parseFocusMinutes(raw: string): number {
  const text = raw.trim().toLowerCase();
  if (!text) return 0;

  const hourMinute = text.match(/(\d+(?:\.\d+)?)\s*h(?:our|r|rs)?\s*(\d+)?\s*m?/i);
  if (hourMinute) {
    const hours = safeNumber(hourMinute[1], 0);
    const minutes = safeNumber(hourMinute[2], 0);
    return Math.max(0, Math.round(hours * 60 + minutes));
  }

  const hoursOnly = text.match(/(\d+(?:\.\d+)?)\s*h(?:our|r|rs)?/i);
  if (hoursOnly) {
    return Math.max(0, Math.round(safeNumber(hoursOnly[1], 0) * 60));
  }

  const minsOnly = text.match(/(\d+)\s*m(?:in|ins|inute|inutes)?/i);
  if (minsOnly) {
    return Math.max(0, Math.round(safeNumber(minsOnly[1], 0)));
  }

  const plain = text.match(/\d+/);
  if (plain) {
    const value = safeNumber(plain[0], 0);
    if (value <= 12) return Math.round(value * 60);
    return Math.round(value);
  }

  return 0;
}

function scoreTier(totalPoints: number): "Bronze" | "Silver" | "Gold" | "Diamond" {
  if (totalPoints >= 12_000) return "Diamond";
  if (totalPoints >= 6_000) return "Gold";
  if (totalPoints >= 2_000) return "Silver";
  return "Bronze";
}

function scoreLevel(totalPoints: number): number {
  return Math.max(1, Math.floor(totalPoints / 2_500) + 1);
}

function percent(value: number, total: number): number {
  if (total <= 0) return 0;
  return clampPercent((value / total) * 100);
}

function storageKey(userId: string, dateISO: string): string {
  return `${STORAGE_PREFIX}-${userId}-${dateISO}`;
}

function legacyStorageKey(dateISO: string): string {
  return `${LEGACY_STORAGE_PREFIX}-${dateISO}`;
}

function parsePlanTaskArray(raw: string | null, userId: string, dateISO: string): AnalyticsTask[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const tasks: AnalyticsTask[] = [];
    for (const item of parsed) {
      const source = item as Record<string, unknown>;
      const title = String(source.title ?? source.text ?? "").trim();
      if (!title) continue;

      const missionLinked = Boolean(source.is_mission_linked ?? source.linkedToMission ?? source.missionLinked);
      const priority = normalizePriority(source.priority);
      const isHighImpact = Boolean(source.is_high_impact ?? (priority === "high" || missionLinked));
      const durationRaw = source.duration ?? source.estimatedMinutes ?? 30;
      const duration = Math.max(5, Math.round(safeNumber(durationRaw, 30)));
      const category = mapPlanCategory(String(source.category ?? "custom"), missionLinked, title);

      tasks.push({
        id: String(source.id ?? `${dateISO}-${title}`),
        date: dateISO,
        user_id: String(source.user_id ?? userId),
        title,
        category,
        priority,
        duration,
        is_high_impact: isHighImpact,
        is_completed: Boolean(source.is_completed ?? source.completed),
        is_mission_linked: missionLinked,
        mission_id: typeof source.mission_id === "string" ? source.mission_id : undefined,
        source: "plan"
      });
    }
    return tasks;
  } catch {
    return [];
  }
}

function buildFallbackTasksByDate(submissions: Submission[]): Map<string, AnalyticsTask[]> {
  const byDate = new Map<string, AnalyticsTask[]>();

  for (const submission of submissions) {
    const missionText = String(submission.custom_answers.mission ?? "").trim();
    const missionCompletedRaw = String(submission.custom_answers.mission_completed ?? "").toLowerCase();
    const missionCompleted = missionCompletedRaw === "yes" || missionCompletedRaw === "true" || missionCompletedRaw === "completed";

    const generatedTasks: AnalyticsTask[] = submission.task_list.map((title, index) => {
      const trimmed = title.trim();
      const missionLinked = missionText.length > 0 && normalizeText(trimmed).includes(normalizeText(missionText));
      const category = inferCategoryFromTitle(trimmed, missionLinked);
      return {
        id: `${submission.id}-${index}`,
        date: submission.date,
        user_id: submission.user_id,
        title: trimmed,
        category,
        priority: index < 2 ? "high" : index < 4 ? "medium" : "low",
        duration: 30,
        is_high_impact: index < 2 || missionLinked,
        is_completed: submission.productive,
        is_mission_linked: missionLinked,
        source: "submission"
      };
    });

    if (missionText.length > 0 && !generatedTasks.some((task) => task.is_mission_linked)) {
      generatedTasks.unshift({
        id: `${submission.id}-mission`,
        date: submission.date,
        user_id: submission.user_id,
        title: missionText,
        category: "mission",
        priority: "high",
        duration: 45,
        is_high_impact: true,
        is_completed: missionCompleted || submission.productive,
        is_mission_linked: true,
        source: "submission"
      });
    }

    byDate.set(submission.date, generatedTasks);
  }

  return byDate;
}

function toWeekday(dateISO: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-US", {
    weekday: "short",
    timeZone: "UTC"
  })
    .format(new Date(`${dateISO}T12:00:00.000Z`))
    .slice(0, 3)
    .toUpperCase();
}

function linePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const max = Math.max(1, ...values);
  const stepX = values.length === 1 ? width : width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = Math.round(index * stepX * 100) / 100;
      const y = Math.round((height - (value / max) * height) * 100) / 100;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function buildAnalyticsModel(
  submissions: Submission[],
  score: ScoreState,
  localTasksByDate: Map<string, AnalyticsTask[]>,
  locale: Locale
): AnalyticsModel {
  const today = toLocalISODate();
  const rangeDates = Array.from({ length: RANGE_DAYS }, (_, index) => shiftISODate(today, index - (RANGE_DAYS - 1)));
  const fallbackByDate = buildFallbackTasksByDate(submissions);

  const submissionPointsByDate = submissions.reduce<Map<string, number>>((acc, submission) => {
    if (
      submission.status === "pending"
      || submission.status === "submitted"
      || submission.status === "in_review"
      || submission.status === "draft"
    ) {
      return acc;
    }
    const current = acc.get(submission.date) ?? 0;
    acc.set(submission.date, current + Math.round(safeNumber(submission.points_awarded, 0)));
    return acc;
  }, new Map());

  const submissionFocusByDate = submissions.reduce<Map<string, number>>((acc, submission) => {
    const focusRaw = String(submission.custom_answers.focus ?? "");
    const minutes = parseFocusMinutes(focusRaw);
    if (!minutes) return acc;
    const current = acc.get(submission.date) ?? 0;
    acc.set(submission.date, current + minutes);
    return acc;
  }, new Map());

  const daily: DayMetric[] = rangeDates.map((date, index) => {
    const planTasks = localTasksByDate.get(date) ?? [];
    const fallbackTasks = fallbackByDate.get(date) ?? [];
    const tasks = planTasks.length > 0 ? planTasks : fallbackTasks;

    const total = tasks.length;
    const done = tasks.filter((task) => task.is_completed).length;
    const high = tasks.filter((task) => task.is_high_impact || task.priority === "high");
    const highDone = high.filter((task) => task.is_completed).length;
    const mission = tasks.filter((task) => task.is_mission_linked || task.category === "mission");
    const missionDone = mission.filter((task) => task.is_completed).length;

    const completionRate = percent(done, total);
    const highImpactRate = percent(highDone, high.length);
    const missionRate = percent(missionDone, mission.length);

    const windowStart = Math.max(0, index - 6);
    const recent = rangeDates.slice(windowStart, index + 1);
    const activeDays = recent.reduce((sum, day) => {
      const dayTasks = (localTasksByDate.get(day) ?? []).length > 0 ? localTasksByDate.get(day) ?? [] : fallbackByDate.get(day) ?? [];
      const doneAny = dayTasks.some((task) => task.is_completed);
      return sum + (doneAny ? 1 : 0);
    }, 0);
    const consistencyRate = percent(activeDays, recent.length);

    const planFocus = tasks.filter((task) => task.is_completed).reduce((sum, task) => sum + task.duration, 0);
    const fallbackFocus = submissionFocusByDate.get(date) ?? 0;
    const focusMinutes = Math.max(planFocus, fallbackFocus);

    const pointsDelta = submissionPointsByDate.get(date) ?? 0;

    return {
      date,
      total,
      done,
      highTotal: high.length,
      highDone,
      missionTotal: mission.length,
      missionDone,
      completionRate,
      highImpactRate,
      missionRate,
      consistencyRate,
      productivityScore: clampPercent(completionRate * 0.4 + highImpactRate * 0.3 + missionRate * 0.2 + consistencyRate * 0.1),
      pointsDelta,
      focusMinutes,
      carryOverOut: 0,
      carryOverIn: 0,
      tasks
    };
  });

  for (let i = 0; i < daily.length - 1; i += 1) {
    const current = daily[i];
    const next = daily[i + 1];
    const nextTitles = new Set(next.tasks.map((task) => normalizeText(task.title)));
    const carryOut = current.tasks.filter((task) => !task.is_completed && nextTitles.has(normalizeText(task.title))).length;
    const carryIn = next.tasks.filter((task) => !task.is_completed && current.tasks.some((prev) => normalizeText(prev.title) === normalizeText(task.title))).length;
    current.carryOverOut = carryOut;
    next.carryOverIn = carryIn;
  }

  const latest7 = daily.slice(-7);
  const prev7 = daily.slice(-14, -7);

  const aggregate = (rows: DayMetric[]) => {
    const totalTasks = rows.reduce((sum, row) => sum + row.total, 0);
    const doneTasks = rows.reduce((sum, row) => sum + row.done, 0);
    const highTotal = rows.reduce((sum, row) => sum + row.highTotal, 0);
    const highDone = rows.reduce((sum, row) => sum + row.highDone, 0);
    const missionTotal = rows.reduce((sum, row) => sum + row.missionTotal, 0);
    const missionDone = rows.reduce((sum, row) => sum + row.missionDone, 0);
    const focusMinutes = rows.reduce((sum, row) => sum + row.focusMinutes, 0);
    const carryOut = rows.reduce((sum, row) => sum + row.carryOverOut, 0);
    const unfinished = rows.reduce((sum, row) => sum + Math.max(0, row.total - row.done), 0);
    const consistency = percent(rows.filter((row) => row.done > 0).length, Math.max(1, rows.length));

    return {
      completion: percent(doneTasks, totalTasks),
      high: percent(highDone, highTotal),
      mission: percent(missionDone, missionTotal),
      consistency,
      unified: clampPercent(percent(doneTasks, totalTasks) * 0.4 + percent(highDone, highTotal) * 0.3 + percent(missionDone, missionTotal) * 0.2 + consistency * 0.1),
      focusHours: Math.round((focusMinutes / 60) * 10) / 10,
      carryOver: percent(carryOut, unfinished),
      missionVelocity: Math.round((missionDone / Math.max(1, rows.length)) * 10) / 10,
      highDoneCount: highDone,
      highTotalCount: highTotal,
      missionDoneCount: missionDone,
      missionTotalCount: missionTotal,
      totalTasks,
      doneTasks
    };
  };

  const currentAgg = aggregate(latest7);
  const previousAgg = aggregate(prev7);

  const allTasks = daily.flatMap((row) => row.tasks);
  const highImpactCount = allTasks.filter((task) => task.is_high_impact || task.priority === "high").length;
  const normalCount = Math.max(0, allTasks.length - highImpactCount);

  const categoryCounts = CATEGORY_ORDER.reduce<Record<Category, number>>(
    (acc, category) => ({ ...acc, [category]: 0 }),
    { work: 0, mission: 0, health: 0, personal: 0 }
  );
  const categoryDoneCounts = CATEGORY_ORDER.reduce<Record<Category, number>>(
    (acc, category) => ({ ...acc, [category]: 0 }),
    { work: 0, mission: 0, health: 0, personal: 0 }
  );

  for (const task of allTasks) {
    categoryCounts[task.category] += 1;
    if (task.is_completed) categoryDoneCounts[task.category] += 1;
  }

  const totalCategoryCount = Math.max(1, allTasks.length);
  const categoryShare = CATEGORY_ORDER.reduce<Record<Category, number>>(
    (acc, category) => ({ ...acc, [category]: percent(categoryCounts[category], totalCategoryCount) }),
    { work: 0, mission: 0, health: 0, personal: 0 }
  );

  const categoryPerformance = CATEGORY_ORDER.reduce<Record<Category, number>>(
    (acc, category) => ({ ...acc, [category]: percent(categoryDoneCounts[category], categoryCounts[category]) }),
    { work: 0, mission: 0, health: 0, personal: 0 }
  );

  const missionTasks = allTasks.filter((task) => task.is_mission_linked || task.category === "mission");
  const missionDone = missionTasks.filter((task) => task.is_completed);
  const missionMissed = latest7.reduce((sum, day) => {
    if (day.missionTotal === 0) return sum;
    return sum + (day.missionDone < day.missionTotal ? 1 : 0);
  }, 0);

  const missionContributionScore = clampPercent((currentAgg.mission * 0.2 * 100) / 100 + (currentAgg.high * 0.05));

  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i -= 1) {
    if (daily[i].done > 0) {
      streak += 1;
    } else {
      break;
    }
  }

  const bestDay = latest7
    .slice()
    .sort((a, b) => b.productivityScore - a.productivityScore)[0];

  const insights: InsightCard[] = [];
  if (bestDay) {
    insights.push({
      id: "best-day",
      level: "success",
      title: locale === "ko" ? `가장 생산적인 요일은 ${toWeekday(bestDay.date, locale)}입니다` : `Your peak day is ${toWeekday(bestDay.date, locale)}`,
      body:
        locale === "ko"
          ? "해당 요일에 High Impact 작업을 먼저 배치하면 성과가 더 높아집니다."
          : "Front-load high-impact tasks on that day to maximize output.",
      ctaLabel: locale === "ko" ? "내일 계획 최적화" : "Optimize tomorrow",
      ctaHref: "/app/plan"
    });
  }

  if (currentAgg.carryOver > 22) {
    insights.push({
      id: "carry-over-risk",
      level: "warning",
      title: locale === "ko" ? "이월률이 높습니다" : "Carry-over rate is rising",
      body:
        locale === "ko"
          ? "작업 크기를 30~45분 단위로 쪼개면 완료율이 좋아집니다."
          : "Break tasks into 30-45 minute blocks to reduce spillover.",
      ctaLabel: locale === "ko" ? "Carry-over 정리" : "Fix carry-over",
      ctaHref: "/app/plan"
    });
  }

  if (currentAgg.focusHours < 6) {
    insights.push({
      id: "focus-low",
      level: "info",
      title: locale === "ko" ? "집중 시간이 낮습니다" : "Focus time is low",
      body:
        locale === "ko"
          ? "짧은 딥워크 세션 2개만 추가해도 점수가 빠르게 회복됩니다."
          : "Two short deep-work sessions can quickly lift your score.",
      ctaLabel: locale === "ko" ? "집중 블록 추가" : "Improve focus",
      ctaHref: "/app/plan"
    });
  }

  if (missionTasks.length > 0 && currentAgg.mission < 65) {
    insights.push({
      id: "mission-gap",
      level: "warning",
      title: locale === "ko" ? "미션 수행률이 낮아요" : "Mission completion is behind",
      body:
        locale === "ko"
          ? "미션을 2~3개의 실행 단위로 분해하면 성공률이 올라갑니다."
          : "Split the mission into smaller execution steps to increase completion.",
      ctaLabel: locale === "ko" ? "미션 재추가" : "Re-add mission",
      ctaHref: "/app/plan"
    });
  }

  const tier = scoreTier(score.total_points);
  const level = scoreLevel(score.total_points);
  const topPercent = tier === "Diamond" ? 10 : tier === "Gold" ? 20 : tier === "Silver" ? 35 : 55;

  return {
    rangeDates,
    dayMetrics: daily,
    latest7,
    prev7,
    unifiedScore: currentAgg.unified,
    unifiedDelta: currentAgg.unified - previousAgg.unified,
    weeklyCompletion: currentAgg.completion,
    weeklyCompletionDelta: currentAgg.completion - previousAgg.completion,
    highImpactRate: currentAgg.high,
    highImpactDoneCount: currentAgg.highDoneCount,
    highImpactTotalCount: currentAgg.highTotalCount,
    focusHours: currentAgg.focusHours,
    carryOverRate: currentAgg.carryOver,
    missionVelocity: currentAgg.missionVelocity,
    streak: Math.max(streak, score.current_streak),
    categoryShare,
    categoryPerformance,
    highImpactCount,
    normalCount,
    missionSuccessRate: percent(missionDone.length, missionTasks.length),
    missionAvgMinutes: missionDone.length > 0 ? Math.round(missionDone.reduce((sum, task) => sum + task.duration, 0) / missionDone.length) : 0,
    missionMissed,
    missionContributionScore,
    topPercent,
    level,
    tier,
    recentSubmissions: submissions.slice(0, 6),
    insights,
  };
}

function metricTone(value: number): string {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-rose-600";
  return "text-slate-500";
}

function heatCellClass(scoreValue: number, pointsDelta: number): string {
  if (pointsDelta < 0) {
    if (pointsDelta <= -8) return "bg-rose-500";
    if (pointsDelta <= -3) return "bg-rose-300";
    return "bg-rose-200";
  }
  if (scoreValue >= 85) return "bg-blue-700";
  if (scoreValue >= 65) return "bg-blue-500";
  if (scoreValue >= 40) return "bg-blue-300";
  if (scoreValue >= 15) return "bg-blue-100";
  return "bg-slate-200";
}

function categoryColor(category: Category): string {
  if (category === "work") return "#1552d6";
  if (category === "mission") return "#9a5600";
  if (category === "health") return "#c40012";
  return "#5f6368";
}

function categoryLabel(category: Category, locale: Locale): string {
  if (locale === "ko") {
    if (category === "work") return "업무";
    if (category === "mission") return "미션";
    if (category === "health") return "건강";
    return "개인";
  }
  if (category === "work") return "Work";
  if (category === "mission") return "Mission";
  if (category === "health") return "Health";
  return "Personal";
}

export function ProductivityRecordSystem({ mode, locale, userId, score, submissions, notifications }: Props) {
  const [localTasksByDate, setLocalTasksByDate] = useState<Map<string, AnalyticsTask[]>>(new Map());

  useEffect(() => {
    let mounted = true;

    const load = () => {
      if (typeof window === "undefined" || !window.localStorage) return;
      const today = toLocalISODate();
      const dates = Array.from({ length: RANGE_DAYS }, (_, index) => shiftISODate(today, index - (RANGE_DAYS - 1)));
      const map = new Map<string, AnalyticsTask[]>();

      for (const date of dates) {
        const raw = window.localStorage.getItem(storageKey(userId, date));
        const legacy = window.localStorage.getItem(legacyStorageKey(date));
        const parsed = parsePlanTaskArray(raw ?? legacy, userId, date);
        if (parsed.length > 0) {
          map.set(date, parsed);
        }
      }

      if (mounted) {
        setLocalTasksByDate(map);
      }
    };

    const schedule = () => {
      const idle = (globalThis as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (typeof idle === "function") {
        idle(load);
        return;
      }
      setTimeout(load, 0);
    };

    schedule();

    const onStorage = (event: StorageEvent) => {
      if (!event.key) return;
      if (event.key.startsWith(STORAGE_PREFIX) || event.key.startsWith(LEGACY_STORAGE_PREFIX)) {
        schedule();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId]);

  const model = useMemo(() => buildAnalyticsModel(submissions, score, localTasksByDate, locale), [submissions, score, localTasksByDate, locale]);

  const heatmapDays = model.dayMetrics.slice(-28);
  const completionPath = linePath(model.latest7.map((day) => day.completionRate), 100, 46);
  const highPath = linePath(model.latest7.map((day) => day.highImpactRate), 100, 46);
  const missionPath = linePath(model.latest7.map((day) => day.missionRate), 100, 46);

  const donutBackground = `conic-gradient(${categoryColor("work")} 0% ${model.categoryShare.work}%, ${categoryColor("mission")} ${model.categoryShare.work}% ${model.categoryShare.work + model.categoryShare.mission}%, ${categoryColor("health")} ${model.categoryShare.work + model.categoryShare.mission}% ${model.categoryShare.work + model.categoryShare.mission + model.categoryShare.health}%, ${categoryColor("personal")} ${model.categoryShare.work + model.categoryShare.mission + model.categoryShare.health}% 100%)`;

  const missionAlerts = notifications.filter((item) => item.category === "mission" || item.kind === "announcement").length;

  if (mode === "hub") {
    return (
      <div className="space-y-4">
        <section className="card p-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{locale === "ko" ? "생산성 맵" : "Productivity Map"}</p>
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900">{locale === "ko" ? "이번 달 집중도" : "September Focus"}</h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-600">
              {locale === "ko" ? "실시간" : "Live Tracking"}
            </span>
          </div>
          <div className="rounded-3xl bg-slate-50 p-3">
            <div className="grid grid-cols-7 gap-2">
              {heatmapDays.map((day) => (
                <div key={day.date} className={`aspect-square rounded-lg ${heatCellClass(day.productivityScore, day.pointsDelta)} ${day.date === model.rangeDates.at(-1) ? "ring-2 ring-blue-600 ring-offset-2" : ""}`} title={`${day.date} ${day.productivityScore}%`} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>{locale === "ko" ? "낮음" : "Low"}</span>
              <div className="flex gap-1">
                <div className="h-3 w-3 rounded-sm bg-blue-100" />
                <div className="h-3 w-3 rounded-sm bg-blue-300" />
                <div className="h-3 w-3 rounded-sm bg-blue-500" />
                <div className="h-3 w-3 rounded-sm bg-blue-700" />
                <div className="h-3 w-3 rounded-sm bg-rose-400" />
              </div>
              <span>{locale === "ko" ? "높음" : "High"}</span>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">{locale === "ko" ? "누적 포인트" : "Total Career Points"}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 shadow-inner">
              <span className="anim-bounce-soft text-2xl leading-none" role="img" aria-label="career reward">
                🏆
              </span>
              <Medal className="ml-1 h-4 w-4 text-indigo-600" />
            </div>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-5xl font-extrabold tracking-tight text-blue-700">{score.total_points.toLocaleString()}</p>
              <div className="mt-1 text-sm font-semibold text-slate-700">
                <p>{locale === "ko" ? "Monster Level" : "Monster Level"} {model.level}</p>
                <p className="text-slate-500">{model.tier} Tier</p>
              </div>
            </div>
          </div>
          <p className="mt-1 text-center text-xs text-slate-500">{locale === "ko" ? `상위 ${model.topPercent}% 성과권` : `Top ${model.topPercent}% performer`}</p>
        </section>

        <section className="card overflow-hidden bg-gradient-to-br from-blue-700 to-blue-600 p-5 text-white">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-3xl font-extrabold tracking-tight">{locale === "ko" ? "주간 성과" : "Weekly Performance"}</h3>
            <TrendingUp size={20} className="text-white/80" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">{locale === "ko" ? "완료" : "Tasks"}</p>
              <p className="text-4xl font-extrabold">{model.weeklyCompletion}%</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${model.weeklyCompletion}%` }} /></div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">{locale === "ko" ? "하이임팩트" : "Impact"}</p>
              <p className="text-4xl font-extrabold">{model.highImpactRate}%</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/20"><div className="h-full rounded-full bg-orange-200" style={{ width: `${model.highImpactRate}%` }} /></div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">{locale === "ko" ? "미션" : "Mission"}</p>
              <p className="text-4xl font-extrabold">{model.missionSuccessRate}%</p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: `${model.missionSuccessRate}%` }} /></div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          <article className="card p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{locale === "ko" ? "스트릭" : "Streak"}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{model.streak}<span className="ml-1 text-lg">🔥</span></p>
          </article>
          <article className="card p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{locale === "ko" ? "이월률" : "Carry-over"}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{model.carryOverRate}%</p>
          </article>
          <article className="card p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{locale === "ko" ? "집중" : "Focus"}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{Math.min(10, Math.max(1, Math.round((model.focusHours / 8) * 10 * 10) / 10)).toFixed(1)}</p>
          </article>
          <article className="card p-3 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">{locale === "ko" ? "미션 속도" : "Mission Vel"}</p>
            <p className="mt-1 text-3xl font-extrabold text-slate-900">{model.missionVelocity}</p>
          </article>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <Link className="card p-4 transition active:scale-[0.99]" href="/app/record/performance">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700"><Gauge size={24} /></div>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Performance" : "Performance"}</p>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Analytics" : "Analytics"}</p>
          </Link>
          <Link className="card p-4 transition active:scale-[0.99]" href="/app/record/tasks">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Target size={24} /></div>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Task" : "Task"}</p>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Breakdown" : "Breakdown"}</p>
          </Link>
          <Link className="card p-4 transition active:scale-[0.99]" href="/app/record/missions">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Rocket size={24} /></div>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Mission" : "Mission"}</p>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Analytics" : "Analytics"}</p>
          </Link>
          <Link className="card p-4 transition active:scale-[0.99]" href="/app/record/insights">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><Brain size={24} /></div>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Smart" : "Smart"}</p>
            <p className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "Insights" : "Insights"}</p>
          </Link>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-xl font-extrabold text-slate-900">{locale === "ko" ? "Submission History" : "Submission History"}</h4>
            <span className="text-xs font-semibold text-slate-500">{locale === "ko" ? "최근 6개" : "Recent 6"}</span>
          </div>
          <div className="space-y-2">
            {model.recentSubmissions.map((submission) => (
              <article className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2" key={submission.id}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-800">{submission.date}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      submission.status === "approved"
                        ? "bg-emerald-100 text-emerald-700"
                        : submission.status === "rejected"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {submission.status}
                  </span>
                </div>
                <p className="mt-1 line-clamp-1 text-sm text-slate-600">{submission.custom_answers.focus || submission.task_list[0] || "-"}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Link href="/app/plan" className="btn btn-muted inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <Sparkles size={16} /> {locale === "ko" ? "계획 조정" : "Adjust Plan"}
          </Link>
          <Link href="/app/plan" className="btn btn-primary inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <Zap size={16} /> {locale === "ko" ? "Carry-over 줄이기" : "Fix Carry-over"}
          </Link>
        </section>

        {missionAlerts > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <p className="font-bold">{locale === "ko" ? "미션 업데이트 알림이 있습니다" : "You have mission updates"}</p>
            <Link href="/app/mission" className="mt-1 inline-flex items-center gap-1 font-semibold underline">
              {locale === "ko" ? "미션 페이지 열기" : "Open mission page"} <ArrowRight size={14} />
            </Link>
          </section>
        )}
      </div>
    );
  }

  if (mode === "performance") {
    return (
      <div className="space-y-4">
        <section className="card overflow-hidden bg-gradient-to-br from-blue-700 to-blue-600 p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">{locale === "ko" ? "통합 생산성 점수" : "Unified Productivity Score"}</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <h2 className="text-7xl font-extrabold tracking-tighter">{model.unifiedScore}%</h2>
            <p
              className={`pb-2 text-sm font-bold ${
                model.unifiedDelta > 0 ? "text-emerald-200" : model.unifiedDelta < 0 ? "text-rose-200" : "text-white/70"
              }`}
            >
              {model.unifiedDelta > 0 ? "+" : ""}
              {model.unifiedDelta.toFixed(1)}% vs LW
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-white/70">{locale === "ko" ? "완료율" : "Completion"}</p>
              <p className="text-2xl font-bold">{model.weeklyCompletion}%</p>
            </div>
            <div>
              <p className="text-white/70">{locale === "ko" ? "집중시간" : "Focus Time"}</p>
              <p className="text-2xl font-bold">{model.focusHours}h</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "Completion Rate" : "Completion Rate"}</p>
            <p className="text-4xl font-extrabold text-slate-900">{model.weeklyCompletion}%</p>
            <p className={`text-xs font-semibold ${metricTone(model.weeklyCompletionDelta)}`}>{model.weeklyCompletionDelta > 0 ? "+" : ""}{model.weeklyCompletionDelta.toFixed(1)}%</p>
          </article>
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "High Impact" : "High Impact"}</p>
            <p className="text-4xl font-extrabold text-slate-900">{model.highImpactDoneCount}/{Math.max(1, model.highImpactTotalCount)}</p>
            <p className="text-xs font-semibold text-slate-600">{model.highImpactRate}%</p>
          </article>
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "Focus Time" : "Focus Time"}</p>
            <p className="text-4xl font-extrabold text-slate-900">{model.focusHours}h</p>
            <p className="text-xs font-semibold text-slate-600">{locale === "ko" ? "이번 주" : "This week"}</p>
          </article>
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "Carry-over" : "Carry-over"}</p>
            <p className="text-4xl font-extrabold text-slate-900">{model.carryOverRate}%</p>
            <p className="text-xs font-semibold text-slate-600">{locale === "ko" ? "낮을수록 좋음" : "Lower is better"}</p>
          </article>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-extrabold text-slate-900">{locale === "ko" ? "성능 추세" : "Performance Trend"}</h3>
            <CalendarDays size={18} className="text-blue-700" />
          </div>
          <svg className="h-48 w-full" preserveAspectRatio="none" viewBox="0 0 100 46">
            <path d={completionPath} fill="none" stroke="#0f4ad5" strokeLinecap="round" strokeWidth="2.8" />
            <path d={highPath} fill="none" stroke="#9a5600" strokeLinecap="round" strokeWidth="2.4" />
            <path d={missionPath} fill="none" stroke="#4f46e5" strokeLinecap="round" strokeWidth="2.2" />
          </svg>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
            {model.latest7.map((day) => (
              <span key={day.date}>{toWeekday(day.date, locale)}</span>
            ))}
          </div>
          <div className="mt-3 flex gap-3 text-xs font-semibold text-slate-600">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-700" />Completion</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-700" />High Impact</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-indigo-500" />Mission</span>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Link href="/app/plan" className="btn btn-muted inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <RefreshCcw size={16} /> {locale === "ko" ? "이월 개선" : "Fix carry-over"}
          </Link>
          <Link href="/app/plan" className="btn btn-primary inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <Zap size={16} /> {locale === "ko" ? "집중 강화" : "Improve focus"}
          </Link>
        </section>
      </div>
    );
  }

  if (mode === "tasks") {
    return (
      <div className="space-y-4">
        <section className="card p-5">
          <div className="mx-auto h-64 w-64 rounded-full p-8" style={{ background: donutBackground }}>
            <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-white">
              <p className="text-6xl font-extrabold text-slate-900">{model.highImpactCount + model.normalCount}</p>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{locale === "ko" ? "총 작업" : "Total Tasks"}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {CATEGORY_ORDER.map((category) => (
              <article className="rounded-2xl bg-slate-100 p-3" key={category}>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{categoryLabel(category, locale)}</p>
                <p className="text-4xl font-extrabold text-slate-900">{model.categoryShare[category]}%</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <article className="card bg-blue-700 p-4 text-white">
            <Zap className="mb-4" />
            <p className="text-xs uppercase tracking-[0.12em] text-white/70">High Impact</p>
            <p className="text-6xl font-extrabold">{model.highImpactCount}</p>
          </article>
          <article className="card p-4">
            <Target className="mb-4 text-slate-500" />
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Normal</p>
            <p className="text-6xl font-extrabold text-slate-900">{model.normalCount}</p>
          </article>
        </section>

        <section className="space-y-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-3xl font-extrabold text-slate-900">{locale === "ko" ? "카테고리 퍼포먼스" : "Category Patterns"}</h3>
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">{locale === "ko" ? "주간 평균" : "Weekly Avg"}</span>
          </div>
          {CATEGORY_ORDER.map((category) => (
            <article className="card p-4" key={category}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-lg font-extrabold text-slate-900">{categoryLabel(category, locale)}</p>
                <p className="text-sm font-bold text-slate-600">{model.categoryPerformance[category]}%</p>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200">
                <div className="h-full rounded-full" style={{ width: `${model.categoryPerformance[category]}%`, backgroundColor: categoryColor(category) }} />
              </div>
            </article>
          ))}
        </section>
      </div>
    );
  }

  if (mode === "missions") {
    return (
      <div className="space-y-4">
        <section className="card overflow-hidden bg-gradient-to-br from-blue-700 to-indigo-600 p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{locale === "ko" ? "미션 분석" : "Mission Analytics"}</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <article>
              <p className="text-xs text-white/70">{locale === "ko" ? "성공률" : "Success Rate"}</p>
              <p className="text-7xl font-extrabold tracking-tighter">{model.missionSuccessRate}%</p>
            </article>
            <article>
              <p className="text-xs text-white/70">{locale === "ko" ? "기여도" : "Contribution"}</p>
              <p className="text-7xl font-extrabold tracking-tighter">{model.missionContributionScore}%</p>
            </article>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "평균 완료시간" : "Avg Completion"}</p>
            <p className="text-5xl font-extrabold text-slate-900">{model.missionAvgMinutes}<span className="text-base">m</span></p>
          </article>
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "미스드" : "Missed"}</p>
            <p className="text-5xl font-extrabold text-slate-900">{model.missionMissed}</p>
          </article>
          <article className="card p-3">
            <p className="text-xs text-slate-500">{locale === "ko" ? "속도" : "Velocity"}</p>
            <p className="text-5xl font-extrabold text-slate-900">{model.missionVelocity}</p>
          </article>
        </section>

        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-2xl font-extrabold text-slate-900">{locale === "ko" ? "미션 추세" : "Mission Trend"}</h3>
            <Rocket className="text-indigo-600" size={18} />
          </div>
          <div className="space-y-2">
            {model.latest7.map((day) => (
              <div key={day.date} className="rounded-2xl bg-slate-100 p-3">
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{day.date}</span>
                  <span>{day.missionDone}/{day.missionTotal || 0}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-indigo-600" style={{ width: `${day.missionRate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <Link href="/app/plan" className="btn btn-muted inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <Target size={16} /> {locale === "ko" ? "미션 재배치" : "Adjust plan"}
          </Link>
          <Link href="/app/plan" className="btn btn-primary inline-flex items-center justify-center gap-2 py-3 text-sm font-bold">
            <Rocket size={16} /> {locale === "ko" ? "미션 재추가" : "Re-add mission"}
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="card p-5">
        <h3 className="text-5xl font-extrabold leading-tight text-slate-900">
          {locale === "ko" ? "현재 흐름이 좋습니다." : "You are in a luminous flow state."}
        </h3>
        <p className="mt-2 text-slate-600">
          {locale === "ko"
            ? "최근 30일 데이터를 기반으로 실행 패턴을 분석했습니다."
            : "Based on your last 30 days, here are actionable patterns to maintain momentum."}
        </p>
      </section>

      {model.insights.map((insight) => (
        <article
          className={`card p-4 ${
            insight.level === "warning" ? "bg-slate-950 text-white" : insight.level === "success" ? "bg-blue-50" : ""
          }`}
          key={insight.id}
        >
          <div className="mb-2 flex items-center gap-2">
            {insight.level === "warning" ? <ShieldAlert size={18} /> : insight.level === "success" ? <Sparkles size={18} className="text-blue-700" /> : <Flame size={18} className="text-amber-600" />}
            <h4 className={`text-3xl font-extrabold ${insight.level === "warning" ? "text-white" : "text-slate-900"}`}>{insight.title}</h4>
          </div>
          <p className={`${insight.level === "warning" ? "text-white/80" : "text-slate-600"}`}>{insight.body}</p>
          {insight.ctaHref && insight.ctaLabel && (
            <Link
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${
                insight.level === "warning"
                  ? "bg-rose-600 text-white"
                  : "bg-blue-700 text-white"
              }`}
              href={insight.ctaHref}
            >
              {insight.ctaLabel} <ArrowRight size={14} />
            </Link>
          )}
        </article>
      ))}

      <section className="card p-5">
        <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border-8 border-slate-100">
          <div className="h-44 w-44 rounded-full border-2 border-dashed border-blue-300 p-6 text-center">
            <p className="mt-8 text-6xl font-extrabold text-blue-700">{model.unifiedScore}%</p>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Alignment</p>
          </div>
        </div>
        <h4 className="mt-4 text-4xl font-extrabold text-slate-900">{locale === "ko" ? "Flow 패턴" : "The Flow Pattern"}</h4>
        <p className="mt-1 text-slate-600">
          {locale === "ko"
            ? "짧고 강한 집중 블록 + 짧은 회복 사이클이 가장 높은 점수를 만듭니다."
            : "Your best days combine intense focus bursts with short recovery cycles."}
        </p>
        <Link href="/app/plan" className="btn btn-primary mt-4 inline-flex w-full items-center justify-center gap-2 py-3 text-sm font-bold">
          <Sparkles size={16} /> {locale === "ko" ? "내일 일정 최적화" : "Optimize Tomorrow"}
        </Link>
      </section>
    </div>
  );
}

export type { RecordProductivityMode };
