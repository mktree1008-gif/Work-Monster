"use client";

import { useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { reviewSubmissionAction } from "@/lib/services/actions";
import { ChibiAvatar } from "@/components/chibi-avatar";

type Props = {
  submissionId: string;
  defaultPoints: number;
  mood: string;
  productive: boolean;
  taskSummary: string;
};

type Decision = "true" | "false";

export function SubmissionReviewForm({ submissionId, defaultPoints, mood, productive, taskSummary }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const recommendedDecision: Decision = defaultPoints < 0 ? "false" : "true";
  const [decision, setDecision] = useState<Decision>(recommendedDecision);
  const [pointsInput, setPointsInput] = useState(String(defaultPoints));
  const [bonusInput, setBonusInput] = useState("0");
  const [bonusMessageInput, setBonusMessageInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const parsedPoints = Number(pointsInput);
  const safePoints = Number.isFinite(parsedPoints) ? Math.round(parsedPoints) : 0;
  const parsedBonus = Number(bonusInput);
  const safeBonus = Number.isFinite(parsedBonus) ? Math.max(0, Math.round(parsedBonus)) : 0;
  const rejectPathPoints = Math.min(0, safePoints);
  const rejectPathTotal = rejectPathPoints + safeBonus;
  const giveSelected = decision === "true";
  const penaltySelected = decision === "false";

  function openConfirm(nextDecision: Decision) {
    if (submitting) return;
    setDecision(nextDecision);
    setConfirmOpen(true);
  }

  function closeConfirm() {
    if (submitting) return;
    setConfirmOpen(false);
  }

  function submitAfterConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setConfirmOpen(false);
    requestAnimationFrame(() => {
      formRef.current?.requestSubmit();
    });
  }

  return (
    <>
      <form action={reviewSubmissionAction} className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4" ref={formRef}>
        <input name="submission_id" type="hidden" value={submissionId} />
        <input name="approved" type="hidden" value={decision} />
        <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700">
          Final score update = adjustment points + bonus points. Bonus can be used with both Give Points and No / Penalty.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={`btn w-full ${giveSelected ? "btn-primary" : "btn-muted"} ${giveSelected ? "ring-2 ring-indigo-200" : ""}`}
            disabled={submitting}
            onClick={() => openConfirm("true")}
            type="button"
          >
            {submitting ? "Processing..." : `Give Points${recommendedDecision === "true" ? " (Recommended)" : ""}`}
          </button>
          <button
            className={`btn w-full ${penaltySelected ? "btn-primary" : "btn-muted"} ${penaltySelected ? "ring-2 ring-indigo-200" : ""}`}
            disabled={submitting}
            onClick={() => openConfirm("false")}
            type="button"
          >
            {submitting ? "Processing..." : `No / Penalty${recommendedDecision === "false" ? " (Recommended)" : ""}`}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
            Adjustment points
            <input
              className="input mt-1"
              disabled={submitting}
              name="points"
              onChange={(event) => setPointsInput(event.target.value)}
              type="number"
              value={pointsInput}
            />
          </label>
          <label className="rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
            Bonus points
            <input
              className="input mt-1"
              disabled={submitting}
              min={0}
              name="bonus_points"
              onChange={(event) => setBonusInput(event.target.value)}
              placeholder="0"
              type="number"
              value={bonusInput}
            />
          </label>
        </div>

        <label className="block rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
          Reason / short comment
          <input className="input mt-1" disabled={submitting} name="note" placeholder="Reason / short comment" />
        </label>

        <label className="block rounded-xl bg-slate-50 p-2 text-xs font-semibold text-slate-600">
          Bonus message (only when bonus &gt; 0)
          <input
            className="input mt-1"
            disabled={submitting}
            maxLength={180}
            name="bonus_message"
            onChange={(event) => setBonusMessageInput(event.target.value)}
            placeholder="Bonus message (optional)"
            type="text"
            value={bonusMessageInput}
          />
        </label>

        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
          <span>
            Rule suggestion (adjustment):{" "}
            <strong className="text-indigo-800">
              {defaultPoints > 0 ? `+${defaultPoints}` : defaultPoints} pts
            </strong>
          </span>
          <button
            className="rounded-full bg-white px-3 py-1 font-semibold text-indigo-700 ring-1 ring-indigo-100"
            disabled={submitting}
            onClick={() => setPointsInput(String(defaultPoints))}
            type="button"
          >
            Use suggestion
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Mood: {mood} • Productive: {productive ? "Yes" : "No"} • Tasks: {taskSummary || "-"}
        </p>
        {submitting && <p className="text-xs text-indigo-700">Review is being submitted. Please wait...</p>}
      </form>

      {confirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4">
          <div className="container-mobile card anim-pop p-5">
            <div className="mb-3 flex items-center justify-center gap-2">
              <ChibiAvatar className="anim-bounce-soft" emotion="approval" role="manager" size={54} />
              <span className="anim-pulse-soft text-xl">{decision === "true" ? "✅" : "📝"}</span>
              <ChibiAvatar className="anim-float" emotion="encouraging" role="user" size={54} />
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Review confirmation</p>
            <h3 className="mt-1 text-xl font-black text-indigo-900">
              {decision === "true"
                ? "Apply this score to submission?"
                : rejectPathTotal !== 0
                  ? `Apply ${rejectPathTotal > 0 ? `+${rejectPathTotal}` : rejectPathTotal} pts and mark as no?`
                  : "Submit as no-points review?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Mood: {mood} • Productive: {productive ? "Yes" : "No"}
            </p>
            <p className="text-sm text-slate-600">Tasks: {taskSummary || "-"}</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-800">
              <Sparkles size={14} />
              {decision === "true"
                ? `Score input: ${safePoints > 0 ? `+${safePoints}` : safePoints} pts${safeBonus > 0 ? ` + bonus ${safeBonus}` : ""}`
                : rejectPathTotal !== 0
                  ? `No/Penalty path: ${rejectPathPoints > 0 ? `+${rejectPathPoints}` : rejectPathPoints} pts${safeBonus > 0 ? ` + bonus ${safeBonus}` : ""}`
                  : "Submission will be marked as no points"}
            </p>
            {safeBonus > 0 && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                🎁 Bonus surprise enabled. User will get a gift-style popup.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn btn-muted w-full" disabled={submitting} onClick={closeConfirm} type="button">
                Cancel
              </button>
              <button className="btn btn-primary w-full" disabled={submitting} onClick={submitAfterConfirm} type="button">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
