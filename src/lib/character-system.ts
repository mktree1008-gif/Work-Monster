import { Locale } from "@/lib/types";

export type ManagerExpression = "nods" | "wide-eyes" | "clap" | "wink";
export type UserExpression = "confident" | "nervous" | "determined" | "jump" | "sad";

export type ManagerCueKey =
  | "rules_encouraging"
  | "upload_saved_pending"
  | "submission_success"
  | "penalty_zone_wink"
  | "record_approval";

export type UserCueKey =
  | "score_confident"
  | "score_nervous"
  | "questions_determined"
  | "milestone_jump"
  | "major_penalty_sad";

export interface CharacterCue {
  title: string;
  message: string;
  expression: ManagerExpression | UserExpression;
  emoji: string;
}

export function getManagerCue(key: ManagerCueKey, locale: Locale): CharacterCue {
  const ko = {
    rules_encouraging: {
      title: "매니저 가이드",
      message: "규칙을 잘 확인하면 점수 흐름을 더 유리하게 만들 수 있어요.",
      expression: "nods",
      emoji: "⭐"
    },
    upload_saved_pending: {
      title: "업로드 저장 완료",
      message: "경고: 보류 중 승인 상태예요. 매니저 검토를 기다려요.",
      expression: "wide-eyes",
      emoji: "⏳"
    },
    submission_success: {
      title: "Great Work!",
      message: "오늘 제출이 완료됐어요. 이 흐름 그대로 이어가요.",
      expression: "clap",
      emoji: "🎉"
    },
    penalty_zone_wink: {
      title: "Penalty Zone Active",
      message: "페널티 존 활성화! 나는 페널티 보상을 사용할 준비가 되었습니다!",
      expression: "wink",
      emoji: "⚠️"
    },
    record_approval: {
      title: "승인 체크",
      message: "이 항목은 매니저 점수 승인이 완료된 기록이에요.",
      expression: "nods",
      emoji: "✅"
    }
  } as const;

  const en = {
    rules_encouraging: {
      title: "Manager Guide",
      message: "Review the rules to shape your points flow strategically.",
      expression: "nods",
      emoji: "⭐"
    },
    upload_saved_pending: {
      title: "Upload Saved",
      message: "Alert: Pending approval. Waiting for manager review.",
      expression: "wide-eyes",
      emoji: "⏳"
    },
    submission_success: {
      title: "Great Work!",
      message: "Submission received. Keep this momentum going.",
      expression: "clap",
      emoji: "🎉"
    },
    penalty_zone_wink: {
      title: "Penalty Zone Active",
      message: "Penalty Zone Active! I am ready to use the penalty reward!",
      expression: "wink",
      emoji: "⚠️"
    },
    record_approval: {
      title: "Approval Confirmed",
      message: "This entry has been approved with points.",
      expression: "nods",
      emoji: "✅"
    }
  } as const;

  return locale === "ko" ? ko[key] : en[key];
}

export function getUserCue(key: UserCueKey, locale: Locale): CharacterCue {
  const ko = {
    score_confident: {
      title: "오늘 흐름 좋아요",
      message: "현재 포인트가 플러스예요. 지금 리듬을 유지해봐요.",
      expression: "confident",
      emoji: "💰"
    },
    score_nervous: {
      title: "리스크 존 감지",
      message: "포인트가 음수예요. 작은 승인부터 회복 루트를 시작해요.",
      expression: "nervous",
      emoji: "⚠️"
    },
    questions_determined: {
      title: "결정 모드",
      message: "질문에 빠르게 답해서 오늘의 퀘스트를 진행해요.",
      expression: "determined",
      emoji: "🔥"
    },
    milestone_jump: {
      title: "마일스톤 달성!",
      message: "연승/배수/보상 목표 달성! 다음 구간으로 점프해요.",
      expression: "jump",
      emoji: "🎁"
    },
    major_penalty_sad: {
      title: "큰 점수 하락",
      message: "점수가 크게 내려갔어요. 내일 체크인 + 승인으로 회복 가능해요.",
      expression: "sad",
      emoji: "💧"
    }
  } as const;

  const en = {
    score_confident: {
      title: "Momentum Looks Good",
      message: "Your points are positive. Keep the rhythm going.",
      expression: "confident",
      emoji: "💰"
    },
    score_nervous: {
      title: "Risk Zone Detected",
      message: "Points are below zero. Start a recovery path with quick approvals.",
      expression: "nervous",
      emoji: "⚠️"
    },
    questions_determined: {
      title: "Quest Mode",
      message: "Answer quickly and lock in today's check-in.",
      expression: "determined",
      emoji: "🔥"
    },
    milestone_jump: {
      title: "Milestone Unlocked",
      message: "Streak/multiplier/reward target reached. Jump to the next goal.",
      expression: "jump",
      emoji: "🎁"
    },
    major_penalty_sad: {
      title: "Major Point Drop",
      message: "Points dropped sharply. You can recover with your next approvals.",
      expression: "sad",
      emoji: "💧"
    }
  } as const;

  return locale === "ko" ? ko[key] : en[key];
}
