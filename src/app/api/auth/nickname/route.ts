import { NextRequest, NextResponse } from "next/server";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { UID_COOKIE } from "@/lib/session";

function destinationByRole(role: "user" | "manager") {
  return role === "manager" ? "/manager" : "/app/welcome";
}

export async function POST(request: NextRequest) {
  try {
    const uid = request.cookies.get(UID_COOKIE)?.value;
    if (!uid) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    const body = (await request.json()) as { nickname?: string };
    const nickname = body.nickname?.trim() ?? "";

    if (nickname.length < 2 || nickname.length > 24) {
      return NextResponse.json(
        { error: "Nickname must be 2-24 characters long." },
        { status: 400 }
      );
    }

    const repo = getGameRepository();
    const user = await repo.updateUser(uid, { name: nickname });

    return NextResponse.json({
      ok: true,
      redirectTo: destinationByRole(user.role)
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nickname update failed." },
      { status: 500 }
    );
  }
}
