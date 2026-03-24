"use client";

import { useMemo, useState } from "react";
import { ChibiAvatar } from "@/components/chibi-avatar";

type AlertItem = {
  claimId: string;
  userDisplay: string;
  rewardTitle: string;
  rewardPoints: number;
  claimedAt?: string;
};

type Props = {
  alerts: AlertItem[];
  action: (formData: FormData) => Promise<void>;
};

export function ManagerClaimAlertsModal({ alerts, action }: Props) {
  const [open, setOpen] = useState(alerts.length > 0);
  const claimIds = useMemo(() => alerts.map((item) => item.claimId).join(","), [alerts]);

  if (!open || alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="container-mobile card anim-pop p-5">
        <div className="mb-3 flex items-center justify-center gap-2">
          <ChibiAvatar className="anim-bounce-soft" emotion="alert" role="manager" size={56} />
          <span className="text-xl">🔔</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">Manager To-do</p>
        <h3 className="mt-1 text-2xl font-black text-indigo-900">User reward claim requests</h3>
        <p className="mt-1 text-sm text-slate-600">Users claimed rewards. Please review these requests.</p>

        <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto">
          {alerts.map((item) => (
            <li key={item.claimId} className="rounded-xl bg-indigo-50 p-3 text-sm">
              <p className="font-bold text-indigo-900">{item.userDisplay}</p>
              <p className="text-indigo-700">
                🎁 {item.rewardTitle} ({item.rewardPoints} pts)
              </p>
              {item.claimedAt && <p className="text-xs text-indigo-500">{new Date(item.claimedAt).toLocaleString()}</p>}
            </li>
          ))}
        </ul>

        <form action={action} className="mt-4">
          <input name="claim_ids" type="hidden" value={claimIds} />
          <button className="btn btn-primary w-full" type="submit">
            확인했어요 (알림 닫기)
          </button>
        </form>
        <button className="btn btn-muted mt-2 w-full" onClick={() => setOpen(false)} type="button">
          잠시 후 보기
        </button>
      </div>
    </div>
  );
}
