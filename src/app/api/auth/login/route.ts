import { NextRequest, NextResponse } from "next/server";
import { isManagerOwnerEmail } from "@/lib/constants";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { awardDailyLoginPoints } from "@/lib/services/game-service";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserRole } from "@/lib/types";

type LoginBody = {
  loginId?: string;
  password?: string;
  role?: UserRole;
  locale?: Locale;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;
    const loginId = body.loginId?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const requestedManager = body.role === "manager";
    const role = requestedManager ? "manager" : "user";
    const locale = body.locale === "ko" ? "ko" : "en";

    if (!loginId) {
      return NextResponse.json({ error: "ID is required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Security code is required." }, { status: 400 });
    }

    const repo = getGameRepository();
    let user = await repo.signInWithPassword(loginId, password, "user", locale);

    if (requestedManager && !isManagerOwnerEmail(user.email)) {
      return NextResponse.json(
        {
          code: "MANAGER_ACCESS_DENIED",
          error: "권한이 없습니다. 관리자 모드는 호스트 계정만 사용할 수 있습니다."
        },
        { status: 403 }
      );
    }

    if (requestedManager && user.role !== "manager") {
      user = await repo.updateUser(user.id, { role: "manager" });
    }

    if (!requestedManager && user.role !== "user") {
      user = await repo.updateUser(user.id, { role: "user" });
    }
    const loginAward = !requestedManager
      ? await awardDailyLoginPoints(user.id)
      : { awarded: false, points: 0, date: "" };
    const nicknameMissing = (user.name ?? "").trim().length === 0;

    const response = NextResponse.json({
      ok: true,
      redirectTo: nicknameMissing ? "/auth/nickname" : user.role === "manager" ? "/manager" : "/app/welcome",
      loginPointsAwarded: loginAward.awarded,
      loginPoints: loginAward.points
    });

    response.cookies.set(UID_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(ROLE_COOKIE, user.role, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(LOCALE_COOKIE, user.locale, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 500 }
    );
  }
}
