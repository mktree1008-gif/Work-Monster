import { NextRequest, NextResponse } from "next/server";
import { isManagerOwnerEmail } from "@/lib/constants";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { awardDailyLoginPoints } from "@/lib/services/game-service";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserRole } from "@/lib/types";

const MONG_LOGIN_EMAIL = "mktree1008@gmail.com";
const MONG_LOGIN_ID = "mong";

type QuickLoginBody = {
  locale?: Locale;
  role?: UserRole;
};

function isQuotaExceeded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const grpcCode = typeof (error as { code?: unknown } | null)?.code === "number"
    ? Number((error as { code?: number }).code)
    : null;
  return grpcCode === 8 || message.includes("RESOURCE_EXHAUSTED") || message.includes("Quota exceeded");
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
    const user = await repo.findUserByLoginOrEmail(MONG_LOGIN_EMAIL)
      ?? await repo.findUserByLoginOrEmail(MONG_LOGIN_ID);

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
    let quotaFallback = false;

    if (user.role !== requestedRole || user.locale !== nextLocale) {
      try {
        nextUser = await repo.updateUser(user.id, {
          role: requestedRole,
          locale: nextLocale
        });
      } catch (error) {
        if (!isQuotaExceeded(error)) throw error;
        quotaFallback = true;
        console.warn("Mong quick login: quota exceeded while updating profile, continuing with session fallback.");
        nextUser = { ...user, role: requestedRole, locale: nextLocale };
      }
    }

    const nicknameMissing = (nextUser.name ?? "").trim().length === 0;
    let loginAward = { awarded: false, points: 0, date: "" };
    if (requestedRole === "user" && !nicknameMissing) {
      try {
        loginAward = await awardDailyLoginPoints(nextUser.id);
      } catch (error) {
        if (isQuotaExceeded(error)) {
          quotaFallback = true;
          console.warn("Mong quick login: quota exceeded while awarding login points, continuing with session fallback.");
        } else {
          console.warn("Mong quick login bonus award failed, proceeding with login.", error);
        }
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
      loginPoints: loginAward.points,
      quotaFallback
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
