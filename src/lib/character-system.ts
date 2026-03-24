import { Locale } from "@/lib/types";

export type ManagerExpression = "nods" | "wide-eyes" | "clap" | "wink";
export type UserExpression = "confident" | "nervous" | "determined" | "jump" | "sad";
export type SpriteName =
  | "manager_encouraging"
  | "manager_curious"
  | "manager_alert"
  | "manager_approving"
  | "ashton_determined"
  | "ashton_confused"
  | "ashton_tired"
  | "ashton_excited";

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
  | "questions_confused"
  | "milestone_jump"
  | "major_penalty_sad";

export interface CharacterCue {
  title: string;
  message: string;
  expression: ManagerExpression | UserExpression;
  emoji: string;
  spriteName: SpriteName;
}

export function getManagerCue(key: ManagerCueKey, locale: Locale): CharacterCue {
  const ko = {
    rules_encouraging: {
      title: "매니저 가이드",
      message: "Welcome to the Rules Guide!",
      expression: "nods",
      emoji: "⭐",
      spriteName: "manager_encouraging"
    },
    upload_saved_pending: {
      title: "보류 중 승인",
      message: "Mmm... Let me take a look.",
      expression: "wide-eyes",
      emoji: "⏳",
      spriteName: "manager_curious"
    },
    submission_success: {
      title: "Great Work!",
      message: "점수 승인 완료! 다음 목표로 이동해요.",
      expression: "wink",
      emoji: "🎉",
      spriteName: "manager_approving"
    },
    penalty_zone_wink: {
      title: "WATCH OUT! Risk Level Active.",
      message: "Risk Zone이 활성화됐어요. You can recover by earning points.",
      expression: "wide-eyes",
      emoji: "⚠️",
      spriteName: "manager_alert"
    },
    record_approval: {
      title: "승인 체크",
      message: "이 항목은 매니저 점수 승인이 완료된 기록이에요.",
      expression: "nods",
      emoji: "✅",
      spriteName: "manager_encouraging"
    }
  } as const;

  const en = {
    rules_encouraging: {
      title: "Manager Guide",
      message: "Welcome to the Rules Guide!",
      expression: "nods",
      emoji: "⭐",
      spriteName: "manager_encouraging"
    },
    upload_saved_pending: {
      title: "Pending Approval",
      message: "Mmm... Let me take a look.",
      expression: "wide-eyes",
      emoji: "⏳",
      spriteName: "manager_curious"
    },
    submission_success: {
      title: "Great Work!",
      message: "Points confirmed. Momentum updated.",
      expression: "wink",
      emoji: "🎉",
      spriteName: "manager_approving"
    },
    penalty_zone_wink: {
      title: "WATCH OUT! Risk Level Active.",
      message: "Risk Zone is active. You can recover by earning points.",
      expression: "wide-eyes",
      emoji: "⚠️",
      spriteName: "manager_alert"
    },
    record_approval: {
      title: "Approval Confirmed",
      message: "This entry has been approved with points.",
      expression: "nods",
      emoji: "✅",
      spriteName: "manager_encouraging"
    }
  } as const;

  return locale === "ko" ? ko[key] : en[key];
}

export function getUserCue(key: UserCueKey, locale: Locale): CharacterCue {
  const ko = {
    score_confident: {
      title: "오늘 흐름 좋아요",
      message: "현재 포인트가 플러스예요. 지금 리듬을 유지해봐요.",
      expression: "determined",
      emoji: "💰",
      spriteName: "ashton_determined"
    },
    score_nervous: {
      title: "리스크 존 감지",
      message: "포인트가 음수예요. 작은 승인부터 회복 루트를 시작해요.",
      expression: "nervous",
      emoji: "⚠️",
      spriteName: "ashton_tired"
    },
    questions_determined: {
      title: "Ready for Today's Challenge!",
      message: "Start today’s quest with strong momentum.",
      expression: "determined",
      emoji: "🔥",
      spriteName: "ashton_determined"
    },
    questions_confused: {
      title: "입력이 조금 더 필요해요",
      message: "Mmm... Just to be sure...",
      expression: "nervous",
      emoji: "❓",
      spriteName: "ashton_confused"
    },
    milestone_jump: {
      title: "마일스톤 달성!",
      message: "연승/배수/보상 목표 달성! 다음 구간으로 점프해요.",
      expression: "jump",
      emoji: "🎁",
      spriteName: "ashton_excited"
    },
    major_penalty_sad: {
      title: "큰 점수 하락",
      message: "점수가 크게 내려갔어요. 내일 체크인 + 승인으로 회복 가능해요.",
      expression: "sad",
      emoji: "💧",
      spriteName: "ashton_tired"
    }
  } as const;

  const en = {
    score_confident: {
      title: "Momentum Looks Good",
      message: "Your points are positive. Keep the rhythm going.",
      expression: "determined",
      emoji: "💰",
      spriteName: "ashton_determined"
    },
    score_nervous: {
      title: "Risk Zone Detected",
      message: "Points are below zero. Start a recovery path with quick approvals.",
      expression: "nervous",
      emoji: "⚠️",
      spriteName: "ashton_tired"
    },
    questions_determined: {
      title: "Ready for Today's Challenge!",
      message: "Start today's quest with strong momentum.",
      expression: "determined",
      emoji: "🔥",
      spriteName: "ashton_determined"
    },
    questions_confused: {
      title: "Need one more input",
      message: "Mmm... Just to be sure...",
      expression: "nervous",
      emoji: "❓",
      spriteName: "ashton_confused"
    },
    milestone_jump: {
      title: "Milestone Unlocked",
      message: "Streak/multiplier/reward target reached. Jump to the next goal.",
      expression: "jump",
      emoji: "🎁",
      spriteName: "ashton_excited"
    },
    major_penalty_sad: {
      title: "Major Point Drop",
      message: "Points dropped sharply. You can recover with your next approvals.",
      expression: "sad",
      emoji: "💧",
      spriteName: "ashton_tired"
    }
  } as const;

  return locale === "ko" ? ko[key] : en[key];
}
