"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isManagerOwnerEmail } from "@/lib/constants";
import { Locale, RuleConfig, UserRole } from "@/lib/types";
import { clearSession, getSession, setSession, updateLocale } from "@/lib/session";
import {
  acknowledgeRuleVersion,
  approveSubmission,
  claimPenaltyReward,
  claimReward,
  DailyCheckInAlreadySubmittedError,
  createAnnouncement,
  createReward,
  deleteReward,
  getDashboard,
  markRewardClaimAlertsSeen,
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

async function assertManagerOwner(uid: string): Promise<void> {
  const repo = getGameRepository();
  const user = await repo.getUser(uid);
  if (!user || !isManagerOwnerEmail(user.email)) {
    throw new Error("권한이 없습니다. 관리자 모드는 호스트 계정만 사용할 수 있습니다.");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("Base64 encoding is not available in this runtime.");
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

export async function updateProfileAvatarAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  const mode = String(formData.get("avatar_mode") ?? "emoji");
  const rawEmoji = String(formData.get("avatar_emoji") ?? "").trim();
  const rawUrl = String(formData.get("avatar_url") ?? "").trim();
  const file = formData.get("avatar_file");

  let imageUrl = rawUrl;

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload an image file.");
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("Please upload an image under 2MB.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    imageUrl = `data:${file.type};base64,${bytesToBase64(bytes)}`;
  }

  const emoji = rawEmoji.length > 0 ? rawEmoji.slice(0, 2) : "😺";

  if (mode === "image" && imageUrl) {
    await repo.updateUser(session.uid, {
      profile_avatar_type: "image",
      profile_avatar_url: imageUrl,
      profile_avatar_emoji: emoji
    });
  } else {
    await repo.updateUser(session.uid, {
      profile_avatar_type: "emoji",
      profile_avatar_emoji: emoji,
      profile_avatar_url: ""
    });
  }

  revalidatePath("/account");
  revalidatePath("/app");
  revalidatePath("/app/questions");
  revalidatePath("/app/record");
  revalidatePath("/app/rewards");
  revalidatePath("/app/score");
}

export async function submitCheckInAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role === "manager") {
    throw new Error("Manager preview mode cannot submit check-ins.");
  }

  let mode: "created" | "updated" = "created";
  try {
    const result = await submitDailyCheckIn(session.uid, {
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
    }, {
      clientLocalDate: String(formData.get("client_local_date") ?? ""),
      clientTimeZone: String(formData.get("client_time_zone") ?? "")
    });
    mode = result.mode;
  } catch (error) {
    if (error instanceof DailyCheckInAlreadySubmittedError) {
      redirect("/app/questions?already=1");
    }
    throw error;
  }

  revalidatePath("/app/questions");
  revalidatePath("/app/record");
  redirect(mode === "updated" ? "/app/questions?saved=1&updated=1" : "/app/questions?saved=1");
}

export async function acknowledgeRulesAction(): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  await acknowledgeRuleVersion(session.uid);
  revalidatePath("/app");
}

export async function acknowledgeManagerUpdatesAction(_formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  await repo.updateUser(session.uid, { last_seen_manager_update_at: new Date().toISOString() });
  revalidatePath("/app");
}

export async function acknowledgeNotificationsAction(_formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const repo = getGameRepository();
  await repo.updateUser(session.uid, { last_seen_notification_at: new Date().toISOString() });
  revalidatePath("/app");
  revalidatePath("/manager");
}

export async function claimRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");
  if (session.role === "manager") {
    throw new Error("Manager preview mode cannot claim rewards.");
  }

  const rewardId = String(formData.get("reward_id") ?? "");
  if (!rewardId) return;

  const repo = getGameRepository();
  const rewards = await repo.listRewards();
  const targetReward = rewards.find((item) => item.id === rewardId);
  await claimReward(session.uid, rewardId);
  revalidatePath("/app/rewards");
  revalidatePath("/app/score");
  if (targetReward) {
    const params = new URLSearchParams();
    params.set("claimed", "1");
    params.set("reward", targetReward.title);
    params.set("points", String(targetReward.required_points));
    redirect(`/app/rewards?${params.toString()}`);
  }
}

export async function reviewSubmissionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const approved = parseBoolean(formData.get("approved"));
  const note = String(formData.get("note") ?? "");
  const points = parseNumber(formData.get("points"), 0);
  const bonusPoints = parseNumber(formData.get("bonus_points"), 0);
  const bonusMessage = String(formData.get("bonus_message") ?? "").trim();

  const reviewed = await approveSubmission(
    {
      submissionId: String(formData.get("submission_id") ?? ""),
      approved,
      note,
      points,
      bonus_points: bonusPoints,
      bonus_message: bonusMessage
    },
    session.uid
  );

  revalidatePath("/manager");
  revalidatePath("/app/score");
  revalidatePath("/app/record");
  revalidatePath("/app/welcome");
  revalidatePath("/app/questions");
  const params = new URLSearchParams();
  params.set("reviewed", "1");
  params.set("approved", reviewed.status === "approved" ? "1" : "0");
  params.set("points", String(reviewed.points_awarded));
  params.set("bonus", String(reviewed.bonus_points_awarded ?? 0));
  if ((reviewed.bonus_message ?? "").trim().length > 0) {
    params.set("bonus_message", (reviewed.bonus_message ?? "").trim().slice(0, 180));
  }
  if (note.trim().length > 0) {
    params.set("note", note.slice(0, 120));
  }
  redirect(`/manager?${params.toString()}`);
}

export async function acknowledgeManagerRewardAlertsAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const raw = String(formData.get("claim_ids") ?? "");
  const claimIds = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  await markRewardClaimAlertsSeen(claimIds);
  revalidatePath("/manager");
  redirect("/manager");
}

export async function updateRulesAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const rowMap = new Map<number, { threshold?: number; label?: string; value?: string }>();

  for (const [key, raw] of formData.entries()) {
    const value = String(raw ?? "").trim();
    if (key.startsWith("penalty_item_threshold_")) {
      const idx = Number(key.replace("penalty_item_threshold_", ""));
      if (!Number.isFinite(idx)) continue;
      const parsed = Number(value);
      const row = rowMap.get(idx) ?? {};
      row.threshold = Number.isFinite(parsed) ? parsed : undefined;
      rowMap.set(idx, row);
      continue;
    }
    if (key.startsWith("penalty_item_label_")) {
      const idx = Number(key.replace("penalty_item_label_", ""));
      if (!Number.isFinite(idx)) continue;
      const row = rowMap.get(idx) ?? {};
      row.label = value;
      rowMap.set(idx, row);
      continue;
    }
    if (key.startsWith("penalty_item_value_")) {
      const idx = Number(key.replace("penalty_item_value_", ""));
      if (!Number.isFinite(idx)) continue;
      const row = rowMap.get(idx) ?? {};
      row.value = value;
      rowMap.set(idx, row);
    }
  }

  const configuredRows = [...rowMap.values()].filter((row) => Number.isFinite(row.threshold) && Number(row.threshold) < 0);

  let thresholds = configuredRows
    .map((row) => Math.floor(Number(row.threshold)))
    .filter((value) => Number.isFinite(value) && value < 0);

  thresholds = [...new Set(thresholds)].sort((a, b) => b - a);

  const parsedRewards: RuleConfig["penalty_rewards"] = thresholds.map((threshold) => {
    const found = configuredRows.find((row) => Math.floor(Number(row.threshold)) === threshold);
    return {
      threshold,
      label: (found?.label ?? "").trim() || "Manager reward unlocked",
      value: (found?.value ?? "").trim() || "$0 equivalent"
    };
  });

  const resetToVersionOne = String(formData.get("reset_version_to_one") ?? "") === "1";
  const targetRuleVersionRaw = resetToVersionOne ? "1" : String(formData.get("target_rule_version") ?? "").trim();
  const targetRuleVersionParsed = Number(targetRuleVersionRaw);
  const targetRuleVersion =
    targetRuleVersionRaw.length > 0 && Number.isFinite(targetRuleVersionParsed) && targetRuleVersionParsed > 0
      ? Math.floor(targetRuleVersionParsed)
      : undefined;

  const saved = await updateRules(
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
      target_rule_version: targetRuleVersion,
      note: String(formData.get("note") ?? "")
    },
    session.uid
  );

  revalidatePath("/manager");
  revalidatePath("/app/rules");
  revalidatePath("/app/score");
  const params = new URLSearchParams();
  params.set("rules_saved", "1");
  params.set("version", String(saved.rule_version));
  redirect(`/manager?${params.toString()}`);
}

export async function createRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  await createReward(session.uid, {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    required_points: parseNumber(formData.get("required_points"), 0)
  });

  revalidatePath("/manager");
  revalidatePath("/app/rewards");
}

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const rawUrl = String(formData.get("image_url") ?? "").trim();
  const file = formData.get("image_file");

  let imageUrl = rawUrl;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Please upload an image file.");
    }
    if (file.size > 3 * 1024 * 1024) {
      throw new Error("Please upload an image under 3MB.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    imageUrl = `data:${file.type};base64,${bytesToBase64(bytes)}`;
  }

  await createAnnouncement(session.uid, {
    title,
    message,
    image_url: imageUrl
  });

  revalidatePath("/manager");
  revalidatePath("/app");
  const params = new URLSearchParams();
  params.set("announce", "1");
  redirect(`/manager?${params.toString()}`);
}

export async function updateRewardAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

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
  await assertManagerOwner(session.uid);

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
  await assertManagerOwner(session.uid);

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
