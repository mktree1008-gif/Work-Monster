import { NextRequest, NextResponse } from "next/server";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { awardDailyLoginPoints } from "@/lib/services/game-service";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale } from "@/lib/types";

const ASHTON_LOGIN_EMAIL = "imamiller64@gmail.com";
const ASHTON_LOGIN_ID = "ashton";

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
    try {
      const body = (await request.json()) as { locale?: Locale };
      locale = body.locale === "ko" ? "ko" : "en";
    } catch {
      locale = "en";
    }

    const repo = getGameRepository();
    const user = await repo.findUserByLoginOrEmail(ASHTON_LOGIN_EMAIL)
      ?? await repo.findUserByLoginOrEmail(ASHTON_LOGIN_ID);

    if (!user) {
      return NextResponse.json(
        { error: "Ashton quick-login account was not found. Please contact manager." },
        { status: 404 }
      );
    }

    const nextRole = "user" as const;
    const nextLocale = locale === "ko" ? "ko" : "en";
    let nextUser = user;
    let quotaFallback = false;

    if (user.role !== nextRole || user.locale !== nextLocale) {
      try {
        nextUser = await repo.updateUser(user.id, {
          role: nextRole,
          locale: nextLocale
        });
      } catch (error) {
        if (!isQuotaExceeded(error)) throw error;
        quotaFallback = true;
        console.warn("Ashton quick login: quota exceeded while updating profile, continuing with session fallback.");
        nextUser = { ...user, role: nextRole, locale: nextLocale };
      }
    }

    const nicknameMissing = (nextUser.name ?? "").trim().length === 0;
    let loginAward = { awarded: false, points: 0, date: "" };
    if (!nicknameMissing) {
      try {
        loginAward = await awardDailyLoginPoints(nextUser.id);
      } catch (error) {
        if (isQuotaExceeded(error)) {
          quotaFallback = true;
          console.warn("Ashton quick login: quota exceeded while awarding login points, continuing with session fallback.");
        } else {
          console.warn("Ashton quick login bonus award failed, proceeding with login.", error);
        }
      }
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: nicknameMissing ? "/auth/nickname" : "/app/welcome",
      loginPointsAwarded: loginAward.awarded,
      loginPoints: loginAward.points,
      quotaFallback
    });

    response.cookies.set(UID_COOKIE, nextUser.id, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(ROLE_COOKIE, nextRole, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(LOCALE_COOKIE, nextLocale, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ashton quick login failed." },
      { status: 500 }
    );
  }
}
