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
  const [decision, setDecision] = useState<Decision>("true");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      <form action={reviewSubmissionAction} className="mt-3 grid grid-cols-2 gap-2" ref={formRef}>
        <input name="submission_id" type="hidden" value={submissionId} />
        <input name="approved" type="hidden" value={decision} />
        <input className="input col-span-2" disabled={submitting} name="note" placeholder="Optional note" />
        <input className="input" defaultValue={defaultPoints} disabled={submitting} name="points" type="number" />
        <div className="col-span-2 grid grid-cols-2 gap-2">
          <button
            className="btn btn-primary w-full"
            disabled={submitting}
            onClick={() => openConfirm("true")}
            type="button"
          >
            {submitting ? "Processing..." : "Give Points"}
          </button>
          <button
            className="btn btn-muted w-full"
            disabled={submitting}
            onClick={() => openConfirm("false")}
            type="button"
          >
            {submitting ? "Processing..." : "No"}
          </button>
        </div>
        {submitting && <p className="col-span-2 text-xs text-indigo-700">Review is being submitted. Please wait...</p>}
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
              {decision === "true" ? "Give points to this submission?" : "Submit without points?"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Mood: {mood} • Productive: {productive ? "Yes" : "No"}
            </p>
            <p className="text-sm text-slate-600">Tasks: {taskSummary || "-"}</p>
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-sm font-semibold text-indigo-800">
              <Sparkles size={14} />
              {decision === "true" ? "Points will be applied after confirm" : "Submission will be marked as no points"}
            </p>

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
