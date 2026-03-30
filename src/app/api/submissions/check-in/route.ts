import { NextRequest, NextResponse } from "next/server";
import { DailyCheckInAlreadySubmittedError, submitDailyCheckIn } from "@/lib/services/game-service";
import { getSession } from "@/lib/session";

type CheckInBody = {
  save_mode?: "draft" | "submit";
  mood?: string;
  feeling?: string;
  focus?: string;
  blocker?: string;
  win?: string;
  calories?: number;
  productive?: boolean;
  task_list?: string | string[];
  file_url?: string;
  step_index?: number;
  feeling_state?: string;
  primary_productivity_factor?: string;
  primary_productivity_factor_note?: string;
  completed_top_priorities?: boolean;
  worked_on_high_impact?: boolean;
  avoided_low_value_work?: boolean;
  self_productivity_rating?: string;
  tomorrow_improvement_focus?: string;
  tomorrow_improvement_note?: string;
  completed_work_summary?: string;
  mission_tags?: string[];
  evidence_files?: string[];
  evidence_links?: string[];
  performance_score_preview?: number;
  coach_insight_text?: string;
  top_focus_summary?: string;
  energy_peak_summary?: string;
  client_time_zone?: string;
  client_local_date?: string;
  custom_answers?: Record<string, unknown>;
};

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    }
    if (session.role === "manager") {
      return NextResponse.json({ error: "Manager preview mode cannot submit check-ins." }, { status: 403 });
    }

    const body = (await request.json()) as CheckInBody;
    const saveMode = body.save_mode === "draft" ? "draft" : "submit";
    const taskList = Array.isArray(body.task_list)
      ? body.task_list.map((item) => String(item ?? "").trim()).filter(Boolean)
      : String(body.task_list ?? "")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean);
    const missionTags = Array.isArray(body.mission_tags)
      ? body.mission_tags.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const evidenceFiles = Array.isArray(body.evidence_files)
      ? body.evidence_files.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];
    const evidenceLinks = Array.isArray(body.evidence_links)
      ? body.evidence_links.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [];

    const result = await submitDailyCheckIn(
      session.uid,
      {
        mood: String(body.mood ?? "Steady"),
        feeling: String(body.feeling ?? ""),
        calories: Number.isFinite(body.calories) ? Number(body.calories) : 0,
        productive: Boolean(body.productive),
        task_list: taskList,
        file_url: String(body.file_url ?? ""),
        step_index: Number.isFinite(body.step_index) ? Number(body.step_index) : undefined,
        feeling_state: String(body.feeling_state ?? ""),
        primary_productivity_factor: String(body.primary_productivity_factor ?? ""),
        primary_productivity_factor_note: String(body.primary_productivity_factor_note ?? ""),
        completed_top_priorities: Boolean(body.completed_top_priorities),
        worked_on_high_impact: Boolean(body.worked_on_high_impact),
        avoided_low_value_work: Boolean(body.avoided_low_value_work),
        self_productivity_rating: String(body.self_productivity_rating ?? ""),
        tomorrow_improvement_focus: String(body.tomorrow_improvement_focus ?? ""),
        tomorrow_improvement_note: String(body.tomorrow_improvement_note ?? ""),
        completed_work_summary: String(body.completed_work_summary ?? ""),
        mission_tags: missionTags,
        evidence_files: evidenceFiles,
        evidence_links: evidenceLinks,
        performance_score_preview: Number.isFinite(body.performance_score_preview)
          ? Number(body.performance_score_preview)
          : undefined,
        coach_insight_text: String(body.coach_insight_text ?? ""),
        top_focus_summary: String(body.top_focus_summary ?? ""),
        energy_peak_summary: String(body.energy_peak_summary ?? ""),
        custom_answers: {
          focus: String(body.focus ?? ""),
          blocker: String(body.blocker ?? ""),
          win: String(body.win ?? ""),
          ...(typeof body.custom_answers === "object" && body.custom_answers
            ? Object.fromEntries(
                Object.entries(body.custom_answers).map(([key, value]) => [key, String(value ?? "")])
              )
            : {})
        }
      },
      {
        clientTimeZone: String(body.client_time_zone ?? ""),
        clientLocalDate: String(body.client_local_date ?? "")
      },
      saveMode
    );

    let redirectTo = "";
    if (saveMode === "submit") {
      const redirectParams = new URLSearchParams();
      redirectParams.set("saved", "1");
      if (result.mode === "updated") {
        redirectParams.set("updated", "1");
      }
      if (result.submissionPointsAwarded !== 0) {
        redirectParams.set("submission_points", String(result.submissionPointsAwarded));
      }
      redirectTo = `/app/welcome?${redirectParams.toString()}`;
    }

    return NextResponse.json({
      ok: true,
      mode: result.mode,
      saveMode,
      updated: result.mode === "updated",
      submissionPointsAwarded: result.submissionPointsAwarded,
      redirectTo
    });
  } catch (error) {
    if (error instanceof DailyCheckInAlreadySubmittedError) {
      return NextResponse.json(
        {
          code: error.code,
          error: error.message,
          submission_id: error.submissionId ?? "",
          redirectTo: "/app/welcome?already=1"
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save check-in." },
      { status: 500 }
    );
  }
}
