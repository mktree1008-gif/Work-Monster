export const MISSION_ANNOUNCEMENT_PREFIX = "WM_MISSION_V1::";

export type EncodedMissionPayload = {
  target_user_id: string;
  title: string;
  objective: string;
  start_date: string;
  due_date: string;
  duration_days: number;
  deadline: string;
  bonus_points: number;
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeBonus(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function encodeMissionAnnouncement(payload: EncodedMissionPayload): string {
  const normalized: EncodedMissionPayload = {
    target_user_id: safeString(payload.target_user_id),
    title: safeString(payload.title),
    objective: safeString(payload.objective),
    start_date: safeString(payload.start_date),
    due_date: safeString(payload.due_date),
    duration_days: safeBonus(payload.duration_days),
    deadline: safeString(payload.deadline),
    bonus_points: safeBonus(payload.bonus_points)
  };

  return `${MISSION_ANNOUNCEMENT_PREFIX}${JSON.stringify(normalized)}`;
}

export function parseMissionAnnouncement(rawMessage: string): EncodedMissionPayload | null {
  const text = safeString(rawMessage);
  if (!text.startsWith(MISSION_ANNOUNCEMENT_PREFIX)) {
    return null;
  }

  const json = text.slice(MISSION_ANNOUNCEMENT_PREFIX.length).trim();
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as Partial<EncodedMissionPayload>;
    const target_user_id = safeString(parsed.target_user_id);
    const title = safeString(parsed.title);
    const objective = safeString(parsed.objective);
    const start_date = safeString(parsed.start_date);
    const due_date = safeString(parsed.due_date);
    const duration_days = safeBonus(parsed.duration_days);
    const deadline = safeString(parsed.deadline);
    const bonus_points = safeBonus(parsed.bonus_points);

    if (!target_user_id || !title || !objective) return null;

    return {
      target_user_id,
      title,
      objective,
      start_date,
      due_date: due_date || deadline,
      duration_days,
      deadline,
      bonus_points
    };
  } catch {
    return null;
  }
}

export function isMissionForUser(payload: EncodedMissionPayload, userId: string): boolean {
  return payload.target_user_id === "all" || payload.target_user_id === userId;
}

export function getMissionDueDate(payload: EncodedMissionPayload): string {
  return payload.due_date?.trim() || payload.deadline?.trim() || "";
}
