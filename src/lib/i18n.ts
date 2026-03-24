import { Locale } from "@/lib/types";

export const locales: Locale[] = ["en", "ko"];

export const dictionary = {
  en: {
    appName: "Work Monster",
    tagline: "Level up your day, one check-in at a time.",
    loginTitle: "Enter Work Monster",
    roleUser: "User",
    roleManager: "Manager",
    email: "Email Address",
    password: "Security Key",
    enter: "Enter Sanctuary",
    beginCheckin: "Begin daily check-in",
    questions: "Questions",
    record: "Record",
    rewards: "Rewards",
    score: "Score",
    rules: "Rules",
    account: "Account",
    riskZone: "Risk Zone",
    penaltyActive: "Penalty Active",
    recoverHint: "You can recover by earning points",
    managerRewardUnlocked: "Manager reward unlocked"
  },
  ko: {
    appName: "워크 몬스터",
    tagline: "하루를 게임처럼 다시 시작해요.",
    loginTitle: "워크 몬스터 입장",
    roleUser: "사용자",
    roleManager: "매니저",
    email: "이메일 주소",
    password: "보안 키",
    enter: "입장하기",
    beginCheckin: "오늘 체크인 시작",
    questions: "질문",
    record: "기록",
    rewards: "보상",
    score: "점수",
    rules: "규칙",
    account: "계정",
    riskZone: "리스크 존",
    penaltyActive: "페널티 활성화",
    recoverHint: "포인트를 쌓으면 회복할 수 있어요",
    managerRewardUnlocked: "매니저 보상 잠금 해제"
  }
} as const;

export function t(locale: Locale, key: keyof (typeof dictionary)["en"]): string {
  return dictionary[locale][key] ?? dictionary.en[key];
}
