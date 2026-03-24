import { NextRequest, NextResponse } from "next/server";
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
    const role = body.role === "manager" ? "manager" : "user";
    const locale = body.locale === "ko" ? "ko" : "en";

    let email = body.email?.trim().toLowerCase() ?? "";
    let name = body.name?.trim();

    if (isFirebaseServerConfigured() && body.idToken) {
      const decoded = await getAdminAuth().verifyIdToken(body.idToken);
      email = decoded.email?.toLowerCase() ?? email;
      name = decoded.name ?? name;
    }

    if (!email) {
      return NextResponse.json({ error: "Google email was not resolved." }, { status: 400 });
    }

    const repo = getGameRepository();
    const user = await repo.signIn(email, role, locale);

    if (name && name.length > 0) {
      await repo.updateUser(user.id, { name });
    }

    const response = NextResponse.json({
      ok: true,
      redirectTo: user.role === "manager" ? "/manager" : "/app/questions"
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
