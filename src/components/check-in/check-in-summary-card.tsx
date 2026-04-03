import type { CheckInScoreBreakdown } from "@/lib/check-in-scoring";

type SummaryRow = {
  label: string;
  value: string;
};

type Props = {
  animatedScore: number;
  score: CheckInScoreBreakdown;
  rows: SummaryRow[];
  noteFilled: boolean;
  attachmentCount: number;
};

export function CheckInSummaryCard({
  animatedScore,
  score,
  rows,
  noteFilled,
  attachmentCount
}: Props) {
  return (
    <article className="rounded-[1.6rem] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.1)] ring-1 ring-black/[0.04]">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Summary</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-5xl font-black text-blue-700 tabular-nums">
            {animatedScore}
            <span className="text-2xl text-blue-300">/100</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Auto-calculated daily score</p>
        </div>
        <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">
          <p>Plan: {score.planExecution}/40</p>
          <p>Productivity: {score.productivity}/25</p>
          <p>Wellness: {score.wellness}/20</p>
          <p>Penalty: -{score.blockerPenalty}</p>
          <p>Adjustment: {score.selfAdjustment >= 0 ? `+${score.selfAdjustment}` : score.selfAdjustment}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2">
        {rows.map((item) => (
          <div className="rounded-xl bg-slate-50 px-3 py-2" key={item.label}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
            <p className="mt-1 text-sm font-semibold text-slate-800">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
        <p>Notes: {noteFilled ? "Added" : "Not added"}</p>
        <p>Attachments: {attachmentCount > 0 ? `${attachmentCount} added` : "None"}</p>
      </div>
    </article>
  );
}
