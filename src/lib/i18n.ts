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
  }
} as const;

export function t(locale: Locale, key: keyof (typeof dictionary)["en"]): string {
  return dictionary[locale][key] ?? dictionary.en[key];
}
