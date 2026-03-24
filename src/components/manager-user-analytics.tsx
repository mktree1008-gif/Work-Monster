import { ScoreState, Submission } from "@/lib/types";

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
};

type PeriodRow = {
  key: string;
  label: string;
  points: number;
  submissions: number;
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

function currentMonthMatrix(pointsByDate: Map<string, number>) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startWeekday = first.getUTCDay();
  const leading = startWeekday === 0 ? 6 : startWeekday - 1;

  const cells: Array<{ day: number; dateKey: string; points: number } | null> = [];
  for (let i = 0; i < leading; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month, day));
    const dateKey = toDateKeyUTC(date);
    cells.push({
      day,
      dateKey,
      points: pointsByDate.get(dateKey) ?? 0
    });
  }

  return cells;
}

export function ManagerUserAnalytics({
  users,
  selectedUserId,
  selectedRange,
  submissions,
  score
}: Props) {
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? users[0];
  const reviewedEntries = submissions
    .filter((submission) => submission.status !== "pending")
    .map((submission) => ({
      id: submission.id,
      date: submission.date,
      points: submission.status === "approved" ? submission.points_awarded : 0,
      mood: submission.mood,
      productive: submission.productive,
      focus: submission.custom_answers.focus ?? "",
      status: submission.status
    }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  const pointsByDate = new Map<string, number>();
  reviewedEntries.forEach((entry) => {
    pointsByDate.set(entry.date, (pointsByDate.get(entry.date) ?? 0) + entry.points);
  });

  const trendRows = reviewedEntries.slice(-14);
  const maxAbsTrend = Math.max(1, ...trendRows.map((entry) => Math.abs(entry.points)));
  const periodRows = buildPeriodRows(reviewedEntries.map((item) => ({ date: item.date, points: item.points })), selectedRange);
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

  const moodCounts = new Map<string, number>();
  const focusCounts = new Map<string, number>();
  reviewedEntries.forEach((entry) => {
    moodCounts.set(entry.mood, (moodCounts.get(entry.mood) ?? 0) + 1);
    const key = entry.focus.trim() || "(No focus answer)";
    focusCounts.set(key, (focusCounts.get(key) ?? 0) + 1);
  });
  const moodRows = [...moodCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const focusRows = [...focusCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxMood = Math.max(1, ...moodRows.map((item) => item[1]), 1);
  const maxFocus = Math.max(1, ...focusRows.map((item) => item[1]), 1);

  const calendarCells = currentMonthMatrix(pointsByDate);

  return (
    <section className="card mb-4 p-4" id="user-analytics">
      <h2 className="text-xl font-black text-indigo-900">User History Analytics</h2>
      <p className="mt-1 text-sm text-slate-600">
        Select a user, then review all check-in answers, point flow, weekly/monthly averages, and calendar impact.
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
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Approval rate</p>
              <p className="font-bold text-indigo-900">{approvalRate}%</p>
              <p className="text-xs text-slate-500">{approvalCount} approved / {reviewedEntries.length} reviewed</p>
            </article>
            <article className="rounded-xl bg-slate-100 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Average points</p>
              <p className="font-bold text-indigo-900">{averagePointsPerSubmission} / submission</p>
              <p className="text-xs text-slate-500">{averagePointsByPeriod} / {selectedRange}</p>
            </article>
          </div>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Points trend (last 14 reviewed)</p>
            <div className="mt-3 flex items-end gap-1 overflow-x-auto pb-1">
              {trendRows.length > 0 ? (
                trendRows.map((entry) => {
                  const magnitude = Math.max(6, Math.round((Math.abs(entry.points) / maxAbsTrend) * 56));
                  const color = entry.points > 0 ? "bg-emerald-500" : entry.points < 0 ? "bg-rose-500" : "bg-slate-300";
                  return (
                    <div key={entry.id} className="flex w-7 shrink-0 flex-col items-center">
                      <span className="mb-1 text-[10px] font-semibold text-slate-500">
                        {entry.points > 0 ? `+${entry.points}` : entry.points}
                      </span>
                      <div className={`w-full rounded-t-md ${color}`} style={{ height: `${magnitude}px` }} />
                      <span className="mt-1 text-[10px] text-slate-500">{entry.date.slice(5)}</span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">No reviewed entries yet.</p>
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
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Current month points calendar</p>
            <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="font-semibold">{label}</div>
              ))}
              {calendarCells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-12 rounded-md bg-transparent" />;
                }
                const tone =
                  cell.points > 0
                    ? "bg-emerald-100 text-emerald-800"
                    : cell.points < 0
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-500";
                return (
                  <div key={cell.dateKey} className={`h-12 rounded-md p-1 ${tone}`}>
                    <p className="text-[10px] font-semibold">{cell.day}</p>
                    <p className="text-[10px]">{cell.points > 0 ? `+${cell.points}` : cell.points}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <div className="mt-3 grid grid-cols-1 gap-3">
            <article className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Mood distribution</p>
              <div className="mt-2 space-y-2">
                {moodRows.length > 0 ? (
                  moodRows.map(([label, count]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{label}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${Math.round((count / maxMood) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No mood answers yet.</p>
                )}
              </div>
            </article>

            <article className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Focus answer distribution</p>
              <div className="mt-2 space-y-2">
                {focusRows.length > 0 ? (
                  focusRows.map(([label, count]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="truncate">{label}</span>
                        <span>{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.round((count / maxFocus) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No focus answers yet.</p>
                )}
              </div>
            </article>
          </div>

          <article className="mt-3 rounded-2xl bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">All submission history</p>
            <div className="mt-2 space-y-2">
              {submissions.length > 0 ? (
                submissions.map((submission) => (
                  <div className="rounded-xl bg-white p-3 text-xs text-slate-700" key={submission.id}>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-indigo-900">{submission.date}</p>
                      <p
                        className={`font-bold ${
                          submission.status === "approved"
                            ? "text-emerald-700"
                            : submission.status === "rejected"
                              ? "text-rose-700"
                              : "text-amber-700"
                        }`}
                      >
                        {submission.status.toUpperCase()}
                      </p>
                    </div>
                    <p className="mt-1">Mood: {submission.mood} / Productive: {submission.productive ? "Yes" : "No"}</p>
                    <p>Focus: {submission.custom_answers.focus || "-"}</p>
                    <p>Blocker: {submission.custom_answers.blocker || "-"}</p>
                    <p>Win: {submission.custom_answers.win || "-"}</p>
                    <p className="mt-1 font-semibold text-indigo-800">
                      Points: {submission.status === "approved" ? (submission.points_awarded > 0 ? `+${submission.points_awarded}` : submission.points_awarded) : 0}
                    </p>
                    <p className="text-slate-500">Manager note: {submission.manager_note?.trim() || "-"}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No submission history yet.</p>
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
