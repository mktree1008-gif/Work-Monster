import { CalendarDays } from "lucide-react";
import { CharacterAlert } from "@/components/character-alert";
import { getManagerCue } from "@/lib/character-system";
import { UserPageShell } from "@/components/user-page-shell";
import { formatDateLabel, toISODate } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function shiftISODate(baseISO: string, offsetDays: number): string {
  const date = new Date(`${baseISO}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function calendarCellClass(delta: number): string {
  if (delta >= 10) return "bg-emerald-500 text-white";
  if (delta > 0) return "bg-emerald-200 text-emerald-900";
  if (delta <= -10) return "bg-rose-500 text-white";
  if (delta < 0) return "bg-rose-200 text-rose-900";
  return "bg-slate-100 text-slate-500";
}

export default async function RecordPage({ searchParams }: Props) {
  const { bundle, strings } = await getViewerContext();
  const params = (searchParams ? await searchParams : {}) as Record<string, string | string[] | undefined>;
  const focusSubmissionId = typeof params.focus === "string" ? params.focus : "";
  const recent = bundle.submissions.slice(0, 7);
  const approved = recent.filter((item) => item.status === "approved");
  const avgCalories =
    recent.length > 0 ? Math.round(recent.reduce((sum, item) => sum + item.calories, 0) / recent.length) : 0;
  const managerCue = getManagerCue("record_approval", bundle.user.locale);
  const todayISO = toISODate();
  const latestSubmissionDate = bundle.submissions[0]?.date ?? todayISO;
  const calendarEndDate = latestSubmissionDate > todayISO ? latestSubmissionDate : todayISO;
  const calendarDays = Array.from({ length: 28 }, (_, index) => shiftISODate(calendarEndDate, index - 27));
  const pointsByDate = bundle.submissions.reduce<Record<string, number>>((acc, submission) => {
    const delta = submission.status === "pending" ? 0 : submission.points_awarded;
    acc[submission.date] = (acc[submission.date] ?? 0) + delta;
    return acc;
  }, {});

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Your momentum map" title="Record">
      <section className="grid grid-cols-2 gap-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">💰 Avg calories</p>
          <p className="mt-2 text-3xl font-black text-indigo-900">{avgCalories}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">🔥 Approved this week</p>
          <p className="mt-2 text-3xl font-black text-indigo-900">{approved.length}</p>
        </article>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Productivity bars</p>
        <div className="mt-3 flex items-end gap-2">
          {recent.map((item) => (
            <div key={item.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-xl ${item.productive ? "bg-emerald-500" : "bg-amber-400"}`}
                style={{ height: `${item.productive ? 80 : 45}px` }}
              />
              <span className="text-[10px] text-slate-500">{formatDateLabel(item.date)}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-sm text-slate-500">No check-in history yet.</p>}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-indigo-600" size={18} />
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Points calendar</p>
        </div>
        <p className="mt-2 text-sm text-slate-600">Green = earned points, Red = lost points</p>
        <div className="mt-3 grid grid-cols-7 gap-2">
          {calendarDays.map((date) => {
            const delta = pointsByDate[date] ?? 0;
            const day = Number(date.slice(8, 10));
            return (
              <div
                key={date}
                className={`rounded-xl p-2 text-center ${calendarCellClass(delta)}`}
                title={`${date}: ${delta > 0 ? `+${delta}` : delta} pts`}
              >
                <p className="text-[11px] font-bold">{day}</p>
                <p className="text-[10px]">{delta > 0 ? `+${delta}` : delta}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card mt-4 p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submission history</p>
        <ul className="mt-3 space-y-2">
          {bundle.submissions.slice(0, 10).map((item) => (
            <li
              className={`rounded-xl bg-slate-100 px-3 py-2 text-sm ${focusSubmissionId === item.id ? "ring-2 ring-indigo-400" : ""}`}
              id={`submission-${item.id}`}
              key={item.id}
            >
              <div className="flex items-center justify-between">
                <span>{formatDateLabel(item.date)}</span>
                <span className="font-semibold">
                  {item.status === "pending"
                    ? "pending"
                    : item.points_awarded !== 0
                      ? `${item.points_awarded > 0 ? `+${item.points_awarded}` : item.points_awarded} pts`
                      : `${item.status} • 0 pts`}
                </span>
              </div>
              {item.status !== "pending" && (
                <div className="mt-2">
                  <CharacterAlert role="manager" cue={managerCue} compact tone={item.points_awarded < 0 ? "warning" : "success"} />
                  {(item.bonus_points_awarded ?? 0) > 0 && (
                    <p className="mt-1 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                      🎁 Bonus +{item.bonus_points_awarded} {item.bonus_message?.trim() ? `• ${item.bonus_message}` : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
          {bundle.submissions.length === 0 && <li className="text-sm text-slate-500">No submissions yet.</li>}
        </ul>
      </section>
    </UserPageShell>
  );
}
