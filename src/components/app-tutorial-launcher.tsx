"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { Locale, RuleChangeLogItem } from "@/lib/types";

type Props = {
  locale: Locale;
  ruleVersion: number;
  checkinPoints: number;
  submissionPoints: number;
  productivePoints: number;
  nonProductivePenalty: number;
  streakDays: number;
  multiplierTriggerDays: number;
  multiplierValue: number;
  rewardHint: string;
  penaltyDescription: string;
  penaltyActionRules: string[];
  latestChange: RuleChangeLogItem | null;
};

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  emoji: string;
  toneClass: string;
};

function buildSlides({
  locale,
  ruleVersion,
  checkinPoints,
  submissionPoints,
  productivePoints,
  nonProductivePenalty,
  streakDays,
  multiplierTriggerDays,
  multiplierValue,
  rewardHint,
  penaltyDescription,
  penaltyActionRules,
  latestChange
}: Props): Slide[] {
  const isKo = locale === "ko";
  const flowBody = isKo
    ? "1) Home에서 Daily Check-in 시작 → 2) 질문 답변/업무기록/파일 업로드 → 3) Manager 리뷰 대기 → 4) 점수/코멘트 반영 확인 → 5) Record/Score에서 추이 확인."
    : "1) Start Daily Check-in from Home -> 2) Answer questions, log tasks, upload files -> 3) Wait for manager review -> 4) Check score/comment update -> 5) Track trends in Record and Score.";
  const pointsBody = isKo
    ? `기본 점수: 체크인 +${checkinPoints}, 승인 +${submissionPoints}, 생산성 보너스 +${productivePoints}, 비생산 패널티 ${nonProductivePenalty}. 최종 점수는 Manager가 확인 후 확정돼요.`
    : `Base points: check-in +${checkinPoints}, approved submission +${submissionPoints}, productive bonus +${productivePoints}, non-productive penalty ${nonProductivePenalty}. Final points are confirmed by your manager.`;
  const streakBody = isKo
    ? `${streakDays}일 연속 승인 시 스트릭 목표 달성. ${multiplierTriggerDays}일 구간부터 x${multiplierValue.toFixed(1)} 배수가 적용될 수 있어요.`
    : `Streak milestone is ${streakDays} approved days. From ${multiplierTriggerDays} days, multiplier up to x${multiplierValue.toFixed(1)} can apply.`;
  const rewardBody = isKo
    ? `리워드는 점수 누적으로 잠금 해제돼요. ${rewardHint || "Rewards 탭에서 다음 목표를 확인하세요."}`
    : `Rewards unlock by accumulated points. ${rewardHint || "Check the Rewards tab for your next target."}`;
  const riskBody = isKo
    ? `${penaltyDescription} 핵심: 앱 사용은 계속 가능하고, 점수를 다시 쌓아 언제든 회복할 수 있어요.`
    : `${penaltyDescription} Key rule: app usage is never blocked, and you can recover anytime by earning points.`;
  const penaltyActionBody =
    penaltyActionRules.length > 0
      ? (isKo
          ? `추가 패널티 액션: ${penaltyActionRules.join(" · ")}`
          : `Extra penalty actions: ${penaltyActionRules.join(" · ")}`)
      : (isKo
          ? "현재 등록된 추가 패널티 액션은 없어요. Manager가 필요할 때 새 항목을 추가할 수 있어요."
          : "No extra text penalty actions yet. Manager can add/edit/delete these anytime.");
  const updateBody = latestChange
    ? isKo
      ? `현재 버전 v${ruleVersion}의 최신 변경: ${latestChange.title}. ${latestChange.description}`
      : `Latest change in current v${ruleVersion}: ${latestChange.title}. ${latestChange.description}`
    : isKo
      ? `현재는 v${ruleVersion} 초기 규칙입니다. 포인트, 스트릭, 배수, 리워드, Risk Zone 규칙이 활성화되어 있어요.`
      : `You are on initial rule set v${ruleVersion}. Points, streak, multiplier, rewards, and Risk Zone are active.`;

  return [
    {
      id: "flow",
      eyebrow: isKo ? "APP FLOW" : "APP FLOW",
      title: isKo ? "이 앱을 이렇게 쓰면 돼요" : "How to use Work Monster",
      body: flowBody,
      emoji: "🧭",
      toneClass: "from-cyan-50 to-indigo-50"
    },
    {
      id: "points",
      eyebrow: isKo ? "SCORING" : "SCORING",
      title: isKo ? "점수는 이렇게 반영돼요" : "How points are applied",
      body: pointsBody,
      emoji: "💰",
      toneClass: "from-emerald-50 to-teal-50"
    },
    {
      id: "streak",
      eyebrow: isKo ? "MOMENTUM" : "MOMENTUM",
      title: isKo ? "스트릭 & 배수 시스템" : "Streak & multiplier",
      body: streakBody,
      emoji: "🔥",
      toneClass: "from-amber-50 to-orange-50"
    },
    {
      id: "reward",
      eyebrow: isKo ? "REWARD" : "REWARD",
      title: isKo ? "리워드 전략" : "Reward strategy",
      body: rewardBody,
      emoji: "🎁",
      toneClass: "from-violet-50 to-fuchsia-50"
    },
    {
      id: "risk",
      eyebrow: isKo ? "RISK ZONE" : "RISK ZONE",
      title: isKo ? "리스크 존은 회복 가능한 시스템" : "Risk Zone is recoverable",
      body: riskBody,
      emoji: "⚠️",
      toneClass: "from-rose-50 to-red-50"
    },
    {
      id: "penalty-actions",
      eyebrow: isKo ? "PENALTY ACTIONS" : "PENALTY ACTIONS",
      title: isKo ? "추가 페널티 규칙" : "Additional penalty rules",
      body: penaltyActionBody,
      emoji: "📌",
      toneClass: "from-amber-50 to-orange-50"
    },
    {
      id: "update",
      eyebrow: isKo ? `UPDATED V${ruleVersion}` : `UPDATED V${ruleVersion}`,
      title: isKo ? "현재 룰 버전 핵심" : "Current rule version summary",
      body: updateBody,
      emoji: "🆕",
      toneClass: "from-indigo-50 to-blue-50"
    }
  ];
}

export function AppTutorialLauncher(props: Props) {
  const isKo = props.locale === "ko";
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const slides = useMemo(() => buildSlides(props), [props]);

  function goTo(nextIndex: number) {
    const clamped = Math.max(0, Math.min(slides.length - 1, nextIndex));
    setIndex(clamped);
    const container = trackRef.current;
    if (!container) return;
    container.scrollTo({
      left: clamped * container.clientWidth,
      behavior: "smooth"
    });
  }

  function onTrackScroll() {
    const container = trackRef.current;
    if (!container) return;
    const next = Math.round(container.scrollLeft / Math.max(1, container.clientWidth));
    if (next !== index) setIndex(next);
  }

  return (
    <>
      <button
        className="btn btn-energetic anim-pulse-soft inline-flex items-center gap-2 px-4 py-2 text-sm"
        onClick={() => {
          setOpen(true);
          setIndex(0);
        }}
        type="button"
      >
        <Sparkles size={15} />
        App Tutorial →
      </button>

      {open && (
        <div className="fixed inset-0 z-[78] bg-slate-950/45 p-4">
          <div className="container-mobile card mt-8 max-h-[84dvh] overflow-hidden p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">
                {isKo ? "TUTORIAL" : "TUTORIAL"}
              </p>
              <p className="text-sm font-semibold text-slate-500">
                {index + 1}/{slides.length}
              </p>
            </div>

            <div
              className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
              onScroll={onTrackScroll}
              ref={trackRef}
            >
              {slides.map((slide) => (
                <article
                  className={`min-w-full snap-start rounded-2xl bg-gradient-to-br ${slide.toneClass} p-4 anim-pop`}
                  key={slide.id}
                >
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-500">{slide.eyebrow}</p>
                  <h3 className="mt-1 text-2xl font-black text-indigo-900">
                    <span className="mr-2">{slide.emoji}</span>
                    {slide.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{slide.body}</p>
                </article>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-center gap-2">
              {slides.map((slide, dotIndex) => (
                <button
                  aria-label={`Go to tutorial slide ${dotIndex + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    dotIndex === index ? "w-6 bg-indigo-600" : "w-2.5 bg-slate-300"
                  }`}
                  key={slide.id}
                  onClick={() => goTo(dotIndex)}
                  type="button"
                />
              ))}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                aria-label="Previous tutorial section"
                className="btn btn-muted col-span-1 w-full px-0"
                onClick={() => goTo(index - 1)}
                type="button"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                aria-label="Next tutorial section"
                className="btn btn-primary col-span-1 w-full px-0"
                onClick={() => goTo(index + 1)}
                type="button"
              >
                <ChevronRight size={16} />
              </button>
              <button className="btn btn-muted col-span-1 w-full" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
