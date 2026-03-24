"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Locale, RuleConfig, UserRole } from "@/lib/types";
import { clearSession, getSession, setSession, updateLocale } from "@/lib/session";
import {
  acknowledgeRuleVersion,
  approveSubmission,
  claimPenaltyReward,
  claimReward,
  createReward,
  deleteReward,
  getDashboard,
  submitDailyCheckIn,
  updateReward,
  updateRules
} from "@/lib/services/game-service";
import { getGameRepository } from "@/lib/repositories/game-repository";

function parseNumber(input: FormDataEntryValue | null, fallback = 0): number {
  if (typeof input !== "string") return fallback;
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(input: FormDataEntryValue | null): boolean {
  if (typeof input !== "string") return false;
  return input === "true" || input === "on";
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "user") as UserRole;
  const locale = String(formData.get("locale") ?? "en") as Locale;

  if (!email) {
    throw new Error("Email is required.");
  }

  const repo = getGameRepository();
  const user = await repo.signIn(email, role, locale);

  await setSession({ uid: user.id, role: user.role, locale: user.locale });

  if (user.role === "manager") {
    redirect("/manager");
  }

  redirect("/app/questions");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/auth/login");
}

export async function setLocaleAction(formData: FormData): Promise<void> {
  const locale = (String(formData.get("locale") ?? "en") as Locale) || "en";
  await updateLocale(locale);

  const session = await getSession();
  if (session) {
    const repo = getGameRepository();
    await repo.updateUser(session.uid, { locale });
  }

  revalidatePath("/auth/login");
  revalidatePath("/app");
  revalidatePath("/manager");
}

export async function setCharacterStyleAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const withGlasses = String(formData.get("character_glasses") ?? "true") !== "false";
  const repo = getGameRepository();
  await repo.updateUser(session.uid, { character_glasses: withGlasses });

  revalidatePath("/account");
  revalidatePath("/app/questions");
  revalidatePath("/app/score");
  revalidatePath("/app/record");
}

export async function submitCheckInAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  await submitDailyCheckIn(session.uid, {
    mood: String(formData.get("mood") ?? "Neutral"),
    feeling: String(formData.get("feeling") ?? ""),
    calories: parseNumber(formData.get("calories"), 0),
    productive: parseBoolean(formData.get("productive")),
    task_list: String(formData.get("task_list") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    file_url: String(formData.get("file_url") ?? ""),
    custom_answers: {
      focus: String(formData.get("focus") ?? ""),
      blocker: String(formData.get("blocker") ?? ""),
      win: String(formData.get("win") ?? "")
    }
  });

  revalidatePath("/app/questions");
  revalidatePath("/app/record");
}

export async function acknowledgeRulesAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  await acknowledgeRuleVersion(session.uid);
  revalidatePath("/app");
}

export async function claimRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const rewardId = String(formData.get("reward_id") ?? "");
  if (!rewardId) return;

  await claimReward(session.uid, rewardId);
  revalidatePath("/app/rewards");
  revalidatePath("/app/score");
}

export async function reviewSubmissionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  await approveSubmission(
    {
      submissionId: String(formData.get("submission_id") ?? ""),
      approved: parseBoolean(formData.get("approved")),
      note: String(formData.get("note") ?? ""),
      points: parseNumber(formData.get("points"), 0)
    },
    session.uid
  );

  revalidatePath("/manager");
  revalidatePath("/app/score");
  revalidatePath("/app/record");
}

export async function updateRulesAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  const thresholds = String(formData.get("penalty_thresholds") ?? "-1,-5,-10")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value < 0)
    .sort((a, b) => b - a);

  const rewardsRaw = String(formData.get("penalty_rewards_json") ?? "[]");
  let parsedRewards: RuleConfig["penalty_rewards"] = [];
  try {
    parsedRewards = JSON.parse(rewardsRaw) as RuleConfig["penalty_rewards"];
  } catch (_error) {
    parsedRewards = [];
  }

  await updateRules(
    {
      checkin_points: parseNumber(formData.get("checkin_points"), 2),
      submission_points: parseNumber(formData.get("submission_points"), 5),
      productive_points: parseNumber(formData.get("productive_points"), 3),
      non_productive_penalty: parseNumber(formData.get("non_productive_penalty"), -1),
      streak_days: parseNumber(formData.get("streak_days"), 3),
      multiplier_trigger_days: parseNumber(formData.get("multiplier_trigger_days"), 7),
      multiplier_value: parseNumber(formData.get("multiplier_value"), 1.5),
      greeting_message: String(formData.get("greeting_message") ?? ""),
      success_message: String(formData.get("success_message") ?? ""),
      rule_description_text: String(formData.get("rule_description_text") ?? ""),
      manager_logic_text: String(formData.get("manager_logic_text") ?? ""),
      penalty_description: String(formData.get("penalty_description") ?? ""),
      rewards_blurb: String(formData.get("rewards_blurb") ?? ""),
      penalty_thresholds: thresholds,
      penalty_rewards: parsedRewards,
      note: String(formData.get("note") ?? "")
    },
    session.uid
  );

  revalidatePath("/manager");
  revalidatePath("/app/rules");
  revalidatePath("/app/score");
}

export async function createRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  await createReward(session.uid, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    required_points: parseNumber(formData.get("required_points"), 0)
  });

  revalidatePath("/manager");
  revalidatePath("/app/rewards");
}

export async function updateRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  const rewardId = String(formData.get("reward_id") ?? "");
  if (!rewardId) return;

  await updateReward(session.uid, {
    id: rewardId,
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    required_points: parseNumber(formData.get("required_points"), 0)
  });

  revalidatePath("/manager");
  revalidatePath("/app/rewards");
  revalidatePath("/app/score");
}

export async function deleteRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  const rewardId = String(formData.get("reward_id") ?? "");
  if (!rewardId) return;

  await deleteReward(session.uid, rewardId);
  revalidatePath("/manager");
  revalidatePath("/app/rewards");
  revalidatePath("/app/score");
}

export async function claimPenaltyRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");

  const eventId = String(formData.get("event_id") ?? "");
  if (!eventId) return;

  await claimPenaltyReward(eventId, session.uid);
  revalidatePath("/manager");
  revalidatePath("/app/score");
}

export async function refreshDashboardAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  await getDashboard(session.uid);
  revalidatePath("/app");
}
