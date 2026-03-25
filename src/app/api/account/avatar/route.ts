import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getGameRepository } from "@/lib/repositories/game-repository";
import { getSession } from "@/lib/session";

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  throw new Error("Base64 encoding is not available in this runtime.");
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });
    }

    const formData = await request.formData();
    const mode = String(formData.get("avatar_mode") ?? "emoji");
    const rawEmoji = String(formData.get("avatar_emoji") ?? "").trim();
    const rawUrl = String(formData.get("avatar_url") ?? "").trim();
    const file = formData.get("avatar_file");

    const emoji = rawEmoji.length > 0 ? rawEmoji.slice(0, 2) : "😺";
    let imageUrl = rawUrl;

    if (file instanceof File && file.size > 0) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
      }
      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: "Please upload an image under 50MB." }, { status: 400 });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      imageUrl = `data:${file.type};base64,${bytesToBase64(bytes)}`;
    }

    const repo = getGameRepository();
    if (mode === "image" && imageUrl) {
      await repo.updateUser(session.uid, {
        profile_avatar_type: "image",
        profile_avatar_url: imageUrl,
        profile_avatar_emoji: emoji
      });
    } else {
      await repo.updateUser(session.uid, {
        profile_avatar_type: "emoji",
        profile_avatar_emoji: emoji,
        profile_avatar_url: ""
      });
    }

    revalidatePath("/account");
    revalidatePath("/app");
    revalidatePath("/app/welcome");
    revalidatePath("/app/questions");
    revalidatePath("/app/record");
    revalidatePath("/app/rewards");
    revalidatePath("/app/score");
    revalidatePath("/manager");

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
