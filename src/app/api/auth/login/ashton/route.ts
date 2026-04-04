import { NextRequest, NextResponse } from "next/server";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale } from "@/lib/types";

const ASHTON_LOGIN_EMAIL = "imamiller64@gmail.com";
const ASHTON_LOGIN_ID = "ashton";

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
    const nicknameMissing = (user.name ?? "").trim().length === 0;

    const response = NextResponse.json({
      ok: true,
      redirectTo: nicknameMissing ? "/auth/nickname" : "/app/welcome",
      loginPointsAwarded: false,
      loginPoints: 0
    });

    response.cookies.set(UID_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
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
