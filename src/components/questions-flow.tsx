"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, CloudUpload, Link2, X } from "lucide-react";
import type { Locale, Submission, SubmissionStatus } from "@/lib/types";
import {
  buildAttachmentDownloadHref,
  describeAttachment,
  formatAttachmentSize,
  normalizeAttachmentTokens
} from "@/lib/attachments";
import { isISODateString } from "@/lib/utils";
import {
  DAILY_CHECKIN_QUESTIONS,
  DEFAULT_DAILY_CHECKIN_DRAFT,
  MANAGER_QUICK_MESSAGE_OPTIONS,
  QUICK_TAG_OPTIONS,
  findOptionLabel,
  findQuestionById,
  pickOptionLabel,
  type CheckInChoiceQuestionId,
  type DailyCheckInDraft
} from "@/lib/check-in-model";
import { calculateCheckInScore } from "@/lib/check-in-scoring";
import { AnswerChip } from "@/components/check-in/answer-chip";
import { QuestionCard } from "@/components/check-in/question-card";
import { CheckInSummaryCard } from "@/components/check-in/check-in-summary-card";

type Props = {
  locale: Locale;
  userId: string;
  readOnly?: boolean;
  initialSubmission?: Submission | null;
  selectedDate: string;
  maxSelectableDate: string;
};

type ApiResponse = {
  ok?: boolean;
  mode?: "created" | "updated";
  saveMode?: "draft" | "submit";
  redirectTo?: string;
  error?: string;
  code?: string;
};

type UploadAttachmentResponse = {
  ok?: boolean;
  attachment?: {
    token: string;
  };
  error?: string;
};

const TOTAL_QUESTIONS = DAILY_CHECKIN_QUESTIONS.length;
const FINAL_STEP_INDEX = TOTAL_QUESTIONS;
const TOTAL_STEPS = TOTAL_QUESTIONS + 1;
const STORAGE_PREFIX = "wm-checkin-v2-draft";

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|,|;/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function isEditableStatus(status: SubmissionStatus | ""): boolean {
  return status === "" || status === "draft" || status === "needs_revision";
}

function isWaitingReviewStatus(status: SubmissionStatus | ""): boolean {
  return status === "pending" || status === "submitted" || status === "in_review";
}

function progressPercent(step: number): number {
  if (step >= FINAL_STEP_INDEX) return 100;
  return Math.max(8, Math.round(((step + 1) / TOTAL_QUESTIONS) * 100));
}

function normalizeChoiceValue(questionId: CheckInChoiceQuestionId, raw: string): string {
  const question = findQuestionById(questionId);
  const options = question?.options ?? [];
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "";

  const byValue = options.find((option) => option.value === normalized);
  if (byValue) return byValue.value;

  const byLabel = options.find((option) => option.label.toLowerCase() === normalized);
  if (byLabel) return byLabel.value;

  const byEmojiLabel = options.find((option) => `${option.emoji} ${option.label}`.toLowerCase() === normalized);
  if (byEmojiLabel) return byEmojiLabel.value;

  return "";
}

function labelOf(questionId: CheckInChoiceQuestionId, value: string): string {
  return findOptionLabel(questionId, value);
}

function rawLabelOf(questionId: CheckInChoiceQuestionId, value: string): string {
  const question = findQuestionById(questionId);
  const option = question?.options?.find((item) => item.value === value);
  return option?.label ?? "";
}

function rawLabelsOf(questionId: CheckInChoiceQuestionId, values: string[]): string[] {
  return values
    .map((value) => rawLabelOf(questionId, value))
    .filter((label) => label.trim().length > 0);
}

function mapQ5ToLegacyRating(value: string): "poor" | "average" | "strong" | "peak" | "" {
  if (value === "poor") return "poor";
  if (value === "okay") return "average";
  if (value === "good") return "strong";
  if (value === "great") return "peak";
  return "";
}

function buildCoachInsight(draft: DailyCheckInDraft, totalScore: number): string {
  if (totalScore >= 85) {
    return "Your self-rating set a strong baseline today, and your reflection lifted it further. Keep tomorrow focused on one meaningful priority.";
  }
  if (totalScore >= 65) {
    return "This score reflects meaningful progress. Your self-rating set the baseline, while structure and wellness made gentle adjustments.";
  }
  if (draft.q6.includes("distractions")) {
    return "Distractions made today heavier, but your self-rating still anchors your result. A short no-notification focus block tomorrow can help.";
  }
  if (draft.q6.includes("stress_mood")) {
    return "Stress affected execution today. Your self-rating remains the baseline, so try a lighter plan and one must-do task tomorrow.";
  }
  return "Your self-rating sets today's baseline. Use this check-in to choose one small, kind reset for tomorrow.";
}

function normalizeInitialDraft(initialSubmission?: Submission | null): DailyCheckInDraft {
  if (!initialSubmission) return { ...DEFAULT_DAILY_CHECKIN_DRAFT };

  const fromAnswers = initialSubmission.custom_answers ?? {};

  const next = { ...DEFAULT_DAILY_CHECKIN_DRAFT };

  const q1Raw = String(fromAnswers.q1 ?? "");
  const q2Raw = String(fromAnswers.q2 ?? "");
  const q3Raw = String(fromAnswers.q3 ?? "");
  const q4Raw = String(fromAnswers.q4 ?? "");
  const q5Raw = String(fromAnswers.q5 ?? "");
  const q6Raw = String(fromAnswers.q6 ?? "");
  const q7Raw = String(fromAnswers.q7 ?? "");
  const q8Raw = String(fromAnswers.q8 ?? "");
  const q9Raw = String(fromAnswers.q9 ?? "");
  const q10Raw = Number(fromAnswers.q10 ?? fromAnswers.self_score ?? 7);

  const q5Legacy = String(initialSubmission.self_productivity_rating ?? "").toLowerCase();
  const legacyQ5 = q5Legacy === "poor"
    ? "poor"
    : q5Legacy === "average"
      ? "okay"
      : q5Legacy === "strong"
        ? "good"
        : q5Legacy === "peak"
          ? "great"
          : "";

  next.q1 = normalizeChoiceValue("q1", q1Raw) || (initialSubmission.completed_top_priorities ? "most" : "");
  next.q2 = normalizeChoiceValue("q2", q2Raw) || (initialSubmission.worked_on_high_impact ? "yes" : "");
  next.q3 = normalizeChoiceValue("q3", q3Raw);
  next.q4 = normalizeChoiceValue("q4", q4Raw);
  next.q5 = normalizeChoiceValue("q5", q5Raw) || legacyQ5;
  const q6Candidates = [
    ...parseStringList(q6Raw),
    ...parseStringList(fromAnswers.blocker ?? ""),
    ...parseStringList(initialSubmission.primary_productivity_factor ?? "")
  ];
  next.q6 = dedupe(
    q6Candidates
      .map((item) => normalizeChoiceValue("q6", item))
      .filter(Boolean)
  );
  next.q7 = normalizeChoiceValue("q7", q7Raw);
  next.q8 = normalizeChoiceValue("q8", q8Raw);
  next.q9 = normalizeChoiceValue("q9", q9Raw);
  next.q10 = Number.isFinite(q10Raw) ? Math.max(1, Math.min(10, Math.round(q10Raw))) : 7;
  next.blocker_other = String(fromAnswers.blocker_other ?? initialSubmission.primary_productivity_factor_note ?? "").trim();
  next.quick_tag = String(fromAnswers.quick_tag ?? "").trim();
  next.work_note = String(fromAnswers.work_note ?? initialSubmission.completed_work_summary ?? "").trim();
  next.manager_message = String(fromAnswers.manager_message ?? initialSubmission.tomorrow_improvement_note ?? "").trim();
  next.manager_quick_message = String(fromAnswers.manager_quick_message ?? "").trim();
  next.evidence_files = dedupe(
    normalizeAttachmentTokens(
      initialSubmission.evidence_files?.length ? initialSubmission.evidence_files : parseStringList(fromAnswers.evidence_files)
    )
      .map((item) => String(item).trim())
      .filter(Boolean)
  );
  next.evidence_links = dedupe(
    (initialSubmission.evidence_links?.length ? initialSubmission.evidence_links : parseStringList(fromAnswers.evidence_links))
      .map((item) => String(item).trim())
      .filter(Boolean)
  );

  return next;
}

export function QuestionsFlow({
  locale,
  userId,
  readOnly = false,
  initialSubmission = null,
  selectedDate,
  maxSelectableDate
}: Props) {
  const router = useRouter();
  const isKo = locale === "ko";
  const initialStatus = (initialSubmission?.status ?? "") as SubmissionStatus | "";
  const lockedByStatus = !isEditableStatus(initialStatus);
  const waitingReview = isWaitingReviewStatus(initialStatus);

  const [currentStep, setCurrentStep] = useState(0);
  const [clientTimeZone, setClientTimeZone] = useState("UTC");
  const [clientLocalDate, setClientLocalDate] = useState(selectedDate);
  const [draft, setDraft] = useState<DailyCheckInDraft>({ ...DEFAULT_DAILY_CHECKIN_DRAFT });
  const [hydrated, setHydrated] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alreadyDoneMessage, setAlreadyDoneMessage] = useState("");
  const [showAlreadyDonePopup, setShowAlreadyDonePopup] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [isTextFieldFocused, setIsTextFieldFocused] = useState(false);

  const initialLoadedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const skipAutosaveOnceRef = useRef(false);

  const score = useMemo(() => calculateCheckInScore(draft), [draft]);

  const selectedDateLabel = useMemo(() => {
    if (!isISODateString(clientLocalDate)) {
      return isKo ? "날짜 선택" : "Select date";
    }
    const parsed = new Date(`${clientLocalDate}T12:00:00.000Z`);
    if (!Number.isFinite(parsed.getTime())) {
      return clientLocalDate;
    }
    return new Intl.DateTimeFormat(isKo ? "ko-KR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      timeZone: "UTC"
    }).format(parsed);
  }, [clientLocalDate, isKo]);

  const storageKey = useMemo(
    () => (clientLocalDate ? `${STORAGE_PREFIX}-${userId}-${clientLocalDate}` : ""),
    [clientLocalDate, userId]
  );

  const canEdit = !readOnly && !lockedByStatus;
  const currentQuestion = currentStep < TOTAL_QUESTIONS ? DAILY_CHECKIN_QUESTIONS[currentStep] : null;

  const stepValid = useMemo(() => {
    if (currentStep >= FINAL_STEP_INDEX) return true;
    if (!currentQuestion) return false;

    if (currentQuestion.id === "q10") {
      return Number.isFinite(draft.q10) && draft.q10 >= 1 && draft.q10 <= 10;
    }

    if (currentQuestion.id === "q6") {
      return draft.q6.length > 0;
    }

    const key = currentQuestion.id as CheckInChoiceQuestionId;
    return String(draft[key] ?? "").trim().length > 0;
  }, [currentQuestion, currentStep, draft]);

  const summaryRows = useMemo(
    () => [
      { label: "Plan completion", value: labelOf("q1", draft.q1) },
      { label: "Main task result", value: labelOf("q2", draft.q2) },
      { label: "Focus level", value: labelOf("q4", draft.q4) },
      { label: "Productivity level", value: labelOf("q5", draft.q5) },
      {
        label: "Blocker",
        value: (() => {
          const blockerLabel = rawLabelsOf("q6", draft.q6).join(", ") || "-";
          return draft.blocker_other.trim()
            ? `${blockerLabel} + ${draft.blocker_other.trim()}`
            : blockerLabel;
        })()
      },
      {
        label: "Sleep / Activity / Food",
        value: `${labelOf("q7", draft.q7)} / ${labelOf("q8", draft.q8)} / ${labelOf("q9", draft.q9)}`
      },
      { label: "Self score", value: `${draft.q10}/10` }
    ],
    [draft]
  );

  const evidenceFileItems = useMemo(
    () => draft.evidence_files.map((token) => describeAttachment(token)),
    [draft.evidence_files]
  );

  useEffect(() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      setClientTimeZone(timeZone);
    } catch {
      setClientTimeZone("UTC");
    }
  }, []);

  useEffect(() => {
    setClientLocalDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!storageKey || initialLoadedRef.current) return;

    const merged = normalizeInitialDraft(initialSubmission);
    let savedStep = Number(initialSubmission?.step_index ?? 1) - 1;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { draft?: Partial<DailyCheckInDraft>; step?: number };
        if (parsed?.draft && typeof parsed.draft === "object") {
          Object.assign(merged, {
            ...parsed.draft,
            q6: dedupe(parseStringList(parsed.draft.q6)),
            evidence_files: dedupe(normalizeAttachmentTokens(parseStringList(parsed.draft.evidence_files))),
            evidence_links: dedupe(parseStringList(parsed.draft.evidence_links))
          });
        }
        if (Number.isFinite(parsed?.step)) {
          savedStep = Math.max(0, Math.min(TOTAL_STEPS - 1, Math.round(parsed.step ?? 0)));
        }
      }
    } catch {
      // ignore broken local storage payload
    }

    setDraft(merged);
    setCurrentStep(Math.max(0, Math.min(TOTAL_STEPS - 1, savedStep)));
    setHydrated(true);
    initialLoadedRef.current = true;
  }, [initialSubmission, storageKey]);

  useEffect(() => {
    if (currentStep !== FINAL_STEP_INDEX) {
      setAnimatedScore(score.total);
      return;
    }

    setAnimatedScore(score.baseScore);
    if (score.total <= score.baseScore) {
      return;
    }
    let current = score.baseScore;
    const timer = window.setInterval(() => {
      current += Math.max(1, Math.ceil((score.total - current) / 6));
      if (current >= score.total) {
        current = score.total;
        window.clearInterval(timer);
      }
      setAnimatedScore(current);
    }, 28);

    return () => window.clearInterval(timer);
  }, [currentStep, score.baseScore, score.total]);

  const persist = useCallback(async (mode: "draft" | "submit"): Promise<ApiResponse | null> => {
    if (!canEdit) return null;

    const blockerLabel = rawLabelsOf("q6", draft.q6).join(", ");
    const blockerDetail = draft.blocker_other.trim();
    const blockerSummary = blockerLabel && blockerDetail
      ? `${blockerLabel} / ${blockerDetail}`
      : blockerDetail || blockerLabel;

    const quickTagLabel = pickOptionLabel(QUICK_TAG_OPTIONS, draft.quick_tag);
    const managerQuickLabel = pickOptionLabel(MANAGER_QUICK_MESSAGE_OPTIONS, draft.manager_quick_message);
    const coachInsight = buildCoachInsight(draft, score.total);

    const payload = {
      save_mode: mode,
      mood: rawLabelOf("q5", draft.q5) || "Okay",
      feeling: rawLabelOf("q1", draft.q1),
      focus: rawLabelOf("q4", draft.q4),
      blocker: blockerSummary,
      win: draft.work_note.trim(),
      calories: 0,
      productive: draft.q5 === "good" || draft.q5 === "great",
      task_list: [quickTagLabel !== "-" ? quickTagLabel : "", draft.work_note.trim()].filter(Boolean).join("\n"),
      file_url: draft.evidence_links[0] ?? "",
      step_index: currentStep + 1,
      feeling_state: rawLabelOf("q1", draft.q1),
      primary_productivity_factor: blockerLabel,
      primary_productivity_factor_note: blockerDetail,
      completed_top_priorities: draft.q1 === "most" || draft.q1 === "almost_all",
      worked_on_high_impact: draft.q2 === "yes" || draft.q2 === "partly",
      avoided_low_value_work: draft.q4 === "strong",
      self_productivity_rating: mapQ5ToLegacyRating(draft.q5),
      tomorrow_improvement_focus: managerQuickLabel === "-" ? quickTagLabel : managerQuickLabel,
      tomorrow_improvement_note: draft.manager_message,
      completed_work_summary: draft.work_note,
      mission_tags: quickTagLabel === "-" ? [] : [quickTagLabel],
      evidence_files: draft.evidence_files,
      evidence_links: draft.evidence_links,
      performance_score_preview: score.total,
      coach_insight_text: coachInsight,
      top_focus_summary: rawLabelOf("q4", draft.q4),
      energy_peak_summary: `${rawLabelOf("q7", draft.q7)} / ${rawLabelOf("q8", draft.q8)}`,
      client_time_zone: clientTimeZone,
      client_local_date: clientLocalDate,
      custom_answers: {
        q1: draft.q1,
        q2: draft.q2,
        q3: draft.q3,
        q4: draft.q4,
        q5: draft.q5,
        q6: draft.q6.join(","),
        q7: draft.q7,
        q8: draft.q8,
        q9: draft.q9,
        q10: String(draft.q10),
        quick_tag: draft.quick_tag,
        blocker_other: draft.blocker_other,
        work_note: draft.work_note,
        manager_message: draft.manager_message,
        manager_quick_message: draft.manager_quick_message,
        evidence_files: draft.evidence_files.join("\n"),
        evidence_links: draft.evidence_links.join("\n"),
        focus: rawLabelOf("q4", draft.q4),
        blocker: blockerSummary,
        win: draft.work_note.trim()
      }
    };

    const response = await fetch("/api/submissions/check-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = (await response.json()) as ApiResponse;

    if (!response.ok) {
      if (response.status === 409 && result.code === "already_submitted") {
        setAlreadyDoneMessage(
          result.error
            ?? (isKo
              ? "선택한 날짜의 Daily Check-in은 이미 제출됐어요. 매니저 리뷰 결과를 확인해 주세요."
              : "Check-in for the selected date is already submitted. Please review the manager result.")
        );
        setShowAlreadyDonePopup(true);
        return null;
      }
      throw new Error(result.error ?? "Failed to save check-in.");
    }

    setSubmitError("");
    return result;
  }, [canEdit, clientLocalDate, clientTimeZone, currentStep, draft, isKo, score.total]);

  useEffect(() => {
    if (!hydrated || !storageKey || !canEdit || isStepSaving || submitting) return;

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          step: currentStep,
          savedAt: Date.now(),
          draft
        })
      );
    } catch {
      // ignore storage error
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    if (skipAutosaveOnceRef.current) {
      skipAutosaveOnceRef.current = false;
      return;
    }

    if (isTextFieldFocused) {
      return;
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        setIsAutoSaving(true);
        await persist("draft");
      } catch {
        // autosave failures should not block UX
      } finally {
        setIsAutoSaving(false);
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canEdit, currentStep, draft, hydrated, isStepSaving, isTextFieldFocused, persist, storageKey, submitting]);

  function patchDraft(next: Partial<DailyCheckInDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setSubmitError("");
  }

  async function onFilesSelected(event: ChangeEvent<HTMLInputElement>, source: "image" | "file") {
    const inputEl = event.currentTarget;
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const accepted = source === "image"
      ? files.filter((file) => file.type.startsWith("image/"))
      : files;

    if (accepted.length === 0) {
      inputEl.value = "";
      return;
    }

    setUploadingAttachment(true);
    setSubmitError("");
    try {
      const uploadedTokens: string[] = [];
      for (const file of accepted) {
        const body = new FormData();
        body.append("file", file);
        body.append("source", source);

        const response = await fetch("/api/uploads/check-in", {
          method: "POST",
          body
        });
        const result = (await response.json()) as UploadAttachmentResponse;
        if (!response.ok || !result.attachment?.token) {
          throw new Error(result.error ?? "Failed to upload attachment.");
        }
        uploadedTokens.push(result.attachment.token);
      }

      setDraft((prev) => ({
        ...prev,
        evidence_files: dedupe(normalizeAttachmentTokens([...prev.evidence_files, ...uploadedTokens])).slice(0, 24)
      }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Attachment upload failed.");
    } finally {
      setUploadingAttachment(false);
    }
    inputEl.value = "";
  }

  function removeAttachment(token: string) {
    patchDraft({ evidence_files: draft.evidence_files.filter((item) => item !== token) });
  }

  function addEvidenceLink() {
    const input = window.prompt("Add attachment link", "https://");
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    patchDraft({ evidence_links: dedupe([...draft.evidence_links, trimmed]) });
  }

  function removeEvidenceLink(link: string) {
    patchDraft({ evidence_links: draft.evidence_links.filter((item) => item !== link) });
  }

  async function goNext() {
    if (!stepValid || currentStep >= TOTAL_STEPS - 1) return;
    skipAutosaveOnceRef.current = true;
    setCurrentStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));

    if (canEdit) {
      try {
        setIsStepSaving(true);
        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        await persist("draft");
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Autosave failed.");
      } finally {
        setIsStepSaving(false);
      }
    }
  }

  async function onCheckInDateChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value.trim();
    if (!isISODateString(raw)) return;

    const nextDate = raw > maxSelectableDate ? maxSelectableDate : raw;
    if (nextDate === clientLocalDate) return;

    if (canEdit && hydrated) {
      try {
        setIsStepSaving(true);
        if (autosaveTimerRef.current) {
          window.clearTimeout(autosaveTimerRef.current);
          autosaveTimerRef.current = null;
        }
        await persist("draft");
      } catch {
        // keep navigation flow even if draft save fails
      } finally {
        setIsStepSaving(false);
      }
    }

    setClientLocalDate(nextDate);
    const nextPath = nextDate === maxSelectableDate
      ? "/app/questions/check-in"
      : `/app/questions/check-in?date=${encodeURIComponent(nextDate)}`;
    router.replace(nextPath);
  }

  async function onSubmitToManager() {
    if (!canEdit || currentStep !== FINAL_STEP_INDEX) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await persist("submit");
      if (!result) return;
      if (storageKey) {
        window.localStorage.removeItem(storageKey);
      }
      setShowSubmitSuccess(true);
      setTimeout(() => {
        router.replace(result.redirectTo ?? "/app/welcome?saved=1");
      }, 920);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  const dateSelectionPanel = (
    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-2">
      <div className="flex items-center justify-between gap-2">
        <p className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-[0.1em] text-blue-700">
          <CalendarDays size={13} />
          Check-in date
        </p>
        <p className="hidden truncate text-[11px] font-semibold text-slate-500 sm:block">{selectedDateLabel}</p>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          className="input h-8 w-full rounded-lg border-slate-200 bg-white py-1.5 text-[13px]"
          disabled={submitting || isStepSaving || uploadingAttachment}
          max={maxSelectableDate}
          onChange={onCheckInDateChange}
          type="date"
          value={clientLocalDate}
        />
      </div>
    </div>
  );

  if (readOnly) {
    return (
      <section className="space-y-3">
        {dateSelectionPanel}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Manager preview mode: submission save is disabled.
        </div>
      </section>
    );
  }

  if (lockedByStatus) {
    return (
      <section className="space-y-4">
        {dateSelectionPanel}
        <article className="rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm">
          <p className="text-caption font-bold uppercase tracking-[0.16em] text-blue-700">Daily Check-in Status</p>
          <h2 className="mt-2 text-section-title font-black text-slate-900">
            {waitingReview ? "Submitted to manager" : initialStatus === "approved" ? "Approved" : "Review completed"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {waitingReview
              ? "You cannot edit this check-in while manager review is in progress."
              : initialStatus === "needs_revision"
                ? "Manager requested revision. You can edit and submit again."
                : "This check-in has been finalized."}
          </p>
          <div className="mt-4 flex gap-2">
            <Link className="btn btn-primary" href="/app/welcome">Back to Home</Link>
            <Link className="btn btn-muted" href="/app/record">View history</Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="relative -mx-4 min-h-[calc(100dvh-6.4rem)] bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-4 pb-[calc(5.4rem+var(--safe-bottom))] pt-1 sm:mx-0 sm:rounded-[2rem] sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/60 bg-white/85 px-4 pb-2 pt-1 backdrop-blur sm:mx-0 sm:-mt-2 sm:rounded-t-[2rem] sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <Link className="rounded-full p-2 text-blue-700 hover:bg-blue-50" href="/app/welcome">
            <X size={20} />
          </Link>
          <h1 className="whitespace-nowrap text-base font-black tracking-[-0.01em] text-slate-900">Daily Check-in</h1>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
            {currentStep < FINAL_STEP_INDEX ? `Q${currentStep + 1}/${TOTAL_QUESTIONS}` : "Summary"}
          </span>
        </div>

        <div className="mt-1.5">{dateSelectionPanel}</div>

        <div className="mt-1.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>{currentStep < FINAL_STEP_INDEX ? `Question ${currentStep + 1}` : "Final review"}</span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block min-w-[6.1rem] text-right">
                {isAutoSaving ? "Auto-saving..." : "Draft saved"}
              </span>
              <span>{progressPercent(currentStep)}%</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent(currentStep)}%` }}
            />
          </div>
        </div>
      </header>

      {currentQuestion && currentQuestion.type === "choice" && (
        <QuestionCard
          description={currentQuestion.description}
          progressLabel={`${currentStep + 1}/${TOTAL_QUESTIONS}`}
          progressPercent={progressPercent(currentStep)}
          title={currentQuestion.title}
        >
          {currentQuestion.id === "q6" && (
            <p className="mb-2 text-xs font-semibold text-slate-400">다중 선택 가능</p>
          )}
          <div className="grid grid-cols-1 gap-2">
            {currentQuestion.options?.map((option) => {
              const key = currentQuestion.id as CheckInChoiceQuestionId;
              const selected = currentQuestion.id === "q6"
                ? draft.q6.includes(option.value)
                : draft[key] === option.value;
              return (
                <AnswerChip
                  emoji={option.emoji}
                  key={option.value}
                  label={option.label}
                  onClick={() => {
                    if (currentQuestion.id === "q6") {
                      const next = draft.q6.includes(option.value)
                        ? draft.q6.filter((item) => item !== option.value)
                        : dedupe([...draft.q6, option.value]);
                      patchDraft({ q6: next });
                      return;
                    }
                    patchDraft({ [key]: option.value } as Partial<DailyCheckInDraft>);
                  }}
                  selected={selected}
                />
              );
            })}
          </div>

          {currentQuestion.id === "q6" && (
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Other blocker (optional)
              <input
                className="input mt-2"
                onChange={(event) => patchDraft({ blocker_other: event.target.value })}
                onBlur={() => setIsTextFieldFocused(false)}
                onFocus={() => setIsTextFieldFocused(true)}
                placeholder="Add context if needed"
                value={draft.blocker_other}
              />
            </label>
          )}
        </QuestionCard>
      )}

      {currentQuestion?.id === "q10" && (
        <QuestionCard
          description={currentQuestion.description}
          progressLabel={`${currentStep + 1}/${TOTAL_QUESTIONS}`}
          progressPercent={progressPercent(currentStep)}
          title={currentQuestion.title}
        >
          <article className="rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Self score</p>
              <p className="text-2xl font-black text-blue-700 tabular-nums">{draft.q10}</p>
            </div>
            <input
              className="mt-3 h-2 w-full cursor-pointer accent-blue-600"
              max={10}
              min={1}
              onChange={(event) => patchDraft({ q10: Number(event.target.value) })}
              step={1}
              type="range"
              value={draft.q10}
            />
            <div className="mt-2 flex justify-between text-xs font-semibold text-slate-500">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </article>
        </QuestionCard>
      )}

      {currentStep === FINAL_STEP_INDEX && (
        <QuestionCard
          description="Review your report before sending it to your manager"
          progressLabel="Final"
          progressPercent={100}
          title="Final Summary"
        >
          <CheckInSummaryCard
            animatedScore={animatedScore}
            attachmentCount={draft.evidence_files.length + draft.evidence_links.length}
            noteFilled={draft.work_note.trim().length > 0 || draft.manager_message.trim().length > 0}
            rows={summaryRows}
            score={score}
          />

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Quick Tag</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {QUICK_TAG_OPTIONS.map((option) => (
                <AnswerChip
                  className="py-2"
                  emoji={option.emoji}
                  key={option.value}
                  label={option.label}
                  onClick={() => patchDraft({ quick_tag: option.value })}
                  selected={draft.quick_tag === option.value}
                />
              ))}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Message to manager (quick)</p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {MANAGER_QUICK_MESSAGE_OPTIONS.map((option) => (
                <AnswerChip
                  className="py-2"
                  emoji={option.emoji}
                  key={option.value}
                  label={option.label}
                  onClick={() => patchDraft({ manager_quick_message: option.value })}
                  selected={draft.manager_quick_message === option.value}
                />
              ))}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
            <label className="block text-sm font-semibold text-slate-700">
              What did you work on today?
              <textarea
                className="input mt-2 min-h-24 resize-none"
                onChange={(event) => patchDraft({ work_note: event.target.value })}
                onBlur={() => setIsTextFieldFocused(false)}
                onFocus={() => setIsTextFieldFocused(true)}
                placeholder="Write a short work summary"
                value={draft.work_note}
              />
            </label>

            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Message to your manager
              <textarea
                className="input mt-2 min-h-20 resize-none"
                onChange={(event) => patchDraft({ manager_message: event.target.value })}
                onBlur={() => setIsTextFieldFocused(false)}
                onFocus={() => setIsTextFieldFocused(true)}
                placeholder="Optional message"
                value={draft.manager_message}
              />
            </label>
          </article>

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.05]">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">Attachments</p>
            <p className="mt-1 text-xs text-slate-500">Upload files/images up to 100MB each.</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                <span className="inline-flex items-center gap-2"><CloudUpload size={14} /> Add image</span>
                <input
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAttachment}
                  multiple
                  onChange={(event) => onFilesSelected(event, "image")}
                  type="file"
                />
              </label>
              <label className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                <span className="inline-flex items-center gap-2"><CloudUpload size={14} /> Add file</span>
                <input className="hidden" disabled={uploadingAttachment} multiple onChange={(event) => onFilesSelected(event, "file")} type="file" />
              </label>
              <button
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
                disabled={uploadingAttachment}
                onClick={addEvidenceLink}
                type="button"
              >
                <span className="inline-flex items-center gap-2"><Link2 size={14} /> Add link</span>
              </button>
            </div>
            {uploadingAttachment && (
              <p className="mt-2 text-xs font-semibold text-blue-700">Uploading attachment...</p>
            )}

            {draft.evidence_files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {evidenceFileItems.map((item, idx) => {
                  return (
                    <li className="rounded-xl bg-slate-50 p-2" key={`${item.token}-${idx}`}>
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                        <div className="min-w-0">
                          <p className="truncate">{item.name}</p>
                          {item.size > 0 && <p className="text-[10px] text-slate-500">{formatAttachmentSize(item.size)}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {item.url && (
                            <a
                              className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-indigo-700"
                              download={item.name}
                              href={buildAttachmentDownloadHref(item.url, item.name)}
                            >
                              Download
                            </a>
                          )}
                          <button
                            className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
                            onClick={() => removeAttachment(item.token)}
                            type="button"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      {item.kind === "image" && item.url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={item.name} className="mt-2 h-24 w-full rounded-lg object-cover" src={item.url} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {draft.evidence_links.length > 0 && (
              <ul className="mt-3 space-y-1">
                {draft.evidence_links.map((link) => (
                  <li className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5" key={link}>
                    <span className="truncate text-xs text-slate-700">{link}</span>
                    <button className="text-[10px] font-bold text-slate-500" onClick={() => removeEvidenceLink(link)} type="button">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </QuestionCard>
      )}

      {submitError && (
        <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
          {submitError}
        </div>
      )}

      {showAlreadyDonePopup && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4">
          <article className="anim-pop w-full max-w-sm rounded-[1.6rem] bg-white p-5 text-center shadow-xl">
            <p className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-2xl">🗓️</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Already submitted</h3>
            <p className="mt-2 text-sm text-slate-600">{alreadyDoneMessage}</p>
            <button className="btn btn-primary mt-4 w-full" onClick={() => setShowAlreadyDonePopup(false)} type="button">Close</button>
          </article>
        </div>
      )}

      {showSubmitSuccess && (
        <div className="fixed inset-0 z-[86] flex items-center justify-center bg-slate-950/45 p-4">
          <article className="anim-pop w-full max-w-sm rounded-[1.6rem] bg-white p-5 text-center shadow-xl">
            <p className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-3xl anim-bounce-soft">🎉</p>
            <h3 className="mt-2 text-xl font-black text-slate-900">Submitted to manager</h3>
            <p className="mt-2 text-sm text-slate-600">Your manager will review this report soon.</p>
          </article>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/60 bg-white/90 px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between gap-3">
          <button
            className="inline-flex min-w-[6.4rem] items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-[13px] font-semibold text-slate-700 disabled:opacity-45"
            disabled={currentStep === 0 || submitting}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            type="button"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              className="inline-flex min-w-[8.3rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_22px_rgba(37,99,235,0.32)] disabled:opacity-45"
              disabled={!stepValid || submitting || isStepSaving || uploadingAttachment}
              onClick={goNext}
              type="button"
            >
              Next
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="inline-flex min-w-[11.4rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_12px_22px_rgba(5,150,105,0.32)] disabled:opacity-45"
              disabled={submitting || uploadingAttachment}
              onClick={onSubmitToManager}
              type="button"
            >
              {submitting ? "Submitting..." : "Submit to Manager"}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </nav>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-14 right-0 h-64 w-64 rounded-full bg-cyan-100/45 blur-[90px]" />
        <div className="absolute bottom-8 left-0 h-56 w-56 rounded-full bg-emerald-100/30 blur-[90px]" />
      </div>

      <div aria-live="polite" className="sr-only">{isAutoSaving ? "Auto-saving draft" : "Draft saved"}</div>
    </section>
  );
}
