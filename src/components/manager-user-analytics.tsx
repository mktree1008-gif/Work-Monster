"use client";

import { useMemo, useRef, useState, type TouchEvent } from "react";
import { ManagerAuditLog, ScoreState, Submission } from "@/lib/types";

type AnalyticsUserOption = {
  id: string;
  displayName: string;
  loginId: string;
};

type Props = {
  users: AnalyticsUserOption[];
  selectedUserId: string;
  selectedRange: "week" | "month";
  submissions: Submission[];
  score: ScoreState | null;
  auditLogs: ManagerAuditLog[];
};

type PeriodRow = {
  key: string;
  label: string;
  points: number;
  submissions: number;
};

type PointEvent = {
  id: string;
  date: string;
  delta: number;
  created_at: string;
  source: "login" | "submission_base" | "manager_review";
  submission_id?: string;
};

type DayPointStat = {
  net: number;
  plus: number;
  minus: number;
  events: number;
};

type ActivityLevel = "none" | "light" | "moderate" | "strong";
type CalorieLevel = "far_below" | "slightly_below" | "close" | "on_target" | "slightly_above" | "far_above";

function parseISODate(raw: string): Date {
  const [year, month, day] = raw.split("-").map((value) => Number(value));
  return new Date(Date.UTC(year, Math.max(0, month - 1), day || 1));
}

function toDateKeyUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function safeDateKey(value: unknown, fallbackDateTime = ""): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (typeof fallbackDateTime === "string" && fallbackDateTime.length >= 10) {
    const sliced = fallbackDateTime.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) {
      return sliced;
    }
  }
  return toDateKeyUTC(new Date());
}

function weekStartKey(dateKey: string): string {
  const date = parseISODate(dateKey);
  const weekday = date.getUTCDay();
  const diffToMonday = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return toDateKeyUTC(date);
}

function buildPeriodRows(
  entries: Array<{ date: string; points: number }>,
  range: "week" | "month"
): PeriodRow[] {
  const grouped = new Map<string, { points: number; submissions: number }>();
  for (const entry of entries) {
    const key = range === "week" ? weekStartKey(entry.date) : entry.date.slice(0, 7);
    const found = grouped.get(key) ?? { points: 0, submissions: 0 };
    found.points += entry.points;
    found.submissions += 1;
    grouped.set(key, found);
  }

  return [...grouped.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([key, value]) => ({
      key,
      label: range === "week" ? `Week of ${key}` : key,
      points: value.points,
      submissions: value.submissions
    }));
}

function currentMonthMatrix(statsByDate: Map<string, DayPointStat>) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = first.getUTCDay();
  const leading = startWeekday === 0 ? 6 : startWeekday - 1;

  const cells: Array<{ day: number; dateKey: string; stat: DayPointStat } | null> = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    const dateKey = toDateKeyUTC(date);
    cells.push({
      day,
      dateKey,
      stat: statsByDate.get(dateKey) ?? { net: 0, plus: 0, minus: 0, events: 0 }
    });
  }

  return cells;
}

function toSafeInt(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function countRows(values: string[], fallbackLabel: string): Array<[string, number]> {
  const map = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() || fallbackLabel;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function compactLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed.length <= 44) return trimmed;
  return `${trimmed.slice(0, 41)}...`;
}

function normalizeAnswer(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeActivityValue(raw: unknown): ActivityLevel | "" {
  const value = normalizeAnswer(raw);
  if (!value) return "";
  if (
    value === "none"
    || value.includes("🛌")
    || value.includes("none")
    || value.includes("no activity")
    || value.includes("없음")
  ) return "none";
  if (
    value === "light"
    || value.includes("🚶")
    || value.includes("light")
    || value.includes("walk")
    || value.includes("가벼")
  ) return "light";
  if (
    value === "moderate"
    || value.includes("🏃")
    || value.includes("moderate")
    || value.includes("중간")
  ) return "moderate";
  if (
    value === "strong"
    || value.includes("💪")
    || value.includes("strong")
    || value.includes("high")
    || value.includes("강")
  ) return "strong";
  return "";
}

function normalizeCalorieValue(raw: unknown): CalorieLevel | "" {
  const value = normalizeAnswer(raw);
  if (!value) return "";
  if (
    value === "far_below"
    || value.includes("🥶")
    || value.includes("far below")
    || value.includes("much below")
    || value.includes("too low")
    || value.includes("많이 부족")
  ) return "far_below";
  if (
    value === "slightly_below"
    || value.includes("🫥")
    || value.includes("slightly below")
    || value.includes("below goal")
    || value.includes("조금 부족")
  ) return "slightly_below";
  if (
    value === "far_above"
    || value.includes("🍔")
    || value.includes("far above")
    || value.includes("much above")
    || value.includes("많이")
  ) return "far_above";
  if (
    value === "slightly_above"
    || value.includes("🍕")
    || value.includes("slightly above")
    || value.includes("조금")
  ) return "slightly_above";
  if (
    value === "close"
    || value.includes("🥗")
    || value.includes("close")
    || value.includes("near")
    || value.includes("근접")
  ) return "close";
  if (
    value === "on_target"
    || value.includes("🎯")
    || value.includes("on target")
    || value.includes("target")
    || value.includes("목표")
  ) return "on_target";
  return "";
}

function normalizedTaskTokens(task: string): string[] {
  const normalized = task
    .toLowerCase()
    .replace(/[^a-z0-9\u3131-\uD79D\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return [];

  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "from",
    "this",
    "that",
    "today",
    "work",
    "task",
    "done",
    "check",
    "daily",
    "plan",
    "to",
    "of",
    "in",
    "on",
    "a",
    "an",
    "is",
    "was",
    "완료",
    "진행",
    "업무",
    "작업",
    "오늘",
    "계획",
    "정리"
  ]);

  return normalized
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !stopWords.has(item));
}

export function ManagerUserAnalytics({
  users,
  selectedUserId,
  selectedRange,
  submissions,
  score,
  auditLogs
}: Props) {
  const [activeDateKey, setActiveDateKey] = useState<string | null>(null);
  const [activeDetailView, setActiveDetailView] = useState<"list" | "checkin">("list");
  const touchStartXRef = useRef(0);

  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0];
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission] as const));
  const submissionsByDate = useMemo(() => {
    const map = new Map<string, Submission[]>();
    for (const submission of submissions) {
      const items = map.get(submission.date) ?? [];
      items.push(submission);
      map.set(submission.date, items);
    }
    return map;
  }, [submissions]);

  const reviewedEntries = submissions
    .filter(
      (submission) =>
        submission.status !== "pending"
        && submission.status !== "submitted"
        && submission.status !== "in_review"
        && submission.status !== "draft"
    )
    .map((submission) => ({
      id: submission.id,
      date: submission.date,
      points: submission.points_awarded,
      mood: submission.mood,
      productive: submission.productive,
      focus: submission.custom_answers.focus ?? "",
      blocker: submission.custom_answers.blocker ?? "",
      win: submission.custom_answers.win ?? "",
      status: submission.status,
      managerNote: (submission.manager_note ?? "").trim(),
      bonus: submission.bonus_points_awarded ?? 0,
      reviewedAt: submission.reviewed_at ?? submission.created_at
    }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const reviewPointsBySubmission = new Map<string, PointEvent>();
  const submissionBaseAwarded = new Set<string>();
  const pointEvents: PointEvent[] = [];

  for (const log of auditLogs) {
    if (log.action === "login.base_points_awarded" && selectedUser && log.actor_user_id === selectedUser.id) {
      pointEvents.push({
        id: log.id,
        date: safeDateKey(log.details.date, log.created_at),
        delta: toSafeInt(log.details.points),
        created_at: log.created_at,
        source: "login"
      });
      continue;
    }

    if (log.action === "submission.base_points_awarded" && selectedUser && log.actor_user_id === selectedUser.id) {
      if (submissionBaseAwarded.has(log.target_id)) continue;
      submissionBaseAwarded.add(log.target_id);
      const linkedSubmission = submissionById.get(log.target_id);
      pointEvents.push({
        id: log.id,
        date: safeDateKey(log.details.date, linkedSubmission?.date ?? log.created_at),
        delta: toSafeInt(log.details.points),
        created_at: log.created_at,
        source: "submission_base",
        submission_id: log.target_id
      });
      continue;
    }

    if (log.action === "submission.reviewed") {
      const linkedSubmission = submissionById.get(log.target_id);
      if (!linkedSubmission) continue;
      const parsed = Number(log.details.points);
      const delta = Number.isFinite(parsed)
        ? Math.round(parsed)
        : toSafeInt(log.details.base_points) + Math.max(0, toSafeInt(log.details.bonus_points));
      const existing = reviewPointsBySubmission.get(log.target_id);
      if (!existing || log.created_at > existing.created_at) {
        reviewPointsBySubmission.set(log.target_id, {
          id: log.id,
          date: linkedSubmission.date,
          delta,
          created_at: log.created_at,
          source: "manager_review",
          submission_id: log.target_id
        });
      }
    }

    if (log.action === "login.inactivity_penalty_applied" && selectedUser && String(log.details.user_id ?? "") === selectedUser.id) {
      pointEvents.push({
        id: log.id,
        date: safeDateKey(log.details.login_date, log.created_at),
        delta: toSafeInt(log.details.points_applied),
        created_at: log.created_at,
        source: "manager_review"
      });
      continue;
    }

    if (log.action === "score.manual_adjusted" && selectedUser && String(log.details.user_id ?? "") === selectedUser.id) {
      pointEvents.push({
        id: log.id,
        date: safeDateKey(log.details.date, log.created_at),
        delta: toSafeInt(log.details.points),
        created_at: log.created_at,
        source: "manager_review"
      });
    }
  }

  const reflectedReviews = new Set<string>();
  for (const [submissionId, event] of reviewPointsBySubmission.entries()) {
    reflectedReviews.add(submissionId);
    pointEvents.push(event);
  }

  for (const submission of reviewedEntries) {
    if (reflectedReviews.has(submission.id)) continue;
    pointEvents.push({
      id: `fallback-${submission.id}`,
      date: submission.date,
      delta: submission.points,
      created_at: submission.reviewedAt,
      source: "manager_review",
      submission_id: submission.id
    });
  }

  pointEvents.sort((a, b) => {
    if (a.date === b.date) return a.created_at > b.created_at ? 1 : -1;
    return a.date > b.date ? 1 : -1;
  });

  const dayStats = new Map<string, DayPointStat>();
  for (const event of pointEvents) {
    const current = dayStats.get(event.date) ?? { net: 0, plus: 0, minus: 0, events: 0 };
    current.net += event.delta;
    if (event.delta > 0) current.plus += event.delta;
    if (event.delta < 0) current.minus += Math.abs(event.delta);
    current.events += 1;
    dayStats.set(event.date, current);
  }

  const trendRows = [...dayStats.entries()]
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .slice(-14)
    .map(([date, stat]) => ({ date, points: stat.net, plus: stat.plus, minus: stat.minus }));
  const maxAbsTrend = Math.max(1, ...trendRows.map((entry) => Math.abs(entry.points)));
  const periodRows = buildPeriodRows(
    [...dayStats.entries()].map(([date, stat]) => ({ date, points: stat.net })),
    selectedRange
  );

  const totalPlus = pointEvents.filter((event) => event.delta > 0).reduce((sum, event) => sum + event.delta, 0);
  const totalMinus = pointEvents.filter((event) => event.delta < 0).reduce((sum, event) => sum + Math.abs(event.delta), 0);
  const totalNet = totalPlus - totalMinus;

  const averagePointsByPeriod =
    periodRows.length > 0
      ? Math.round((periodRows.reduce((sum, row) => sum + row.points, 0) / periodRows.length) * 10) / 10
      : 0;
  const averagePointsPerSubmission =
    reviewedEntries.length > 0
      ? Math.round((reviewedEntries.reduce((sum, row) => sum + row.points, 0) / reviewedEntries.length) * 10) / 10
      : 0;
  const approvalCount = reviewedEntries.filter((entry) => entry.status === "approved").length;
  const approvalRate =
    reviewedEntries.length > 0 ? Math.round((approvalCount / reviewedEntries.length) * 100) : 0;

  const moodRows = countRows(reviewedEntries.map((entry) => entry.mood), "(No mood)").slice(0, 5);
  const focusRows = countRows(reviewedEntries.map((entry) => entry.focus), "(No focus answer)").slice(0, 5);
  const blockerRows = countRows(reviewedEntries.map((entry) => entry.blocker), "(No blocker answer)").slice(0, 5);
  const winRows = countRows(reviewedEntries.map((entry) => entry.win), "(No final answer)").slice(0, 5);
  const maxMood = Math.max(1, ...moodRows.map((item) => item[1]), 1);
  const maxFocus = Math.max(1, ...focusRows.map((item) => item[1]), 1);
  const maxBlocker = Math.max(1, ...blockerRows.map((item) => item[1]), 1);
  const maxWin = Math.max(1, ...winRows.map((item) => item[1]), 1);

  const calendarCells = currentMonthMatrix(dayStats);
  const recentReviewCards = [...reviewedEntries]
    .sort((a, b) => (a.reviewedAt > b.reviewedAt ? -1 : 1))
    .slice(0, 6);

  const selectedDateSubmissions = activeDateKey ? submissionsByDate.get(activeDateKey) ?? [] : [];
  const selectedDateStats = activeDateKey
    ? dayStats.get(activeDateKey) ?? { net: 0, plus: 0, minus: 0, events: 0 }
    : { net: 0, plus: 0, minus: 0, events: 0 };
  const latestSubmissionOnDate = selectedDateSubmissions
    .slice()
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];

  function openDayModal(dateKey: string) {
    setActiveDateKey(dateKey);
    setActiveDetailView("list");
  }

  function closeDayModal() {
    setActiveDateKey(null);
  }

  function onDetailTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.changedTouches[0]?.clientX ?? 0;
  }

  function onDetailTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const endX = event.changedTouches[0]?.clientX ?? 0;
    const diff = endX - touchStartXRef.current;
    if (diff < -35) setActiveDetailView("checkin");
    if (diff > 35) setActiveDetailView("list");
  }

  const answerDigest = [
    {
      key: "mood",
      icon: "🙂",
      title: "Mood",
      rows: moodRows,
      max: maxMood,
      barClass: "bg-indigo-500",
      cardClass: "bg-indigo-50 ring-indigo-100"
    },
    {
      key: "focus",
      icon: "🎯",
      title: "Focus",
      rows: focusRows,
      max: maxFocus,
      barClass: "bg-cyan-500",
      cardClass: "bg-cyan-50 ring-cyan-100"
    },
    {
      key: "blocker",
      icon: "🚧",
      title: "Blocker",
      rows: blockerRows,
      max: maxBlocker,
      barClass: "bg-amber-500",
      cardClass: "bg-amber-50 ring-amber-100"
    },
    {
      key: "need",
      icon: "✨",
      title: "Need / Win",
      rows: winRows,
      max: maxWin,
      barClass: "bg-violet-500",
      cardClass: "bg-violet-50 ring-violet-100"
    }
  ];

  const taskItems = submissions.flatMap((submission) =>
    submission.task_list
      .map((task) => task.trim())
      .filter((task) => task.length > 0)
  );
  const taskDays = submissions.filter((submission) => submission.task_list.some((task) => task.trim().length > 0)).length;
  const avgTasksPerCheckIn = taskDays > 0 ? Math.round((taskItems.length / taskDays) * 10) / 10 : 0;
  const latestSubmission = submissions
    .slice()
    .sort((a, b) => (a.created_at > b.created_at ? -1 : 1))[0];
  const latestTaskPreview = latestSubmission
    ? latestSubmission.task_list.map((task) => task.trim()).filter(Boolean).slice(0, 5)
    : [];

  const taskKeywordMap = new Map<string, number>();
  for (const task of taskItems) {
    const tokens = normalizedTaskTokens(task);
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      taskKeywordMap.set(token, (taskKeywordMap.get(token) ?? 0) + 1);
    }
  }
  const taskKeywordRows = [...taskKeywordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const maxTaskKeywordCount = Math.max(1, ...taskKeywordRows.map((item) => item[1]));

  const wellnessRows = submissions
    .map((submission) => {
      const q8 = normalizeActivityValue(submission.custom_answers.q8);
      const q9 = normalizeCalorieValue(submission.custom_answers.q9);
      return {
        id: submission.id,
        date: submission.date,
        activity: q8,
        calories: q9
      };
    })
    .filter((item) => item.activity || item.calories)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const activityLabel: Record<ActivityLevel, string> = {
    none: "🛌 None",
    light: "🚶 Light",
    moderate: "🏃 Moderate",
    strong: "💪 Strong"
  };
  const calorieLabel: Record<CalorieLevel, string> = {
    far_below: "🥶 Far below",
    slightly_below: "🫥 Slightly below",
    far_above: "🍔 Far above",
    slightly_above: "🍕 Slightly above",
    close: "🥗 Close",
    on_target: "🎯 On target"
  };

  const activityCounts: Record<ActivityLevel, number> = {
    none: 0,
    light: 0,
    moderate: 0,
    strong: 0
  };
  const calorieCounts: Record<CalorieLevel, number> = {
    far_below: 0,
    slightly_below: 0,
    far_above: 0,
    slightly_above: 0,
    close: 0,
    on_target: 0
  };

  for (const row of wellnessRows) {
    if (row.activity) activityCounts[row.activity] += 1;
    if (row.calories) calorieCounts[row.calories] += 1;
  }

  const activityAnswerDays = wellnessRows.filter((item) => item.activity).length;
  const calorieAnswerDays = wellnessRows.filter((item) => item.calories).length;
  const strongActivityDays = activityCounts.moderate + activityCounts.strong;
  const calorieOnTrackDays = calorieCounts.close + calorieCounts.on_target;
  const activityRate = activityAnswerDays > 0 ? Math.round((strongActivityDays / activityAnswerDays) * 100) : 0;
  const calorieRate = calorieAnswerDays > 0 ? Math.round((calorieOnTrackDays / calorieAnswerDays) * 100) : 0;

  const activityScore: Record<ActivityLevel, number> = {
    none: 10,
    light: 40,
    moderate: 70,
    strong: 100
  };
  const calorieScore: Record<CalorieLevel, number> = {
    far_below: 18,
    slightly_below: 45,
    far_above: 10,
    slightly_above: 35,
    close: 75,
    on_target: 100
  };

  const recentWellness = wellnessRows.slice(-7).map((row) => ({
    date: row.date.slice(5),
    activity: row.activity ? activityScore[row.activity] : 0,
    calories: row.calories ? calorieScore[row.calories] : 0
  }));

  return (
    <section className="card mb-4 p-4" id="user-analytics">
      <h2 className="text-xl font-black text-indigo-900">User History Analytics</h2>
      <p className="mt-1 text-sm text-slate-600">
        Score calendar now uses real + / - point flow, and answers are grouped into easier-to-scan summary cards.
      </p>

      <form action="/manager" className="mt-3 grid grid-cols-2 gap-2" method="get">
        <input name="manager_tab" type="hidden" value="analytics" />
        <label className="col-span-2 text-xs font-semibold text-slate-600">
          User
          <select className="input mt-1" defaultValue={selectedUser?.id} name="analytics_user">
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName} ({user.loginId})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Group by
          <select className="input mt-1" defaultValue={selectedRange} name="analytics_range">
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn btn-primary w-full" type="submit">
            Apply
          </button>
        </div>
      </form>

      {selectedUser ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Selected user</p>
              <p className="font-bold text-indigo-900">{selectedUser.displayName}</p>
              <p className="text-xs text-slate-500">{selectedUser.loginId}</p>
            </article>
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Current total points</p>
              <p className="font-bold text-indigo-900">{score?.total_points ?? 0} pts</p>
              <p className="text-xs text-slate-500">Lifetime {score?.lifetime_points ?? 0} pts</p>
            </article>
            <article className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">Earned points</p>
              <p className="font-bold text-emerald-800">+{totalPlus} pts</p>
              <p className="text-xs text-emerald-700">From login / check-in / review</p>
            </article>
            <article className="rounded-xl bg-rose-50 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-rose-700">Lost points</p>
              <p className="font-bold text-rose-800">-{totalMinus} pts</p>
              <p className={`text-xs font-semibold ${totalNet >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                Net: {totalNet >= 0 ? `+${totalNet}` : totalNet} pts
              </p>
            </article>
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Approval rate</p>
              <p className="font-bold text-indigo-900">{approvalRate}%</p>
              <p className="text-xs text-slate-500">
                {approvalCount} approved / {reviewedEntries.length} reviewed
              </p>
            </article>
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Average points</p>
              <p className="font-bold text-indigo-900">{averagePointsPerSubmission} / submission</p>
              <p className="text-xs text-slate-500">{averagePointsByPeriod} / {selectedRange}</p>
            </article>
          </div>

          <article className="mt-3 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-blue-900 p-4 text-white">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-100">Manager Summary</p>
                <h3 className="mt-1 text-lg font-black">Task / Calories / Workout Snapshot</h3>
                <p className="mt-1 text-xs text-indigo-100/90">
                  Built from each user check-in responses and task list submissions.
                </p>
              </div>
              <span className="rounded-full bg-white/15 px-2 py-1 text-[11px] font-bold">
                {wellnessRows.length > 0 ? `${wellnessRows.length} wellness logs` : "No wellness logs"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <article className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Task list</p>
                <p className="mt-1 text-2xl font-black">{taskItems.length}</p>
                <p className="text-xs text-indigo-100/90">
                  {taskDays} active days • avg {avgTasksPerCheckIn} tasks/check-in
                </p>
                {latestTaskPreview.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {latestTaskPreview.map((task, index) => (
                      <span className="rounded-full bg-white/15 px-2 py-1 text-[10px] font-semibold" key={`${task}-${index}`}>
                        {compactLabel(task)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-indigo-100/80">No task list submitted yet.</p>
                )}
              </article>

              <article className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Calorie goal trend</p>
                <p className="mt-1 text-2xl font-black">{calorieRate}%</p>
                <p className="text-xs text-indigo-100/90">Close / On target ratio</p>
                <div className="mt-2 space-y-1">
                  {(Object.keys(calorieCounts) as CalorieLevel[]).map((key) => {
                    const count = calorieCounts[key];
                    const width = calorieAnswerDays > 0 ? Math.round((count / calorieAnswerDays) * 100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-[10px] text-indigo-100/90">
                          <span>{calorieLabel[key]}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/15">
                          <div className="h-1.5 rounded-full bg-emerald-300" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <article className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Workout activity</p>
                <p className="mt-1 text-2xl font-black">{activityRate}%</p>
                <p className="text-xs text-indigo-100/90">Moderate / Strong ratio</p>
                <div className="mt-2 space-y-1">
                  {(Object.keys(activityCounts) as ActivityLevel[]).map((key) => {
                    const count = activityCounts[key];
                    const width = activityAnswerDays > 0 ? Math.round((count / activityAnswerDays) * 100) : 0;
                    return (
                      <div key={key}>
                        <div className="flex items-center justify-between text-[10px] text-indigo-100/90">
                          <span>{activityLabel[key]}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/15">
                          <div className="h-1.5 rounded-full bg-cyan-300" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <article className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Top task keywords</p>
                {taskKeywordRows.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {taskKeywordRows.map(([keyword, count]) => (
                      <div key={keyword}>
                        <div className="flex items-center justify-between text-[10px] text-indigo-100/90">
                          <span>{compactLabel(keyword)}</span>
                          <span>{count}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/15">
                          <div
                            className="h-1.5 rounded-full bg-indigo-200"
                            style={{ width: `${Math.round((count / maxTaskKeywordCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-indigo-100/80">Not enough task text to build keyword summary.</p>
                )}
              </article>

              <article className="rounded-xl bg-white/10 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-100">Wellness trend (last 7 check-ins)</p>
                {recentWellness.length > 0 ? (
                  <>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-indigo-100/90">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-300" />Activity</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" />Calorie</span>
                    </div>
                    <div className="mt-2 flex items-end gap-2">
                      {recentWellness.map((item) => (
                        <div className="flex flex-1 flex-col items-center" key={item.date}>
                          <div className="flex h-20 w-full items-end gap-1">
                            <div className="w-1/2 rounded-t bg-cyan-300" style={{ height: `${Math.max(4, item.activity)}%` }} />
                            <div className="w-1/2 rounded-t bg-emerald-300" style={{ height: `${Math.max(4, item.calories)}%` }} />
                          </div>
                          <span className="mt-1 text-[10px] text-indigo-100/90">{item.date}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-indigo-100/80">
                    No Q8/Q9 wellness answers yet. Once users submit check-ins, chart will appear.
                  </p>
                )}
              </article>
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Points trend (left old → right recent)
            </p>
            <div className="mt-3 flex items-end gap-1 overflow-x-auto pb-1">
              {trendRows.length > 0 ? (
                trendRows.map((entry) => {
                  const magnitude = Math.max(6, Math.round((Math.abs(entry.points) / maxAbsTrend) * 56));
                  const color = entry.points > 0 ? "bg-emerald-500" : entry.points < 0 ? "bg-rose-500" : "bg-slate-300";
                  return (
                    <div key={entry.date} className="flex w-10 shrink-0 flex-col items-center">
                      <span className="mb-1 text-[10px] font-semibold text-slate-500">
                        {entry.points > 0 ? `+${entry.points}` : entry.points}
                      </span>
                      <div className={`w-full rounded-t-md ${color}`} style={{ height: `${magnitude}px` }} />
                      <span className="mt-1 text-[10px] text-slate-500">{entry.date.slice(5)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No point events yet.</p>
              )}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{selectedRange} summary</p>
            <div className="mt-2 space-y-2">
              {periodRows.length > 0 ? (
                periodRows.map((row) => (
                  <div key={row.key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-slate-700">{row.label}</p>
                    <p className={`font-bold ${row.points >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {row.points >= 0 ? `+${row.points}` : row.points} pts
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No period data yet.</p>
              )}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Current month points calendar</p>
              <div className="flex items-center gap-2 text-[10px] font-semibold">
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">+ Earned</span>
                <span className="rounded-full bg-rose-100 px-2 py-1 text-rose-700">- Lost</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl bg-emerald-50 px-2 py-2 text-center text-emerald-800">
                <p className="font-bold">+{totalPlus}</p>
                <p className="text-[10px] uppercase tracking-[0.12em]">Earned</p>
              </div>
              <div className="rounded-xl bg-rose-50 px-2 py-2 text-center text-rose-700">
                <p className="font-bold">-{totalMinus}</p>
                <p className="text-[10px] uppercase tracking-[0.12em]">Lost</p>
              </div>
              <div className={`rounded-xl px-2 py-2 text-center ${totalNet >= 0 ? "bg-indigo-50 text-indigo-800" : "bg-amber-50 text-amber-800"}`}>
                <p className="font-bold">{totalNet >= 0 ? `+${totalNet}` : totalNet}</p>
                <p className="text-[10px] uppercase tracking-[0.12em]">Net</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="font-semibold">{label}</div>
              ))}
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-14 rounded-md bg-transparent" />;
                }
                const tone =
                  cell.stat.net > 0
                    ? "bg-emerald-100 text-emerald-800"
                    : cell.stat.net < 0
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500";
                return (
                  <button
                    key={cell.dateKey}
                    className={`h-14 rounded-md p-1 text-left transition hover:scale-[1.02] ${tone}`}
                    onClick={() => openDayModal(cell.dateKey)}
                    type="button"
                  >
                    <p className="text-[10px] font-semibold">{cell.day}</p>
                    <p className="text-[10px] font-bold">{cell.stat.net > 0 ? `+${cell.stat.net}` : cell.stat.net}</p>
                    {cell.stat.events > 0 && (
                      <p className="text-[9px] opacity-80">
                        +{cell.stat.plus}/-{cell.stat.minus}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Check-in answer digest</p>
            <p className="mt-1 text-xs text-slate-500">Most frequent answers at a glance for quick manager scan.</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {answerDigest.map((group) => {
                const top = group.rows[0];
                return (
                  <article className={`rounded-xl p-2 text-xs ring-1 ${group.cardClass}`} key={group.key}>
                    <p className="font-bold uppercase tracking-[0.12em] text-slate-600">
                      {group.icon} {group.title}
                    </p>
                    {top ? (
                      <>
                        <p className="mt-1 rounded-lg bg-white px-2 py-1 text-sm font-semibold text-slate-800">
                          {compactLabel(top[0])}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-600">Top answer count: {top[1]}</p>
                        <div className="mt-2 space-y-1">
                          {group.rows.slice(0, 3).map(([label, count]) => (
                            <div key={`${group.key}-${label}`} className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-slate-700">
                                <span className="truncate">{compactLabel(label)}</span>
                                <span className="font-semibold">{count}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/80">
                                <div
                                  className={`h-1.5 rounded-full ${group.barClass}`}
                                  style={{ width: `${Math.round((count / group.max) * 100)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="mt-1 text-slate-500">No answers yet.</p>
                    )}
                  </article>
                );
              })}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Recent reviewed submissions</p>
            <div className="mt-2 space-y-2">
              {recentReviewCards.length > 0 ? (
                recentReviewCards.map((submission) => (
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700" key={submission.id}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-indigo-900">{submission.date}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold ${
                            submission.status === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : submission.status === "rejected"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {submission.status.toUpperCase()}
                        </span>
                        <span className={`font-bold ${submission.points >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {submission.points >= 0 ? `+${submission.points}` : submission.points} pts
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        🙂 Mood: {compactLabel(submission.mood || "-")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          submission.productive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {submission.productive ? "✅ Productive" : "⚠️ Non-productive"}
                      </span>
                      <span className="rounded-full bg-cyan-100 px-2 py-1 text-[11px] font-semibold text-cyan-700">
                        🎯 Focus: {compactLabel(submission.focus || "-")}
                      </span>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-800">
                        🚧 Blocker: {compactLabel(submission.blocker || "-")}
                      </span>
                      <span className="rounded-full bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-700">
                        ✨ Need: {compactLabel(submission.win || "-")}
                      </span>
                    </div>

                    <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-slate-600">
                      <span className="font-semibold text-slate-500">Manager note:</span> {submission.managerNote || "-"}
                    </p>
                    {submission.bonus > 0 && (
                      <p className="mt-1 font-semibold text-amber-700">Bonus +{submission.bonus} pts</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No reviewed submissions yet.</p>
              )}
            </div>
          </article>
        </>
      ) : (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-600">No user data yet.</p>
      )}

      {activeDateKey && (
        <div className="fixed inset-0 z-[90] bg-slate-950/45 p-3" onClick={closeDayModal}>
          <div
            className="mx-auto mt-8 w-full max-w-lg rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Daily Snapshot</p>
                <h3 className="text-xl font-black text-indigo-900">{activeDateKey}</h3>
                <p className="text-xs text-slate-500">
                  Net {selectedDateStats.net >= 0 ? `+${selectedDateStats.net}` : selectedDateStats.net} pts • +{selectedDateStats.plus} / -{selectedDateStats.minus}
                </p>
              </div>
              <button
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                onClick={closeDayModal}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-3 rounded-full bg-slate-100 p-1 text-xs font-bold">
              <button
                className={`rounded-full px-3 py-1 ${activeDetailView === "list" ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600"}`}
                onClick={() => setActiveDetailView("list")}
                type="button"
              >
                Checklist
              </button>
              <button
                className={`rounded-full px-3 py-1 ${activeDetailView === "checkin" ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600"}`}
                onClick={() => setActiveDetailView("checkin")}
                type="button"
              >
                Check-in
              </button>
            </div>

            <div
              className="mt-3 rounded-2xl bg-slate-50 p-3"
              onTouchEnd={onDetailTouchEnd}
              onTouchStart={onDetailTouchStart}
            >
              {activeDetailView === "list" ? (
                selectedDateSubmissions.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDateSubmissions.map((submission) => {
                      const totalTasks = submission.task_list.length;
                      const estimatedCompleted = submission.productive ? totalTasks : Math.max(0, Math.round(totalTasks * 0.4));
                      const completionPct = totalTasks > 0 ? Math.round((estimatedCompleted / totalTasks) * 100) : 0;
                      return (
                        <article className="rounded-xl bg-white p-3" key={submission.id}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-indigo-900">{submission.status.toUpperCase()}</p>
                            <p className={`text-xs font-bold ${submission.productive ? "text-emerald-700" : "text-amber-700"}`}>
                              {submission.productive ? "Productive day" : "Needs follow-up"}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Tasks submitted {totalTasks} • Estimated completed {estimatedCompleted}
                          </p>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${completionPct}%` }} />
                          </div>
                          {totalTasks > 0 && (
                            <div className="mt-2 space-y-1">
                              {submission.task_list.slice(0, 4).map((task, idx) => (
                                <p className="text-xs text-slate-700" key={`${submission.id}-task-${idx}`}>• {compactLabel(task)}</p>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No checklist submission on this date.</p>
                )
              ) : latestSubmissionOnDate ? (
                <article className="space-y-2 rounded-xl bg-white p-3 text-sm">
                  <p className="rounded-lg bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700">
                    Swipe left/right to switch Checklist and Check-in
                  </p>
                  <p><span className="font-semibold text-slate-500">Mood:</span> {latestSubmissionOnDate.mood || "-"}</p>
                  <p><span className="font-semibold text-slate-500">Focus:</span> {latestSubmissionOnDate.custom_answers.focus || "-"}</p>
                  <p><span className="font-semibold text-slate-500">Blocker:</span> {latestSubmissionOnDate.custom_answers.blocker || "-"}</p>
                  <p><span className="font-semibold text-slate-500">Win/Need:</span> {latestSubmissionOnDate.custom_answers.win || "-"}</p>
                  <p><span className="font-semibold text-slate-500">Manager note:</span> {latestSubmissionOnDate.manager_note || "-"}</p>
                </article>
              ) : (
                <p className="text-sm text-slate-500">No check-in summary on this date.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
