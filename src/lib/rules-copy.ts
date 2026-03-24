import { DEFAULT_RULES } from "@/lib/constants";
import { Locale, RuleChangeLogItem } from "@/lib/types";

const rulesKoTextMap: Record<string, string> = {
  [DEFAULT_RULES.rule_description_text]: "매일 체크인하고 작업을 제출하며 연속 기록을 쌓아 보상을 잠금 해제하세요.",
  [DEFAULT_RULES.manager_logic_text]: "매니저가 각 제출을 검토해 점수를 부여하고, 게임 규칙을 직접 조정합니다.",
  [DEFAULT_RULES.penalty_description]: "점수가 0점 아래로 내려가면 Risk Zone이 활성화됩니다. 포인트를 다시 쌓아 회복할 수 있어요.",
  [DEFAULT_RULES.rewards_blurb]: "흐름을 유지하세요. 작은 전진이 더 큰 보상으로 이어집니다.",
  [DEFAULT_RULES.changelog[0].title]: "워크 몬스터 기본 규칙 적용",
  [DEFAULT_RULES.changelog[0].description]: "포인트, 연속 기록, 배수, 보상, Risk Zone 규칙이 활성화되었습니다."
};

export function localizeRuleLongText(text: string, locale: Locale): string {
  if (locale !== "ko") return text;
  return rulesKoTextMap[text] ?? text;
}

export function localizeRuleChangelogItem(item: RuleChangeLogItem, locale: Locale): RuleChangeLogItem {
  if (locale !== "ko") return item;
  return {
    ...item,
    title: rulesKoTextMap[item.title] ?? item.title,
    description: rulesKoTextMap[item.description] ?? item.description
  };
}

export function getLocalizedRuleLine(locale: Locale, key: "streak_desc" | "multiplier_desc" | "recovery_banner"): string {
  if (locale !== "ko") {
    if (key === "streak_desc") return "Consecutive approvals build your streak.";
    if (key === "multiplier_desc") return "Multiplier boosts your points after consistent approvals.";
    return "You can recover by earning points. Nothing is blocked while Risk Zone is active.";
  }

  if (key === "streak_desc") return "승인된 제출이 연속으로 쌓이면 연승이 올라갑니다.";
  if (key === "multiplier_desc") return "연속 승인이 유지되면 배수 효과가 적용되어 획득 포인트가 커집니다.";
  return "Risk Zone이 활성화되어도 앱 사용은 막히지 않으며, 포인트를 쌓아 회복할 수 있습니다.";
}
