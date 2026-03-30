"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isManagerOwnerEmail } from "@/lib/constants";
import { Locale, RuleConfig, UserRole } from "@/lib/types";
import { clearSession, getSession, setSession, updateLocale } from "@/lib/session";
import {
  acknowledgeRuleVersion,
  applyInactivityPenalty,
  approveSubmission,
  assignMission,
  claimPenaltyReward,
  claimReward,
  DailyCheckInAlreadySubmittedError,
  createAnnouncement,
  createReward,
  deleteMission,
  deleteReward,
  getDashboard,
  markRewardClaimAlertsSeen,
  skipInactivityPenalty,
  submitDailyCheckIn,
  updateReward,
  updateMission,
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

  redirect("/app/welcome");
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

export async function updateNicknameAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const nickname = String(formData.get("nickname") ?? "").trim();
  if (nickname.length < 2 || nickname.length > 24) {
    throw new Error("Nickname must be 2-24 characters long.");
  }

  const repo = getGameRepository();
  await repo.updateUser(session.uid, { name: nickname });

  revalidatePath("/account");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/questions");
  revalidatePath("/manager");
  redirect("/account?nickname_saved=1");
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
    if (file.size > 50 * 1024 * 1024) {
      throw new Error("Please upload an image under 50MB.");
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
  revalidatePath("/app/welcome");
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
  let submissionPointsAwarded = 0;
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
    submissionPointsAwarded = result.submissionPointsAwarded;
  } catch (error) {
    if (error instanceof DailyCheckInAlreadySubmittedError) {
      redirect("/app/welcome?already=1");
    }
    throw error;
  }

  revalidatePath("/app/welcome");
  revalidatePath("/app/record");
  const redirectParams = new URLSearchParams();
  redirectParams.set("saved", "1");
  if (mode === "updated") {
    redirectParams.set("updated", "1");
  }
  if (submissionPointsAwarded !== 0) {
    redirectParams.set("submission_points", String(submissionPointsAwarded));
  }
  redirect(`/app/welcome?${redirectParams.toString()}`);
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

export async function applyInactivityPenaltyAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");

  const targetId = String(formData.get("target_id") ?? "").trim();
  const rawPoints = String(formData.get("points") ?? "").trim();
  const parsedPoints = rawPoints.length > 0 ? Number(rawPoints) : NaN;
  const points = Number.isFinite(parsedPoints) ? Math.round(parsedPoints) : undefined;
  const note = String(formData.get("note") ?? "").trim();

  try {
    await applyInactivityPenalty(session.uid, {
      target_id: targetId,
      points,
      note
    });
    params.set("inactivity_applied", "1");
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to apply inactivity penalty.";
    params.set("inactivity_error", text);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/score");
  revalidatePath("/app/record");
  redirect(`/manager?${params.toString()}`);
}

export async function skipInactivityPenaltyAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");

  const targetId = String(formData.get("target_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  try {
    await skipInactivityPenalty(session.uid, {
      target_id: targetId,
      note
    });
    params.set("inactivity_skipped", "1");
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to skip inactivity penalty.";
    params.set("inactivity_error", text);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/score");
  revalidatePath("/app/record");
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
  const repo = getGameRepository();
  const previousRules = await repo.getRules();

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

  const penaltyTextRules = [...formData.entries()]
    .filter(([key]) => key.startsWith("penalty_text_rule_"))
    .sort(([left], [right]) => {
      const leftIndex = Number(left.replace("penalty_text_rule_", ""));
      const rightIndex = Number(right.replace("penalty_text_rule_", ""));
      if (!Number.isFinite(leftIndex) || !Number.isFinite(rightIndex)) return 0;
      return leftIndex - rightIndex;
    })
    .map(([_key, value]) => String(value ?? "").trim())
    .filter(Boolean)
    .slice(0, 20);

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
      inactivity_penalty_enabled: parseBoolean(formData.get("inactivity_penalty_enabled")),
      inactivity_penalty_points_per_day: parseNumber(formData.get("inactivity_penalty_points_per_day"), -3),
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
      penalty_action_rules: penaltyTextRules,
      target_rule_version: targetRuleVersion,
      note: String(formData.get("note") ?? "")
    },
    session.uid
  );

  revalidatePath("/manager");
  revalidatePath("/app/rules");
  revalidatePath("/app/score");
  revalidatePath("/app/welcome");
  revalidatePath("/app");

  const penaltyNotice = String(formData.get("penalty_notice") ?? "").trim();
  const beforePenaltyRules = (previousRules.penalty_action_rules ?? []).map((item) => item.trim()).filter(Boolean);
  const afterPenaltyRules = (saved.penalty_action_rules ?? []).map((item) => item.trim()).filter(Boolean);
  const penaltyRulesChanged = JSON.stringify(beforePenaltyRules) !== JSON.stringify(afterPenaltyRules);
  const params = new URLSearchParams();
  const shouldSendPenaltyNotice = penaltyNotice.length > 0 || penaltyRulesChanged;
  if (shouldSendPenaltyNotice) {
    const penaltySummary =
      afterPenaltyRules.length > 0
        ? `Updated penalty actions: ${afterPenaltyRules.join(" / ")}`
        : "Penalty rules were updated.";
    const autoPenaltyNotice = penaltyNotice.length > 0
      ? penaltyNotice
      : `${penaltySummary} Open Rules tab to review full details.`;
    try {
      await createAnnouncement(session.uid, {
        title: `Rule update summary (v${saved.rule_version})`,
        message: autoPenaltyNotice
      });
      params.set("penalty_notice_sent", "1");
      revalidatePath("/manager");
      revalidatePath("/app");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Failed to send penalty notice popup.";
      params.set("announce_error", text);
    }
  }

  params.set("rules_saved", "1");
  params.set("version", String(saved.rule_version));
  params.set("manager_tab", "rules");
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

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const rawUrl = String(formData.get("image_url") ?? "").trim();
  const file = formData.get("image_file");

  let imageUrl = rawUrl;
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      params.set("announce_error", "Please upload an image file.");
      redirect(`/manager?${params.toString()}`);
    }
    // Firestore document size limit is ~1MB.
    // Since base64 expands payload (~33%), keep uploaded image safely below that limit.
    if (file.size > 700 * 1024) {
      params.set("announce_error", "Please upload an image under 700KB.");
      redirect(`/manager?${params.toString()}`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    imageUrl = `data:${file.type};base64,${bytesToBase64(bytes)}`;
  }

  try {
    await createAnnouncement(session.uid, {
      title,
      message,
      image_url: imageUrl
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to create announcement.";
    params.set("announce_error", text);
    redirect(`/manager?${params.toString()}`);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  params.set("announce", "1");
  redirect(`/manager?${params.toString()}`);
}

export async function assignMissionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");

  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  const title = String(formData.get("mission_title") ?? "").trim();
  const objective = String(formData.get("mission_objective") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const durationDaysRaw = Number(formData.get("duration_days") ?? 0);
  const durationDays = Number.isFinite(durationDaysRaw) ? Math.max(0, Math.round(durationDaysRaw)) : 0;
  const bonusPointsRaw = Number(formData.get("bonus_points") ?? 0);
  const bonusPoints = Number.isFinite(bonusPointsRaw) ? Math.max(0, Math.round(bonusPointsRaw)) : 0;

  try {
    await assignMission(session.uid, {
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: durationDays,
      bonus_points: bonusPoints
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to assign mission.";
    params.set("assign_error", text);
    redirect(`/manager?${params.toString()}`);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/mission");
  params.set("mission_assigned", "1");
  redirect(`/manager?${params.toString()}`);
}

export async function updateMissionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");

  const missionAnnouncementId = String(formData.get("mission_announcement_id") ?? "").trim();
  const targetUserId = String(formData.get("target_user_id") ?? "").trim();
  const title = String(formData.get("mission_title") ?? "").trim();
  const objective = String(formData.get("mission_objective") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const durationDaysRaw = Number(formData.get("duration_days") ?? 0);
  const durationDays = Number.isFinite(durationDaysRaw) ? Math.max(0, Math.round(durationDaysRaw)) : 0;
  const bonusPointsRaw = Number(formData.get("bonus_points") ?? 0);
  const bonusPoints = Number.isFinite(bonusPointsRaw) ? Math.max(0, Math.round(bonusPointsRaw)) : 0;

  try {
    await updateMission(session.uid, {
      mission_announcement_id: missionAnnouncementId,
      target_user_id: targetUserId,
      title,
      objective,
      start_date: startDate,
      due_date: dueDate,
      duration_days: durationDays,
      bonus_points: bonusPoints
    });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to update mission.";
    params.set("assign_error", text);
    redirect(`/manager?${params.toString()}`);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/mission");
  params.set("mission_updated", "1");
  redirect(`/manager?${params.toString()}`);
}

export async function deleteMissionAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/auth/login");
  await assertManagerOwner(session.uid);

  const params = new URLSearchParams();
  params.set("manager_tab", "inbox");

  const missionAnnouncementId = String(formData.get("mission_announcement_id") ?? "").trim();
  try {
    await deleteMission(session.uid, { mission_announcement_id: missionAnnouncementId });
  } catch (error) {
    const text = error instanceof Error ? error.message : "Failed to delete mission.";
    params.set("assign_error", text);
    redirect(`/manager?${params.toString()}`);
  }

  revalidatePath("/manager");
  revalidatePath("/app");
  revalidatePath("/app/welcome");
  revalidatePath("/app/mission");
  params.set("mission_deleted", "1");
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
