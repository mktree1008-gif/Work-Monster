import { NextRequest, NextResponse } from "next/server";
import { MANAGER_OWNER_EMAIL } from "@/lib/constants";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserRole } from "@/lib/types";

type RegisterBody = {
  loginId?: string;
  password?: string;
  role?: UserRole;
  locale?: Locale;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;
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

    if (requestedManager && loginId !== MANAGER_OWNER_EMAIL) {
      return NextResponse.json(
        {
          code: "MANAGER_ACCESS_DENIED",
          error: "권한이 없습니다. 관리자 계정은 지정된 호스트 이메일만 생성할 수 있습니다."
        },
        { status: 403 }
      );
    }

    const repo = getGameRepository();
    const user = await repo.createAccountWithPassword(loginId, password, role, locale);

    const response = NextResponse.json({
      ok: true,
      redirectTo: "/auth/nickname"
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
