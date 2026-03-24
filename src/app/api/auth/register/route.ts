import { NextRequest, NextResponse } from "next/server";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserRole } from "@/lib/types";

type RegisterBody = {
  loginId?: string;
  nickname?: string;
  password?: string;
  role?: UserRole;
  locale?: Locale;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;
    const loginId = body.loginId?.trim().toLowerCase() ?? "";
    const nickname = body.nickname?.trim() ?? "";
    const password = body.password ?? "";
    const role = body.role === "manager" ? "manager" : "user";
    const locale = body.locale === "ko" ? "ko" : "en";

    if (!loginId) {
      return NextResponse.json({ error: "ID is required." }, { status: 400 });
    }
    if (!nickname) {
      return NextResponse.json({ error: "Nickname is required." }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Security code is required." }, { status: 400 });
    }

    const repo = getGameRepository();
    const user = await repo.createAccountWithPassword(loginId, password, role, locale, nickname);

    const response = NextResponse.json({
      ok: true,
      redirectTo: user.role === "manager" ? "/manager" : "/app/questions"
    });

    response.cookies.set(UID_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(ROLE_COOKIE, user.role, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(LOCALE_COOKIE, user.locale, { httpOnly: true, sameSite: "lax", path: "/" });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Account creation failed." },
      { status: 500 }
    );
  }
}
