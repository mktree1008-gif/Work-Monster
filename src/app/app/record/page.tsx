import { UserPageShell } from "@/components/user-page-shell";
import { formatDateLabel } from "@/lib/utils";
import { getViewerContext } from "@/lib/view-model";

export default async function RecordPage() {
  const { bundle, strings } = await getViewerContext();
  const recent = bundle.submissions.slice(0, 7);
  const approved = recent.filter((item) => item.status === "approved");
  const avgCalories =
    recent.length > 0 ? Math.round(recent.reduce((sum, item) => sum + item.calories, 0) / recent.length) : 0;

  return (
    <UserPageShell activeTab="record" labels={strings} subtitle="Your momentum map" title="Record">
      <section className="grid grid-cols-2 gap-3">
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Avg calories</p>
          <p className="mt-2 text-3xl font-black text-indigo-900">{avgCalories}</p>
        </article>
        <article className="card p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Approved this week</p>
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
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Submission history</p>
        <ul className="mt-3 space-y-2">
          {bundle.submissions.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm">
              <span>{formatDateLabel(item.date)}</span>
              <span className="font-semibold">
                {item.status === "approved" ? `+${item.points_awarded} pts` : item.status}
              </span>
            </li>
          ))}
          {bundle.submissions.length === 0 && <li className="text-sm text-slate-500">No submissions yet.</li>}
        </ul>
      </section>
    </UserPageShell>
  );
}
