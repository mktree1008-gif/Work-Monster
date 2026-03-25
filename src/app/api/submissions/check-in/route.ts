import { NextRequest, NextResponse } from "next/server";
import { DailyCheckInAlreadySubmittedError, submitDailyCheckIn } from "@/lib/services/game-service";
import { getSession } from "@/lib/session";

type CheckInBody = {
  mood?: string;
  feeling?: string;
  focus?: string;
  blocker?: string;
  win?: string;
  calories?: number;
  productive?: boolean;
  task_list?: string;
  file_url?: string;
  client_time_zone?: string;
  client_local_date?: string;
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
    const taskList = String(body.task_list ?? "")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);

    const result = await submitDailyCheckIn(
      session.uid,
      {
        mood: String(body.mood ?? "Steady"),
        feeling: String(body.feeling ?? ""),
        calories: Number.isFinite(body.calories) ? Number(body.calories) : 0,
        productive: Boolean(body.productive),
        task_list: taskList,
        file_url: String(body.file_url ?? ""),
        custom_answers: {
          focus: String(body.focus ?? ""),
          blocker: String(body.blocker ?? ""),
          win: String(body.win ?? "")
        }
      },
      {
        clientTimeZone: String(body.client_time_zone ?? ""),
        clientLocalDate: String(body.client_local_date ?? "")
      }
    );

    return NextResponse.json({
      ok: true,
      updated: result.mode === "updated",
      submissionPointsAwarded: result.submissionPointsAwarded,
      redirectTo:
        result.mode === "updated"
          ? "/app/welcome?saved=1&updated=1"
          : `/app/welcome?saved=1&submission_points=${encodeURIComponent(String(result.submissionPointsAwarded))}`
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
