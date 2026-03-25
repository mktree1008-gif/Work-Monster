"use client";

import { useState } from "react";
import { ChibiAvatar } from "@/components/chibi-avatar";
import { Locale, ManagerUpdateNotification } from "@/lib/types";

type Props = {
  updates: ManagerUpdateNotification[];
  action: (formData: FormData) => Promise<void>;
  locale: Locale;
};

function iconByKind(kind: ManagerUpdateNotification["kind"]): string {
  if (kind === "rule_update") return "📘";
  if (kind === "reward_update") return "🎁";
  return "✅";
}

export function UserManagerUpdatesModal({ updates, action, locale }: Props) {
  const [open, setOpen] = useState(updates.length > 0);
  const isKo = locale === "ko";

  if (!open || updates.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[71] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="container-mobile card anim-pop p-5">
        <div className="mb-3 flex items-center justify-center gap-2">
          <ChibiAvatar className="anim-float" emotion="approval" role="manager" size={56} />
          <span className="text-xl">💌</span>
          <ChibiAvatar className="anim-bounce-soft" emotion="excited" role="user" size={56} />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Manager Updates</p>
        <h3 className="mt-1 text-2xl font-black text-indigo-900">
          {isKo ? "새로운 변경사항이 있어요" : "There are new updates"}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          {isKo ? "매니저가 점수/룰/리워드를 업데이트했습니다." : "Manager updated points, rules, or rewards."}
        </p>

        <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
          {updates.map((item) => (
            <li key={item.id} className="rounded-xl bg-indigo-50 p-3 text-sm">
              <p className="font-bold text-indigo-900">
                {iconByKind(item.kind)} {item.title}
              </p>
              <p className="text-indigo-700">{item.message}</p>
              {(item.bonus_points ?? 0) > 0 && (
                <p className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                  🎁 Bonus +{item.bonus_points}
                </p>
              )}
              <p className="text-xs text-indigo-500">{new Date(item.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>

        <form action={action} className="mt-4">
          <button className="btn btn-primary w-full" type="submit">
            {isKo ? "확인하고 시작하기" : "Acknowledge and continue"}
          </button>
        </form>
        <button className="btn btn-muted mt-2 w-full" onClick={() => setOpen(false)} type="button">
          {isKo ? "잠시 후 보기" : "View later"}
        </button>
      </div>
    </div>
  );
}
