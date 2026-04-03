import type { ButtonHTMLAttributes } from "react";

type Props = {
  emoji: string;
  label: string;
  selected?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function AnswerChip({ emoji, label, selected = false, className = "", ...rest }: Props) {
  return (
    <button
      className={`w-full rounded-full border px-4 py-3 text-left transition ${
        selected
          ? "border-blue-500 bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.28)]"
          : "border-slate-200 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50"
      } ${className}`}
      type="button"
      {...rest}
    >
      <span className="flex items-center gap-3">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-lg ${selected ? "bg-white/20" : "bg-slate-100"}`}>
          {emoji}
        </span>
        <span className="text-sm font-bold tracking-[-0.01em]">{label}</span>
      </span>
    </button>
  );
}
