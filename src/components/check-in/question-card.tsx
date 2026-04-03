import type { ReactNode } from "react";

type Props = {
  title: string;
  description: string;
  progressLabel: string;
  progressPercent: number;
  children: ReactNode;
};

export function QuestionCard({
  title,
  description,
  progressLabel,
  progressPercent,
  children
}: Props) {
  return (
    <article className="mt-3 rounded-[1.6rem] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Daily Check-in</p>
          <h2 className="mt-1 text-[clamp(1.25rem,6.4vw,1.7rem)] font-black leading-tight text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-600">{description}</p>
        </div>
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{progressLabel}</span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4">{children}</div>
    </article>
  );
}
