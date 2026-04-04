import { NextRequest, NextResponse } from "next/server";
import { isManagerOwnerEmail } from "@/lib/constants";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { awardDailyLoginPoints } from "@/lib/services/game-service";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserProfile, UserRole } from "@/lib/types";

const MONG_LOGIN_EMAIL = "mktree1008@gmail.com";
const MONG_LOGIN_ID = "mong";

type QuickLoginBody = {
  locale?: Locale;
  role?: UserRole;
};

function isMongCandidate(user: UserProfile): boolean {
  const email = (user.email ?? "").trim().toLowerCase();
  const loginId = (user.login_id ?? "").trim().toLowerCase();
  const name = (user.name ?? "").trim().toLowerCase();
  return email === MONG_LOGIN_EMAIL || loginId === MONG_LOGIN_ID || name === "mong";
}

export async function POST(request: NextRequest) {
  try {
    let locale: Locale = "en";
    let requestedRole: UserRole = "user";

    try {
      const body = (await request.json()) as QuickLoginBody;
      locale = body.locale === "ko" ? "ko" : "en";
      requestedRole = body.role === "manager" ? "manager" : "user";
    } catch {
      locale = "en";
      requestedRole = "user";
    }

    const repo = getGameRepository();
    const users = await repo.listUsers();
    const user = users.find(isMongCandidate);

    if (!user) {
      return NextResponse.json(
        { error: "Mong quick-login account was not found. Please contact manager." },
        { status: 404 }
      );
    }

    if (requestedRole === "manager" && !isManagerOwnerEmail(user.email)) {
      return NextResponse.json(
        { error: "권한이 없습니다. 관리자 모드는 호스트 계정만 사용할 수 있습니다." },
        { status: 403 }
      );
    }

    const nextLocale = locale === "ko" ? "ko" : "en";
    let nextUser = user;
    if (user.role !== requestedRole || user.locale !== nextLocale) {
      try {
        nextUser = await repo.updateUser(user.id, {
          role: requestedRole,
          locale: nextLocale
        });
      } catch {
        nextUser = { ...user, role: requestedRole, locale: nextLocale };
      }
    }

    const nicknameMissing = (nextUser.name ?? "").trim().length === 0;
    let loginAward = { awarded: false, points: 0, date: "" };
    if (requestedRole === "user" && !nicknameMissing) {
      try {
        loginAward = await awardDailyLoginPoints(nextUser.id);
      } catch (error) {
        console.warn("Mong quick login bonus award failed, proceeding with login.", error);
      }
    }

    const redirectTo = nicknameMissing
      ? "/auth/nickname"
      : requestedRole === "manager"
        ? "/manager"
        : "/app/welcome";

    const response = NextResponse.json({
      ok: true,
      redirectTo,
      loginPointsAwarded: loginAward.awarded,
      loginPoints: loginAward.points
    });

    response.cookies.set(UID_COOKIE, nextUser.id, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(ROLE_COOKIE, requestedRole, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(LOCALE_COOKIE, nextLocale, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mong quick login failed." },
      { status: 500 }
    );
  }
}
