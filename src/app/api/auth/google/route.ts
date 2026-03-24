import { NextRequest, NextResponse } from "next/server";
import { isManagerOwnerEmail } from "@/lib/constants";
import { getAdminAuth, isFirebaseServerConfigured } from "@/lib/firebase/admin";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { LOCALE_COOKIE, ROLE_COOKIE, UID_COOKIE } from "@/lib/session";
import { Locale, UserRole } from "@/lib/types";

type GoogleLoginBody = {
  idToken?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  locale?: Locale;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GoogleLoginBody;
    const requestedManager = body.role === "manager";
    const role = requestedManager ? "manager" : "user";
    const locale = body.locale === "ko" ? "ko" : "en";

    let email = body.email?.trim().toLowerCase() ?? "";
    let name = body.name?.trim();

    if (isFirebaseServerConfigured() && body.idToken) {
      try {
        const decoded = await getAdminAuth().verifyIdToken(body.idToken);
        email = decoded.email?.toLowerCase() ?? email;
        name = decoded.name ?? name;
      } catch (error) {
        console.warn("Google idToken verification failed, falling back to client profile.", error);
      }
    }

    if (!email) {
      return NextResponse.json({ error: "Google email was not resolved." }, { status: 400 });
    }

    if (requestedManager && !isManagerOwnerEmail(email)) {
      return NextResponse.json(
        {
          code: "MANAGER_ACCESS_DENIED",
          error: "권한이 없습니다. 관리자 모드는 호스트 계정만 사용할 수 있습니다."
        },
        { status: 403 }
      );
    }

    const repo = getGameRepository();
    let user = await repo.signIn(email, role, locale);

    if (name && name.length > 0) {
      user = await repo.updateUser(user.id, { name });
    }

    const nicknameMissing = (user.name ?? "").trim().length === 0;

    const response = NextResponse.json({
      ok: true,
      redirectTo: nicknameMissing ? "/auth/nickname" : user.role === "manager" ? "/manager" : "/app/welcome"
    });

    response.cookies.set(UID_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(ROLE_COOKIE, user.role, { httpOnly: true, sameSite: "lax", path: "/" });
    response.cookies.set(LOCALE_COOKIE, locale, { httpOnly: true, sameSite: "lax", path: "/" });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Google sign-in failed."
      },
      { status: 500 }
    );
  }
}
