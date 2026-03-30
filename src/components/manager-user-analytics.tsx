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

export function ManagerUserAnalytics({
  users,
  selectedUserId,
  selectedRange,
  submissions,
  score,
  auditLogs
}: Props) {
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0];
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission] as const));

  const reviewedEntries = submissions
    .filter((submission) => submission.status !== "pending")
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
                  <div key={cell.dateKey} className={`h-14 rounded-md p-1 ${tone}`}>
                    <p className="text-[10px] font-semibold">{cell.day}</p>
                    <p className="text-[10px] font-bold">{cell.stat.net > 0 ? `+${cell.stat.net}` : cell.stat.net}</p>
                    {cell.stat.events > 0 && (
                      <p className="text-[9px] opacity-80">
                        +{cell.stat.plus}/-{cell.stat.minus}
                      </p>
                    )}
                  </div>
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
    </section>
  );
}
