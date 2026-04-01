"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BatteryLow,
  Bolt,
  Check,
  CheckCircle2,
  Circle,
  CloudUpload,
  Eye,
  Flame,
  ListChecks,
  Sparkles,
  Target,
  Waves,
  X
} from "lucide-react";
import type { Locale, Submission, SubmissionStatus } from "@/lib/types";

type Props = {
  locale: Locale;
  readOnly?: boolean;
  initialSubmission?: Submission | null;
};

type CheckInDraft = {
  feeling_state: string;
  primary_productivity_factor: string;
  primary_productivity_factor_note: string;
  completed_top_priorities: boolean;
  worked_on_high_impact: boolean;
  avoided_low_value_work: boolean;
  self_productivity_rating: "poor" | "average" | "strong" | "peak" | "";
  tomorrow_improvement_focus: string;
  tomorrow_improvement_note: string;
  quick_completed_work: string[];
  completed_work_summary: string;
  mission_tags: string[];
  evidence_files: string[];
  evidence_links: string[];
};

type AttachmentPreview = {
  id: string;
  name: string;
  previewUrl?: string;
  isImage: boolean;
};

type ApiResponse = {
  ok?: boolean;
  mode?: "created" | "updated";
  saveMode?: "draft" | "submit";
  redirectTo?: string;
  error?: string;
  code?: string;
};

const TOTAL_STEPS = 7;
const STORAGE_PREFIX = "wm-checkin-draft";

const FEELING_OPTIONS = [
  { key: "focused_ready", label: "Focused and ready", icon: "⚡" },
  { key: "steady_low_energy", label: "Steady but low energy", icon: "🔋" },
  { key: "overwhelmed", label: "Overwhelmed", icon: "🌊" },
  { key: "distracted", label: "Distracted", icon: "🫧" }
] as const;

const PRODUCTIVITY_FACTORS = [
  "Sleep / recovery",
  "Energy level",
  "Distractions",
  "Workload",
  "Lack of clarity",
  "Communication / feedback",
  "Other"
] as const;

const EXECUTION_ITEMS = [
  {
    key: "completed_top_priorities",
    title: "Completed top priorities",
    desc: "You tackled the most critical items on your list today."
  },
  {
    key: "worked_on_high_impact",
    title: "Worked on high-impact tasks",
    desc: "Your effort moved the needle on long-term goals."
  },
  {
    key: "avoided_low_value_work",
    title: "Avoided low-value work",
    desc: "You stayed disciplined and avoided busywork distractions."
  }
] as const;

const PRODUCTIVITY_RATINGS = [
  { key: "poor", label: "Poor", emoji: "😞", desc: "I struggled to make progress." },
  { key: "average", label: "Average", emoji: "🙂", desc: "I made some progress." },
  { key: "strong", label: "Strong", emoji: "😎", desc: "I tackled most tasks efficiently." },
  { key: "peak", label: "Peak", emoji: "🔥", desc: "I delivered at my highest level." }
] as const;

const TOMORROW_FOCUS_OPTIONS = [
  { key: "Start earlier", label: "Start earlier", desc: "Seize the morning energy", icon: "⏰" },
  { key: "Focus on fewer tasks", label: "Focus on fewer tasks", desc: "Trim down and execute deeply", icon: "🎯" },
  { key: "Reduce distractions", label: "Reduce distractions", desc: "Protect focus blocks", icon: "🚫" },
  { key: "Plan more clearly", label: "Plan more clearly", desc: "Turn intent into concrete actions", icon: "🗺️" },
  { key: "Improve energy", label: "Improve energy", desc: "Sleep/recovery and rhythm first", icon: "⚡" }
] as const;

const QUICK_WORK_CHIPS = [
  "Finished a priority task",
  "Worked on mission-aligned item",
  "Resolved blocker",
  "Delivered collaboration output",
  "Prepared tomorrow plan"
] as const;

const MISSION_TAGS = ["High-Impact", "Collaboration", "Technical", "Strategic"] as const;

const QUICK_EVIDENCE = ["Screenshot attached", "PR / commit link", "Document update", "Meeting notes"] as const;

const DEFAULT_DRAFT: CheckInDraft = {
  feeling_state: "",
  primary_productivity_factor: "",
  primary_productivity_factor_note: "",
  completed_top_priorities: false,
  worked_on_high_impact: false,
  avoided_low_value_work: false,
  self_productivity_rating: "",
  tomorrow_improvement_focus: "",
  tomorrow_improvement_note: "",
  quick_completed_work: [],
  completed_work_summary: "",
  mission_tags: [],
  evidence_files: [],
  evidence_links: []
};

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function isEditableStatus(status: SubmissionStatus | ""): boolean {
  return status === "" || status === "draft" || status === "needs_revision";
}

function isWaitingReviewStatus(status: SubmissionStatus | ""): boolean {
  return status === "pending" || status === "submitted" || status === "in_review";
}

function normalizeInitialDraft(initialSubmission?: Submission | null): CheckInDraft {
  if (!initialSubmission) return { ...DEFAULT_DRAFT };

  const fromAnswers = initialSubmission.custom_answers ?? {};
  const quickCompletedFromAnswers = parseStringList(fromAnswers.quick_completed_work);
  const missionTagsFromAnswers = parseStringList(fromAnswers.mission_tags);
  const evidenceLinksFromAnswers = parseStringList(fromAnswers.evidence_links);
  const evidenceFilesFromAnswers = parseStringList(fromAnswers.evidence_files);

  return {
    feeling_state:
      (initialSubmission.feeling_state ?? fromAnswers.feeling_state ?? initialSubmission.feeling ?? "").trim(),
    primary_productivity_factor:
      (initialSubmission.primary_productivity_factor ?? fromAnswers.primary_productivity_factor ?? "").trim(),
    primary_productivity_factor_note:
      (initialSubmission.primary_productivity_factor_note ?? fromAnswers.primary_productivity_factor_note ?? "").trim(),
    completed_top_priorities:
      typeof initialSubmission.completed_top_priorities === "boolean"
        ? initialSubmission.completed_top_priorities
        : String(fromAnswers.completed_top_priorities ?? "").toLowerCase() === "true",
    worked_on_high_impact:
      typeof initialSubmission.worked_on_high_impact === "boolean"
        ? initialSubmission.worked_on_high_impact
        : String(fromAnswers.worked_on_high_impact ?? "").toLowerCase() === "true",
    avoided_low_value_work:
      typeof initialSubmission.avoided_low_value_work === "boolean"
        ? initialSubmission.avoided_low_value_work
        : String(fromAnswers.avoided_low_value_work ?? "").toLowerCase() === "true",
    self_productivity_rating: (
      initialSubmission.self_productivity_rating
      ?? fromAnswers.self_productivity_rating
      ?? ""
    ).toLowerCase() as CheckInDraft["self_productivity_rating"],
    tomorrow_improvement_focus:
      (initialSubmission.tomorrow_improvement_focus ?? fromAnswers.tomorrow_improvement_focus ?? "").trim(),
    tomorrow_improvement_note:
      (initialSubmission.tomorrow_improvement_note ?? fromAnswers.tomorrow_improvement_note ?? "").trim(),
    quick_completed_work:
      (initialSubmission.task_list?.length ? initialSubmission.task_list : quickCompletedFromAnswers)
        .map((item) => String(item).trim())
        .filter(Boolean),
    completed_work_summary:
      (initialSubmission.completed_work_summary ?? fromAnswers.completed_work_summary ?? "").trim(),
    mission_tags:
      (initialSubmission.mission_tags?.length ? initialSubmission.mission_tags : missionTagsFromAnswers)
        .map((item) => String(item).trim())
        .filter(Boolean),
    evidence_files:
      (initialSubmission.evidence_files?.length ? initialSubmission.evidence_files : evidenceFilesFromAnswers)
        .map((item) => String(item).trim())
        .filter(Boolean),
    evidence_links:
      (initialSubmission.evidence_links?.length ? initialSubmission.evidence_links : evidenceLinksFromAnswers)
        .map((item) => String(item).trim())
        .filter(Boolean)
  };
}

function computePreviewScore(draft: CheckInDraft): number {
  let total = 0;
  if (draft.completed_top_priorities) total += 25;
  if (draft.worked_on_high_impact) total += 25;
  if (draft.avoided_low_value_work) total += 15;

  const ratingScore: Record<Exclude<CheckInDraft["self_productivity_rating"], "">, number> = {
    poor: 5,
    average: 10,
    strong: 20,
    peak: 25
  };

  if (draft.self_productivity_rating) {
    total += ratingScore[draft.self_productivity_rating] ?? 0;
  }

  const hasWorkSummary =
    draft.completed_work_summary.trim().length > 0 || draft.quick_completed_work.length > 0;
  if (hasWorkSummary) total += 10;

  const hasEvidence =
    draft.mission_tags.length > 0 || draft.evidence_files.length > 0 || draft.evidence_links.length > 0;
  if (hasEvidence) total += 10;

  return Math.min(100, total);
}

function buildTopFocusSummary(draft: CheckInDraft): string {
  if (draft.tomorrow_improvement_focus.trim().length > 0) {
    return draft.tomorrow_improvement_focus;
  }
  if (draft.worked_on_high_impact) return "High-impact execution";
  if (draft.completed_top_priorities) return "Priority completion";
  return "Consistency building";
}

function buildEnergyPeakSummary(draft: CheckInDraft): string {
  if (draft.feeling_state === "Focused and ready") return "10:30 AM - High";
  if (draft.feeling_state === "Steady but low energy") return "2:10 PM - Moderate";
  if (draft.feeling_state === "Overwhelmed") return "Recovery mode - Protect focus";
  if (draft.feeling_state === "Distracted") return "Late afternoon - Fragmented";
  return "No signal yet";
}

function buildCoachInsight(draft: CheckInDraft): string {
  if (draft.worked_on_high_impact && draft.self_productivity_rating === "peak") {
    return "Your high-impact focus was excellent today. Repeat the same execution pattern tomorrow.";
  }
  if (draft.completed_top_priorities && draft.self_productivity_rating === "strong") {
    return "Solid consistency today. Keep your priorities narrow and protect your deep-work windows.";
  }
  if (!draft.completed_top_priorities && draft.primary_productivity_factor) {
    return `You identified '${draft.primary_productivity_factor}' as the key blocker. Build one guardrail for it tomorrow.`;
  }
  return "You're building awareness through reflection. Keep choosing one concrete improvement each day.";
}

function progressPercent(step: number): number {
  return Math.max(14, Math.round(((step + 1) / TOTAL_STEPS) * 100));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

export function QuestionsFlow({ locale, readOnly = false, initialSubmission = null }: Props) {
  const router = useRouter();
  const isKo = locale === "ko";
  const initialStatus = (initialSubmission?.status ?? "") as SubmissionStatus | "";
  const lockedByStatus = !isEditableStatus(initialStatus);
  const waitingReview = isWaitingReviewStatus(initialStatus);

  const [currentStep, setCurrentStep] = useState(0);
  const [clientTimeZone, setClientTimeZone] = useState("UTC");
  const [clientLocalDate, setClientLocalDate] = useState("");
  const [draft, setDraft] = useState<CheckInDraft>({ ...DEFAULT_DRAFT });
  const [hydrated, setHydrated] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [isStepSaving, setIsStepSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [alreadyDoneMessage, setAlreadyDoneMessage] = useState("");
  const [showAlreadyDonePopup, setShowAlreadyDonePopup] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreview[]>([]);
  const initialLoadedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const skipAutosaveOnceRef = useRef(false);

  const previewScore = useMemo(() => computePreviewScore(draft), [draft]);
  const topFocusSummary = useMemo(() => buildTopFocusSummary(draft), [draft]);
  const energyPeakSummary = useMemo(() => buildEnergyPeakSummary(draft), [draft]);
  const coachInsightText = useMemo(() => buildCoachInsight(draft), [draft]);

  const storageKey = useMemo(
    () => (clientLocalDate ? `${STORAGE_PREFIX}-${clientLocalDate}` : ""),
    [clientLocalDate]
  );

  const canEdit = !readOnly && !lockedByStatus;

  const stepValid = useMemo(() => {
    if (currentStep === 0) {
      return draft.feeling_state.trim().length > 0;
    }
    if (currentStep === 1) {
      return draft.primary_productivity_factor.trim().length > 0;
    }
    if (currentStep === 2) {
      return draft.completed_top_priorities || draft.worked_on_high_impact || draft.avoided_low_value_work;
    }
    if (currentStep === 3) {
      return draft.self_productivity_rating.trim().length > 0;
    }
    if (currentStep === 4) {
      return draft.tomorrow_improvement_focus.trim().length > 0;
    }
    if (currentStep === 5) {
      return (
        draft.quick_completed_work.length > 0
        || draft.mission_tags.length > 0
        || draft.evidence_files.length > 0
        || draft.evidence_links.length > 0
        || draft.completed_work_summary.trim().length > 0
      );
    }
    return true;
  }, [currentStep, draft]);

  useEffect(() => {
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).formatToParts(new Date());
      const year = parts.find((part) => part.type === "year")?.value;
      const month = parts.find((part) => part.type === "month")?.value;
      const day = parts.find((part) => part.type === "day")?.value;
      setClientTimeZone(timeZone);
      setClientLocalDate(year && month && day ? `${year}-${month}-${day}` : "");
    } catch {
      setClientTimeZone("UTC");
      setClientLocalDate("");
    }
  }, []);

  useEffect(() => {
    if (!storageKey || initialLoadedRef.current) return;

    const merged: CheckInDraft = { ...normalizeInitialDraft(initialSubmission) };
    let savedStep = Number(initialSubmission?.step_index ?? 1) - 1;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { draft?: Partial<CheckInDraft>; step?: number };
        if (parsed?.draft && typeof parsed.draft === "object") {
          Object.assign(merged, {
            ...parsed.draft,
            quick_completed_work: dedupe(parseStringList(parsed.draft.quick_completed_work)),
            mission_tags: dedupe(parseStringList(parsed.draft.mission_tags)),
            evidence_files: dedupe(parseStringList(parsed.draft.evidence_files)),
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
    return () => {
      for (const preview of attachmentPreviews) {
        if (preview.previewUrl) {
          URL.revokeObjectURL(preview.previewUrl);
        }
      }
    };
  }, [attachmentPreviews]);

  const persist = useCallback(async (mode: "draft" | "submit"): Promise<ApiResponse | null> => {
    if (!canEdit) return null;

    const selectedFlags = {
      completed_top_priorities: draft.completed_top_priorities,
      worked_on_high_impact: draft.worked_on_high_impact,
      avoided_low_value_work: draft.avoided_low_value_work
    };

    const productive = draft.self_productivity_rating === "strong" || draft.self_productivity_rating === "peak";
    const composedWorkSummary = draft.completed_work_summary.trim().length > 0
      ? draft.completed_work_summary.trim()
      : draft.quick_completed_work.join("; ");

    const payload = {
      save_mode: mode,
      mood: draft.self_productivity_rating || "Average",
      feeling: draft.feeling_state,
      focus: topFocusSummary,
      blocker: draft.primary_productivity_factor,
      win: composedWorkSummary,
      calories: 0,
      productive,
      task_list: draft.quick_completed_work.join("\n"),
      file_url: draft.evidence_links[0] ?? "",
      step_index: currentStep + 1,
      feeling_state: draft.feeling_state,
      primary_productivity_factor: draft.primary_productivity_factor,
      primary_productivity_factor_note: draft.primary_productivity_factor_note,
      completed_top_priorities: selectedFlags.completed_top_priorities,
      worked_on_high_impact: selectedFlags.worked_on_high_impact,
      avoided_low_value_work: selectedFlags.avoided_low_value_work,
      self_productivity_rating: draft.self_productivity_rating,
      tomorrow_improvement_focus: draft.tomorrow_improvement_focus,
      tomorrow_improvement_note: draft.tomorrow_improvement_note,
      completed_work_summary: composedWorkSummary,
      mission_tags: draft.mission_tags,
      evidence_files: draft.evidence_files,
      evidence_links: draft.evidence_links,
      performance_score_preview: previewScore,
      coach_insight_text: coachInsightText,
      top_focus_summary: topFocusSummary,
      energy_peak_summary: energyPeakSummary,
      client_time_zone: clientTimeZone,
      client_local_date: clientLocalDate,
      custom_answers: {
        focus: topFocusSummary,
        blocker: draft.primary_productivity_factor,
        win: composedWorkSummary,
        feeling_state: draft.feeling_state,
        primary_productivity_factor: draft.primary_productivity_factor,
        primary_productivity_factor_note: draft.primary_productivity_factor_note,
        completed_top_priorities: String(draft.completed_top_priorities),
        worked_on_high_impact: String(draft.worked_on_high_impact),
        avoided_low_value_work: String(draft.avoided_low_value_work),
        self_productivity_rating: draft.self_productivity_rating,
        tomorrow_improvement_focus: draft.tomorrow_improvement_focus,
        tomorrow_improvement_note: draft.tomorrow_improvement_note,
        completed_work_summary: composedWorkSummary,
        quick_completed_work: draft.quick_completed_work.join("\n"),
        mission_tags: draft.mission_tags.join(","),
        evidence_files: draft.evidence_files.join("\n"),
        evidence_links: draft.evidence_links.join("\n")
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
              ? "오늘 Daily Check-in은 이미 제출됐어요. 매니저 리뷰 결과를 확인해 주세요."
              : "Today's check-in is already submitted. Please review the manager result.")
        );
        setShowAlreadyDonePopup(true);
        return null;
      }
      throw new Error(result.error ?? "Failed to save check-in.");
    }

    setSubmitError("");
    return result;
  }, [
    canEdit,
    clientLocalDate,
    clientTimeZone,
    coachInsightText,
    currentStep,
    draft,
    energyPeakSummary,
    isKo,
    previewScore,
    topFocusSummary
  ]);

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
  }, [canEdit, currentStep, draft, hydrated, isStepSaving, persist, storageKey, submitting]);

  function patchDraft(next: Partial<CheckInDraft>) {
    setDraft((prev) => ({ ...prev, ...next }));
    setSubmitError("");
  }

  function toggleWorkChip(label: string) {
    patchDraft({
      quick_completed_work: draft.quick_completed_work.includes(label)
        ? draft.quick_completed_work.filter((item) => item !== label)
        : dedupe([...draft.quick_completed_work, label])
    });
  }

  function toggleMissionTag(tag: string) {
    patchDraft({
      mission_tags: draft.mission_tags.includes(tag)
        ? draft.mission_tags.filter((item) => item !== tag)
        : dedupe([...draft.mission_tags, tag])
    });
  }

  function addQuickEvidence(label: string) {
    patchDraft({
      evidence_files: draft.evidence_files.includes(label)
        ? draft.evidence_files.filter((item) => item !== label)
        : dedupe([...draft.evidence_files, label])
    });
  }

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const nextPreviews: AttachmentPreview[] = files.slice(0, 4).map((file, idx) => {
      const isImage = file.type.startsWith("image/");
      return {
        id: `${file.name}-${Date.now()}-${idx}`,
        name: file.name,
        previewUrl: isImage ? URL.createObjectURL(file) : undefined,
        isImage
      };
    });

    setAttachmentPreviews((prev) => [...prev, ...nextPreviews].slice(0, 8));
    patchDraft({ evidence_files: dedupe([...draft.evidence_files, ...files.map((file) => file.name)]) });
    event.currentTarget.value = "";
  }

  function removeAttachment(name: string) {
    setAttachmentPreviews((prev) => {
      const found = prev.find((item) => item.name === name);
      if (found?.previewUrl) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((item) => item.name !== name);
    });
    patchDraft({ evidence_files: draft.evidence_files.filter((item) => item !== name) });
  }

  function addEvidenceLink() {
    const input = window.prompt("Add optional evidence link", "https://");
    if (!input) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    patchDraft({ evidence_links: dedupe([...draft.evidence_links, trimmed]) });
  }

  function removeEvidenceLink(value: string) {
    patchDraft({ evidence_links: draft.evidence_links.filter((item) => item !== value) });
  }

  async function goNext() {
    if (!stepValid || currentStep >= TOTAL_STEPS - 1) return;
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
    skipAutosaveOnceRef.current = true;
    setCurrentStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
  }

  async function onSubmitToManager() {
    if (!canEdit || currentStep !== TOTAL_STEPS - 1) return;

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
        router.push(result.redirectTo ?? "/app/welcome?saved=1");
        router.refresh();
      }, 920);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit check-in.");
    } finally {
      setSubmitting(false);
    }
  }

  function StepShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
      <div key={`${currentStep}-${title}`} className="anim-pop mt-5 rounded-[2rem] bg-white/70 p-5 shadow-[0_16px_44px_rgba(18,32,96,0.08)] ring-1 ring-black/[0.03]">
        <h2 className="text-page-title font-black leading-[1.08] text-slate-900">{title}</h2>
        <p className="mt-2 text-body-compact text-slate-600">{description}</p>
        <div className="mt-5">{children}</div>
      </div>
    );
  }

  if (readOnly) {
    return (
      <section className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Manager preview mode: submission save is disabled.
        </div>
      </section>
    );
  }

  if (lockedByStatus) {
    return (
      <section className="space-y-4">
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

  const stepHeading = `Step ${currentStep + 1} of ${TOTAL_STEPS}`;

  return (
    <section className="relative -mx-4 min-h-[calc(100dvh-6.4rem)] bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-4 pb-28 pt-2 sm:mx-0 sm:rounded-[2rem] sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-white/50 bg-white/80 px-4 pb-3 pt-3 backdrop-blur sm:mx-0 sm:-mt-2 sm:rounded-t-[2rem] sm:px-0">
        <div className="flex items-center justify-between gap-2">
          <Link className="rounded-full p-2 text-blue-700 hover:bg-blue-50" href="/app/welcome">
            <X size={20} />
          </Link>
          <h1 className="text-section-title font-black text-slate-900">Daily Check-in</h1>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700">{stepHeading}</span>
        </div>

          <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>{`Step ${currentStep + 1}/${TOTAL_STEPS}`}</span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block min-w-[7.4rem] text-right">
                {isAutoSaving ? "Auto-saving..." : "Draft saved"}
              </span>
              <span>{progressPercent(currentStep)}% Complete</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-700 to-blue-400 transition-all duration-500"
              style={{ width: `${progressPercent(currentStep)}%` }}
            />
          </div>
        </div>
      </header>

      {currentStep === 0 && (
        <StepShell
          description="Take a moment to breathe. Identifying your current state is the first step toward peak performance."
          title="How do you feel right now?"
        >
          <div className="grid grid-cols-2 gap-3">
            {FEELING_OPTIONS.map((option) => {
              const active = draft.feeling_state === option.label;
              return (
                <button
                  className={`rounded-[1.8rem] border p-4 text-left transition ${
                    active
                      ? "border-blue-300 bg-blue-50 shadow-[0_10px_22px_rgba(37,99,235,0.18)]"
                      : "border-slate-200 bg-white"
                  }`}
                  key={option.key}
                  onClick={() => patchDraft({ feeling_state: option.label })}
                  type="button"
                >
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-2xl ${active ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
                    {option.icon}
                  </span>
                  <p className="mt-3 text-card-title font-black text-slate-900">{option.label}</p>
                </button>
              );
            })}
          </div>

          <article className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-xl">🧑‍🏫</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Coach Insight</p>
                <p className="mt-1 text-sm text-slate-600">
                  Remember, there are no wrong feelings. Honest check-ins create better performance guidance.
                </p>
              </div>
            </div>
          </article>
        </StepShell>
      )}

      {currentStep === 1 && (
        <StepShell
          description="Choose the factor that most shaped your performance today."
          title="What impacted your productivity most today?"
        >
          <div className="grid grid-cols-2 gap-2">
            {PRODUCTIVITY_FACTORS.map((item) => {
              const active = draft.primary_productivity_factor === item;
              return (
                <button
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold transition ${
                    active ? "border-blue-300 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"
                  }`}
                  key={item}
                  onClick={() => patchDraft({ primary_productivity_factor: item })}
                  type="button"
                >
                  {item}
                </button>
              );
            })}
          </div>

          {draft.primary_productivity_factor === "Other" && (
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Optional note
              <input
                className="input mt-2"
                onChange={(event) => patchDraft({ primary_productivity_factor_note: event.target.value })}
                placeholder="Add short context"
                value={draft.primary_productivity_factor_note}
              />
            </label>
          )}
        </StepShell>
      )}

      {currentStep === 2 && (
        <StepShell
          description="Reflect on your impact and focus areas."
          title="How did you execute today?"
        >
          <div className="space-y-3">
            {EXECUTION_ITEMS.map((item) => {
              const active = draft[item.key];
              return (
                <button
                  className={`w-full rounded-[1.5rem] border p-4 text-left transition ${
                    active ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
                  }`}
                  key={item.key}
                  onClick={() => {
                    if (item.key === "completed_top_priorities") {
                      patchDraft({ completed_top_priorities: !draft.completed_top_priorities });
                      return;
                    }
                    if (item.key === "worked_on_high_impact") {
                      patchDraft({ worked_on_high_impact: !draft.worked_on_high_impact });
                      return;
                    }
                    patchDraft({ avoided_low_value_work: !draft.avoided_low_value_work });
                  }}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 text-transparent"}`}>
                      <Check size={14} />
                    </span>
                    <span>
                      <span className="block text-card-title font-black text-slate-900">{item.title}</span>
                      <span className="mt-1 block text-sm text-slate-600">{item.desc}</span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {currentStep === 3 && (
        <StepShell
          description="Be honest with yourself. How effectively did you move the needle?"
          title="Rate your productivity today"
        >
          <div className="grid grid-cols-2 gap-3">
            {PRODUCTIVITY_RATINGS.map((option) => {
              const active = draft.self_productivity_rating === option.key;
              const emphasis = option.key === "strong" || option.key === "peak";
              return (
                <button
                  className={`rounded-[1.8rem] border p-4 text-left transition ${
                    active
                      ? "border-blue-400 bg-gradient-to-br from-blue-700 to-blue-500 text-white shadow-[0_16px_28px_rgba(37,99,235,0.28)]"
                      : emphasis
                        ? "border-slate-200 bg-slate-50"
                        : "border-slate-200 bg-white"
                  }`}
                  key={option.key}
                  onClick={() => patchDraft({ self_productivity_rating: option.key })}
                  type="button"
                >
                  <p className={`text-4xl ${active ? "anim-bounce-soft" : ""}`}>{option.emoji}</p>
                  <p className={`mt-2 text-card-title font-black ${active ? "text-white" : "text-slate-900"}`}>{option.label}</p>
                  <p className={`mt-1 text-sm ${active ? "text-blue-100" : "text-slate-600"}`}>{option.desc}</p>
                </button>
              );
            })}
          </div>
        </StepShell>
      )}

      {currentStep === 4 && (
        <StepShell
          description="Select your primary focus for tomorrow."
          title="What will you improve tomorrow?"
        >
          <div className="grid grid-cols-2 gap-3">
            {TOMORROW_FOCUS_OPTIONS.map((option, idx) => {
              const active = draft.tomorrow_improvement_focus === option.key;
              const wide = idx === 0;
              return (
                <button
                  className={`rounded-[1.6rem] border p-4 text-left transition ${
                    wide ? "col-span-2" : ""
                  } ${
                    active
                      ? "border-blue-300 bg-blue-50 shadow-[0_10px_22px_rgba(37,99,235,0.14)]"
                      : "border-slate-200 bg-white"
                  }`}
                  key={option.key}
                  onClick={() => patchDraft({ tomorrow_improvement_focus: option.key })}
                  type="button"
                >
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-xl ${active ? "bg-blue-600 text-white" : "bg-slate-100"}`}>{option.icon}</span>
                  <p className="mt-2 text-card-title font-black text-slate-900">{option.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{option.desc}</p>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-sm font-semibold text-slate-700">
            Optional note
            <input
              className="input mt-2"
              onChange={(event) => patchDraft({ tomorrow_improvement_note: event.target.value })}
              placeholder="Anything else to improve tomorrow?"
              value={draft.tomorrow_improvement_note}
            />
          </label>
        </StepShell>
      )}

      {currentStep === 5 && (
        <StepShell
          description="Summarize the milestones you've crossed today. Option-first logging is enabled."
          title="Task Log"
        >
          <article className="rounded-2xl bg-white p-4 ring-1 ring-black/[0.04]">
            <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Completed Work (quick select)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK_WORK_CHIPS.map((chip) => {
                const active = draft.quick_completed_work.includes(chip);
                return (
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                    key={chip}
                    onClick={() => toggleWorkChip(chip)}
                    type="button"
                  >
                    {chip}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Optional detail summary
              <textarea
                className="input mt-2 min-h-24 resize-none"
                onChange={(event) => patchDraft({ completed_work_summary: event.target.value })}
                placeholder="Optional: add one short summary"
                value={draft.completed_work_summary}
              />
              <span className="mt-1 inline-flex items-center gap-1 text-caption text-slate-500">
                <Sparkles size={12} /> Auto-saving
              </span>
            </label>
          </article>

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Mission Tags</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">RECOMMENDED</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {MISSION_TAGS.map((tag) => {
                const active = draft.mission_tags.includes(tag);
                return (
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                      active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                    key={tag}
                    onClick={() => toggleMissionTag(tag)}
                    type="button"
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </article>

          <article className="mt-3 rounded-2xl bg-white p-4 ring-1 ring-black/[0.04]">
            <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Evidence & Files</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_EVIDENCE.map((evidence) => {
                const active = draft.evidence_files.includes(evidence);
                return (
                  <button
                    className={`rounded-full px-3 py-2 text-xs font-bold transition ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                    key={evidence}
                    onClick={() => addQuickEvidence(evidence)}
                    type="button"
                  >
                    {evidence}
                  </button>
                );
              })}
            </div>

            <label className="mt-3 flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
              <span className="inline-flex items-center gap-2"><CloudUpload size={16} /> Upload screenshot / file</span>
              <input className="hidden" multiple onChange={onFilesSelected} type="file" />
              <span className="text-blue-700">+ Add</span>
            </label>

            {draft.evidence_files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {draft.evidence_files.map((name) => {
                  const preview = attachmentPreviews.find((item) => item.name === name);
                  return (
                    <li className="rounded-xl bg-slate-50 p-2" key={name}>
                      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                        <span className="truncate">{name}</span>
                        <button
                          className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-600"
                          onClick={() => removeAttachment(name)}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                      {preview?.isImage && preview.previewUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={name} className="mt-2 h-24 w-full rounded-lg object-cover" src={preview.previewUrl} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700" onClick={addEvidenceLink} type="button">
                + Add link
              </button>
              <span className="text-[11px] text-slate-500">Optional</span>
            </div>
            {draft.evidence_links.length > 0 && (
              <ul className="mt-2 space-y-1">
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
        </StepShell>
      )}

      {currentStep === 6 && (
        <StepShell
          description="You've unlocked your performance insights for today."
          title="Check-in Complete"
        >
          <article className="rounded-[1.8rem] bg-white p-5 shadow-[0_10px_24px_rgba(24,70,180,0.1)] ring-1 ring-black/[0.03]">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-caption font-bold uppercase tracking-[0.16em] text-slate-500">Today&apos;s Performance</p>
                <p className="mt-1 text-5xl font-black text-blue-700">
                  {previewScore}
                  <span className="text-2xl text-blue-300">/100</span>
                </p>
              </div>
              <span className="rounded-lg bg-amber-100 px-2 py-1 text-sm font-bold text-amber-700">+{Math.max(2, Math.round((previewScore - 70) / 2))}%</span>
            </div>
          </article>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <article className="rounded-2xl bg-slate-100 p-4">
              <p className="inline-flex items-center gap-1 text-caption font-bold uppercase tracking-[0.16em] text-slate-500"><Target size={13} /> Top Focus</p>
              <p className="mt-2 text-card-title font-black text-slate-900">{topFocusSummary}</p>
            </article>
            <article className="rounded-2xl bg-slate-100 p-4">
              <p className="inline-flex items-center gap-1 text-caption font-bold uppercase tracking-[0.16em] text-slate-500"><Bolt size={13} /> Energy Peak</p>
              <p className="mt-2 text-card-title font-black text-slate-900">{energyPeakSummary}</p>
            </article>
          </div>

          <article className="mt-3 rounded-[1.6rem] border border-blue-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-lg">🧠</span>
              <div>
                <p className="text-sm font-bold text-slate-900">Coach Insights</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">AI Generated Analysis</p>
              </div>
            </div>
            <p className="mt-3 text-sm italic leading-relaxed text-slate-700">&ldquo;{coachInsightText}&rdquo;</p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-[11px] font-bold text-blue-700">#Momentum</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-700">#Execution</span>
            </div>
          </article>

          <article className="mt-3 rounded-[1.6rem] border-2 border-dashed border-slate-300 p-4">
            <p className="inline-flex items-center gap-1 text-caption font-bold uppercase tracking-[0.16em] text-slate-500"><Eye size={13} /> Preview for Manager</p>
            <p className="mt-2 text-sm text-slate-600">
              Manager receives your performance preview, selected productivity drivers, execution quality, mission tags, and evidence package.
            </p>
            <div className="mt-3 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">
              <p>• Work highlights: {draft.quick_completed_work.length > 0 ? draft.quick_completed_work.join(", ") : "No quick highlights selected"}</p>
              <p>• Mission tags: {draft.mission_tags.length > 0 ? draft.mission_tags.join(", ") : "None"}</p>
              <p>• Evidence items: {draft.evidence_files.length + draft.evidence_links.length}</p>
            </div>
          </article>
        </StepShell>
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
            <p className="mt-2 text-sm text-slate-600">Great reflection today. Your manager review is on the way.</p>
          </article>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/60 bg-white/85 px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[420px] items-center justify-between gap-3">
          <button
            className="inline-flex min-w-[6.8rem] items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-45"
            disabled={currentStep === 0 || submitting}
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            type="button"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              className="inline-flex min-w-[8.8rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 px-5 py-3 text-sm font-black text-white shadow-[0_12px_22px_rgba(37,99,235,0.32)] disabled:opacity-45"
              disabled={!stepValid || submitting || isStepSaving}
              onClick={goNext}
              type="button"
            >
              {isStepSaving ? "Saving..." : "Next"}
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="inline-flex min-w-[12rem] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-500 px-5 py-3 text-sm font-black text-white shadow-[0_12px_22px_rgba(37,99,235,0.32)] disabled:opacity-45"
              disabled={submitting}
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
        <div className="absolute -top-16 right-0 h-64 w-64 rounded-full bg-blue-100/40 blur-[84px]" />
        <div className="absolute bottom-10 left-0 h-56 w-56 rounded-full bg-amber-100/30 blur-[90px]" />
      </div>

      <div className="sr-only" aria-live="polite">{isAutoSaving ? "Auto-saving draft" : "Draft saved"}</div>

      <div className="hidden">
        <ArrowLeft />
        <ArrowRight />
        <BatteryLow />
        <Bolt />
        <CheckCircle2 />
        <Circle />
        <CloudUpload />
        <Eye />
        <Flame />
        <ListChecks />
        <Sparkles />
        <Target />
        <Waves />
      </div>
    </section>
  );
}
